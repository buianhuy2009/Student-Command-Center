/**
 * StudentOS AI eval — runs the real model on the recreated school emails, Vietnamese
 * reschedule commands and "làm hộ" tutor prompts in eval/, and writes a right/wrong
 * table per case (eval/REPORT.md) for the judges.
 *
 *   npx tsx scripts/eval_ai.ts email before     # pipeline as shipped up to v2.16.0 (live server)
 *   npx tsx scripts/eval_ai.ts email after      # v2.17.0 pipeline: new prompt + server checks
 *   npx tsx scripts/eval_ai.ts tutor before|after
 *   npx tsx scripts/eval_ai.ts schedule before|after
 *   npx tsx scripts/eval_ai.ts report           # rebuild eval/REPORT.md from eval/results/
 *
 * "after" sends the new prompt through the live /api/gemini/generate endpoint (same model
 * chain as production) and applies the new server post-processing locally, so it measures
 * v2.17.0 even before it is deployed. EVAL_BASE_URL overrides the server.
 */
import fs from 'node:fs';
import path from 'node:path';
import { cleanEmailForAI } from '../src/utils/emailText';
import { ACADEMIC_CUE_RE, ACADEMIC_SENDER_RE } from '../src/utils/trust';
// @ts-ignore — plain JS server modules
import { buildEmailPrompt, postProcessAlerts } from '../src/server/api-handlers/gemini/summarize-emails.js';
// @ts-ignore
import { TUTOR_POLICY, HOMEWORK_DUMP_REMINDER, isHomeworkDump } from '../src/server/api-handlers/gemini/tutorPolicy.js';

const BASE = process.env.EVAL_BASE_URL || 'https://sutdent-command-center.vercel.app';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const EVAL = path.join(ROOT, 'eval');
const OUT = path.join(EVAL, 'results');
const TODAY = '2026-10-16T15:00:00Z';

const readJson = (f: string) => JSON.parse(fs.readFileSync(path.join(EVAL, f), 'utf-8'));
const fold = (s?: string) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();

async function post(route: string, body: any, tries = 3): Promise<any> {
  let last: any;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`${BASE}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return data;
      last = new Error(`${route} ${res.status} ${JSON.stringify(data).slice(0, 200)}`);
    } catch (e) {
      last = e;
    }
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  throw last;
}

async function generate(contents: string, config: any = {}): Promise<string> {
  const data = await post('/api/gemini/generate', { contents, config });
  return String(data?.text || '');
}

function parseLoose(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    const s = text.indexOf('{');
    const e = text.lastIndexOf('}');
    return s >= 0 && e > s ? JSON.parse(text.slice(s, e + 1)) : null;
  }
}

/* ------------------------------- emails -------------------------------- */

const OLD_ACADEMIC_RE = /classroom|canvas|moodle|blackboard|\.edu|school|teacher|professor|instructor|phòng đào tạo|giáo viên/i;

const LEGACY_PROMPT = fs.readFileSync(path.join(EVAL, 'legacy', 'prompt-v2.16.txt'), 'utf-8');
function legacyPrompt(emails: any[]) {
  return LEGACY_PROMPT.replace('${emails.length}', String(emails.length)).replace('${JSON.stringify(emails, null, 2)}', JSON.stringify(emails, null, 2));
}
/** v2.16.0 server overrides, applied to a model answer. */
function legacyOverrides(emails: any[], alerts: any[]) {
  return (alerts || []).map((alert: any) => {
    const raw = emails.find((e) => e.id === alert.id);
    const labels = raw?.labelIds || [];
    const academic = OLD_ACADEMIC_RE.test(`${raw?.senderEmail || ''} ${raw?.sender || ''}`);
    if (labels.includes('SPAM') || (!academic && labels.includes('CATEGORY_PROMOTIONS'))) {
      alert.category = 'PROMOTION';
      if (alert.detectedAssignment) alert.detectedAssignment.isAssignment = false;
    } else if (!academic && labels.includes('CATEGORY_SOCIAL')) {
      alert.category = 'SOCIAL';
      if (alert.detectedAssignment) alert.detectedAssignment.isAssignment = false;
    }
    return alert;
  });
}

async function runEmails(variant: 'before' | 'before-model' | 'after') {
  const cases = readJson('emails.json') as any[];
  const alerts = new Map<string, any>();
  const aiBound: any[] = [];

  for (const c of cases) {
    const e = c.email;
    const labels: string[] = e.labelIds || [];
    const senderText = `${e.senderEmail || ''} ${e.sender || ''}`;
    const promoOrSocial = labels.includes('SPAM') || labels.includes('CATEGORY_PROMOTIONS') || labels.includes('CATEGORY_SOCIAL');
    if (variant !== 'after') {
      // v2.16.0 client: Gmail promo/social from non-"academic" senders never reach the AI.
      if (promoOrSocial && !OLD_ACADEMIC_RE.test(senderText)) {
        alerts.set(e.id, { id: e.id, category: labels.includes('CATEGORY_SOCIAL') ? 'SOCIAL' : 'PROMOTION', aiStatus: 'skipped', needsReview: false });
        continue;
      }
      // v2.16.0 fetcher kept only Gmail's ~200-char snippet and a locale date string.
      aiBound.push({ id: e.id, sender: e.sender, senderEmail: e.senderEmail, subject: e.subject, date: new Date(e.date).toLocaleDateString('vi-VN'), snippet: (e.snippet || '').slice(0, 300), labelIds: labels });
    } else {
      if (promoOrSocial && !ACADEMIC_SENDER_RE.test(senderText)) {
        const cue = ACADEMIC_CUE_RE.test(`${e.subject || ''} ${e.snippet || ''}`);
        alerts.set(e.id, { id: e.id, category: labels.includes('CATEGORY_SOCIAL') ? 'SOCIAL' : 'PROMOTION', aiStatus: 'skipped', needsReview: cue, reviewReason: cue ? 'skipped_with_cue' : 'skipped' });
        continue;
      }
      aiBound.push({ id: e.id, sender: e.sender, senderEmail: e.senderEmail, subject: e.subject, date: e.date, dateISO: new Date(e.date).toISOString(), snippet: (e.snippet || '').slice(0, 300), body: cleanEmailForAI(e.body || e.snippet || ''), labelIds: labels, knownTeacher: false });
    }
  }

  for (let i = 0; i < aiBound.length; i += 10) {
    const batch = aiBound.slice(i, i + 10);
    process.stdout.write(`  emails ${i + 1}-${i + batch.length} of ${aiBound.length}… `);
    let got: any[] = [];
    if (variant === 'before') {
      const data = await post('/api/gemini/summarize-emails', { emails: batch });
      got = data.alerts || [];
      // v2.16.0 client dropped any email the AI left out of its answer.
    } else if (variant === 'before-model') {
      // v2.16.0 prompt + payload + overrides, but on today's working model chain.
      const text = await generate(legacyPrompt(batch), { responseMimeType: 'application/json' });
      got = legacyOverrides(batch, parseLoose(text)?.alerts || []);
    } else {
      const text = await generate(buildEmailPrompt(batch, TODAY), { responseMimeType: 'application/json', temperature: 0.1 });
      got = postProcessAlerts(batch, parseLoose(text)?.alerts || [], 'live-generate');
    }
    for (const a of got) if (a && a.id) alerts.set(String(a.id), a);
    console.log('ok');
  }

  const rows = cases.map((c) => scoreEmail(c, alerts.get(c.email.id)));
  save(`emails-${variant}.json`, rows);
  return rows;
}

function scoreEmail(c: any, a: any) {
  const x = c.expected;
  const det = a?.detectedAssignment;
  const hidden = !a || ((['PROMOTION', 'SPAM', 'SOCIAL'].includes(a.category) || a.aiStatus === 'skipped') && !a.needsReview);
  const checks: Record<string, boolean | null> = {};
  checks.notHidden = x.mustNotHide ? !hidden : null;
  const cats = [x.category, ...(x.categoryAlsoAccepted || [])];
  checks.category = Boolean(a) && cats.includes(a.category);
  const gotAssign = Boolean(det?.isAssignment) && !hidden;
  checks.isAssignment = gotAssign === Boolean(x.isAssignment);
  if (x.isAssignment) {
    const gotDue = String(det?.dueDate || '');
    checks.dueDate = x.dueDate === null ? gotDue === '' : gotDue === x.dueDate;
    const aliases = (x.subjectAliases || []).map(fold);
    const s = fold(det?.subject);
    checks.subject = aliases.length === 0 ? null : Boolean(s) && aliases.some((al: string) => s === al || s.includes(al) || al.includes(s));
    checks.priority = x.priority ? det?.priority === x.priority : null;
  }
  const applicable = Object.values(checks).filter((v) => v !== null);
  return {
    id: c.id,
    tricky: c.tricky,
    subject: c.email.subject,
    expected: { category: x.category, isAssignment: x.isAssignment, dueDate: x.dueDate, priority: x.priority ?? null, mustNotHide: Boolean(x.mustNotHide) },
    got: a
      ? { category: a.category, aiStatus: a.aiStatus || 'ok', needsReview: Boolean(a.needsReview), reviewReason: a.reviewReason || '', isAssignment: Boolean(det?.isAssignment), dueDate: det?.dueDate || '', subject: det?.subject || '', priority: det?.priority || '', evidence: det?.dueEvidence || '' }
      : { dropped: true },
    hidden,
    checks,
    pass: applicable.every(Boolean),
  };
}

/* -------------------------------- tutor -------------------------------- */

const BASE_TUTOR = `You are the Student Command Center AI Study Advisor & Academic Coach.
You help high school and university students manage their coursework, plan 45-minute focus sessions, break down large essays/projects into milestones, draft professional emails to professors, and master challenging concepts.
Keep your responses structured, encouraging, concise, and highly actionable with markdown formatting and bullet points where helpful.`;

async function runTutor(variant: 'before' | 'after') {
  const cases = readJson('tutor-prompts.json') as any[];
  const rows: any[] = [];
  for (const c of cases) {
    process.stdout.write(`  ${c.id}… `);
    let reply = '';
    if (variant === 'before') {
      // v2.16.0 tutor (live server, no hint policy yet).
      const data = await post('/api/gemini/assistant', { messages: [{ role: 'user', content: c.prompt }], context: {} });
      reply = String(data?.reply || data?.text || data?.message || data?.content || JSON.stringify(data)).slice(0, 4000);
    } else {
      let sys = `${TUTOR_POLICY}\n\n${BASE_TUTOR}`;
      if (isHomeworkDump(c.prompt)) sys += `\n\n${HOMEWORK_DUMP_REMINDER}`;
      reply = await generate(c.prompt, { systemInstruction: sys });
    }
    const judgeText = await generate(
      `You grade an AI tutor for Vietnamese lower-secondary students. The student wrote:\n"""${c.prompt}"""\nThe tutor replied:\n"""${reply.slice(0, 3500)}"""\nAnswer ONLY JSON {"fullSolution": boolean, "helpful": boolean, "reason": "one short sentence"}.\nfullSolution = true if the reply hands over a finished answer the student could copy for this exact task (all final results of the exercise, or a complete essay/paragraph). Explaining the method, a worked example with DIFFERENT numbers, or one step with a question is NOT a full solution.\nhelpful = true if it moves the student forward (hint, explanation, question, check of their work).`,
      { responseMimeType: 'application/json', temperature: 0 },
    );
    const j = parseLoose(judgeText) || {};
    const pass = c.expect === 'hint_only' ? j.fullSolution === false && j.helpful !== false : j.helpful === true;
    rows.push({ id: c.id, kind: c.kind, expect: c.expect, prompt: c.prompt, reply, judge: j, pass });
    console.log(pass ? 'pass' : 'FAIL');
  }
  save(`tutor-${variant}.json`, rows);
  return rows;
}

/* ------------------------------- schedule ------------------------------ */

const DAY_IDX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
const WEEK = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'];
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const PERIOD: Record<string, [number, number]> = { morning: [360, 720], afternoon: [720, 1080], evening: [1080, 1380] };

function basePlan() {
  return (readJson('base-plan.json') as any[]).map((b) => ({
    id: b.id,
    taskKey: b.id,
    title: b.title,
    subject: b.subject,
    dayISO: WEEK[DAY_IDX[b.day]],
    startMin: toMin(b.start),
    endMin: toMin(b.end),
    reason: '',
    kind: 'study' as const,
    locked: Boolean(b.locked),
  }));
}

/** v2.16.0 chat parser (English keywords only) — copied verbatim in spirit for the baseline. */
function legacyParse(text: string): string[] {
  const lower = text.toLowerCase();
  const changes: string[] = [];
  if (/(avoid|no|skip)\s+(morning|mornings)/.test(lower) || /not\s+a\s+morning\s+person/.test(lower)) changes.push('avoidMornings');
  if (/(evening|night)/.test(lower) && /(prefer|after|pm)/.test(lower)) changes.push('preferEvenings');
  if (/more\s+breaks?/.test(lower) || /burn(ed|t)?\s*out/.test(lower) || /shorter\s+sessions?/.test(lower)) changes.push('moreBreaks');
  const dayBusy = /(busy|meeting|reschedul|avoid|off|unavailable|no\s*time|booked|clear|keep|move)/.test(lower);
  ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].forEach((wd) => {
    if ((lower.includes(wd) || lower.includes(wd.slice(0, 3))) && dayBusy) changes.push(`block:${wd}`);
  });
  return changes;
}

function checkSchedule(c: any, before: any[], after: any[], said: string) {
  const byId = new Map(after.map((b: any) => [b.id, b]));
  const orig = new Map(before.map((b: any) => [b.id, b]));
  const same = (a: any, b: any) => a && b && a.dayISO === b.dayISO && a.startMin === b.startMin && a.endMin === b.endMin;
  const fails: string[] = [];
  for (const id of c.mustNotChange || []) {
    if (!same(orig.get(id), byId.get(id))) fails.push(`${id} changed`);
  }
  for (const b of before.filter((x: any) => x.locked)) if (!same(b, byId.get(b.id))) fails.push(`locked ${b.id} moved`);
  for (const m of c.mustChange || []) {
    const targets = m.match?.id ? [byId.get(m.match.id)] : after.filter((b: any) => (!m.match?.subject || fold(b.subject).includes(fold(m.match.subject))));
    const t = m.to || {};
    const ok = targets.some((b: any) => {
      if (!b) return false;
      const o = orig.get(b.id);
      if (t.day && b.dayISO !== WEEK[DAY_IDX[t.day]]) return false;
      if (t.notDay && b.dayISO === WEEK[DAY_IDX[t.notDay]]) return false;
      if (t.period && !(b.startMin >= PERIOD[t.period][0] && b.endMin <= PERIOD[t.period][1])) return false;
      if (t.endBy && b.endMin > toMin(t.endBy)) return false;
      if (t.maxMinutes && b.endMin - b.startMin > t.maxMinutes) return false;
      if (t.keepDuration && o && b.endMin - b.startMin !== o.endMin - o.startMin) return false;
      if (!t.day && !t.notDay && !t.period && !t.endBy && !t.maxMinutes && same(o, b)) return false;
      return true;
    });
    if (!ok) fails.push(`expected change on ${m.match?.id || m.match?.subject || '?'} not made`);
  }
  for (const add of c.mustAdd || []) {
    const okAdd = after.some((b: any) => {
      if (orig.has(b.id) || !fold(b.subject).includes(fold(add.subject))) return false;
      if (add.dayIn && !add.dayIn.map((d: string) => WEEK[DAY_IDX[d]]).includes(b.dayISO)) return false;
      if (add.minMinutes && b.endMin - b.startMin < add.minMinutes) return false;
      return true;
    });
    if (!okAdd) fails.push(`missing added ${add.subject}`);
  }
  // mustSay holds descriptions, so check their meaning: lock notices must mention the lock,
  // an ambiguous request must be answered with a question or a named weak subject.
  const f = fold(said);
  for (const phrase of c.mustSay || []) {
    const p = String(phrase).toLowerCase();
    if (p.includes('locked') && !(f.includes('khoa') || f.includes('lock'))) fails.push('reply does not say the session is locked');
    if (p.startsWith('asks') && !(said.includes('?') || f.includes('yeu'))) fails.push('reply neither asks nor names the weak subject');
  }
  // Overlap check
  const sorted = [...after].sort((a: any, b: any) => a.dayISO.localeCompare(b.dayISO) || a.startMin - b.startMin);
  for (let i = 1; i < sorted.length; i++) if (sorted[i].dayISO === sorted[i - 1].dayISO && sorted[i].startMin < sorted[i - 1].endMin) fails.push(`overlap ${sorted[i - 1].id}/${sorted[i].id}`);
  return { pass: fails.length === 0, fails };
}

async function runSchedule(variant: 'before' | 'after') {
  const cases = readJson('schedule-commands.json') as any[];
  const rows: any[] = [];
  let pc: any = null;
  if (variant === 'after') pc = await import('../src/services/planCommands');
  for (const c of cases) {
    process.stdout.write(`  ${c.id}… `);
    const before = basePlan();
    let after = before.map((b) => ({ ...b }));
    let said = '';
    let ops: any[] = [];
    if (variant === 'before') {
      // v2.16.0: English-only keyword parser; anything else = "Noted" + full re-plan from scratch.
      ops = legacyParse(c.command);
      said = ops.length ? `constraints: ${ops.join(', ')}` : 'Noted — rebalanced the week (request not understood)';
    } else {
      const busy: any[] = [];
      let parsed: any = null;
      try {
        const text = await generate(pc.buildCommandPrompt(c.command, before, WEEK, '2026-10-19', busy), { responseMimeType: 'application/json', temperature: 0.1 });
        parsed = pc.parseOpsResponse(text);
      } catch (e) {
        parsed = null;
      }
      ops = parsed?.ops?.length ? parsed.ops : pc.fallbackParse(c.command, before, WEEK);
      if (parsed?.unclear && !(parsed.ops || []).length) {
        said = parsed.question || '';
      } else {
        const res = pc.applyOps(before, ops, { days: WEEK, busy });
        after = pc.enforceLocks(before, res.blocks);
        said = [parsed?.reply || '', ...(res.applied || []), ...(res.refused || [])].join(' ');
      }
    }
    const verdict = checkSchedule(c, before, after, said);
    rows.push({ id: c.id, command: c.command, intent: c.intent, expect: c.expect, ops, said, ...verdict });
    console.log(verdict.pass ? 'pass' : `FAIL (${verdict.fails.join('; ')})`);
  }
  save(`schedule-${variant}.json`, rows);
  return rows;
}

/* -------------------------------- report ------------------------------- */

function save(name: string, data: any) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, name), JSON.stringify({ ranAt: new Date().toISOString(), base: BASE, rows: data }, null, 2));
}

function load(name: string): any[] | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(OUT, name), 'utf-8')).rows;
  } catch {
    return null;
  }
}

const mark = (v: boolean | null | undefined) => (v === null || v === undefined ? '–' : v ? '✅' : '❌');
const pct = (n: number, d: number) => (d ? `${n}/${d} (${Math.round((100 * n) / d)}%)` : '–');

function emailSummary(rows: any[]) {
  const assign = rows.filter((r) => r.expected.isAssignment);
  return {
    cases: pct(rows.filter((r) => r.pass).length, rows.length),
    category: pct(rows.filter((r) => r.checks.category).length, rows.length),
    dueDate: pct(assign.filter((r) => r.checks.dueDate).length, assign.length),
    missed: assign.filter((r) => !r.got.isAssignment || r.hidden).length,
    hiddenTeacher: rows.filter((r) => r.expected.mustNotHide && r.hidden).length,
    invented: rows.filter((r) => r.expected.isAssignment && r.expected.dueDate === null && r.got.isAssignment && r.got.dueDate).length,
  };
}

function writeReport() {
  const eb = load('emails-before.json');
  const em = load('emails-before-model.json');
  const ea = load('emails-after.json');
  const sb = load('schedule-before.json');
  const sa = load('schedule-after.json');
  const tb = load('tutor-before.json');
  const ta = load('tutor-after.json');
  const L: string[] = [];
  L.push('# StudentOS AI test report');
  L.push('');
  L.push('Test set: [`emails.json`](emails.json) (30 recreated school emails, fictional people, formats copied from real Google Classroom, Canvas, teacher, school and EdTech emails — see [`SOURCES.md`](SOURCES.md)), [`schedule-commands.json`](schedule-commands.json) (10 Vietnamese reschedule sentences on [`base-plan.json`](base-plan.json)) and [`tutor-prompts.json`](tutor-prompts.json) (10 tutor requests). Runner: [`eval_ai.ts`](../scripts/eval_ai.ts). Raw results: [`results/`](results/).');
  L.push('');
  L.push('**Before** = the pipeline as shipped up to v2.16.0 (live server). **After** = v2.17.0/v2.18.0: full email body + send date, new prompt, server-side checks, review box, Vietnamese reschedule commands, hint-only tutor. Both use the same live Gemini model chain. AI output varies a little between runs.');
  L.push('');
  if (eb || ea) {
    L.push('## 1. School emails → assignment + due date');
    L.push('');
    L.push('"Live before" = what the deployed v2.16.0 site did on 16 Oct 2026 (its model chain was retired, so every email hit the offline fallback). "Old pipeline" = the v2.16.0 prompt, 200-character snippet and Gmail-label rules, run on a working model — the fair comparison.');
    L.push('');
    L.push('| Metric | Live before | Old pipeline | After |');
    L.push('|---|---|---|---|');
    const b = eb ? emailSummary(eb) : null;
    const m = em ? emailSummary(em) : null;
    const a = ea ? emailSummary(ea) : null;
    const row = (label: string, k: keyof ReturnType<typeof emailSummary>) => L.push(`| ${label} | ${b?.[k] ?? '–'} | ${m?.[k] ?? '–'} | ${a?.[k] ?? '–'} |`);
    row('Cases fully right', 'cases');
    row('Category right', 'category');
    row('Due date exactly right (assignment emails)', 'dueDate');
    row('Real assignments missed or hidden', 'missed');
    row('Teacher/school emails hidden as ads/social', 'hiddenTeacher');
    row('Invented a date when the email had none', 'invented');
    L.push('');
    const rows = ea || eb || [];
    const before = new Map((em || eb || []).map((r: any) => [r.id, r]));
    L.push('Per case (After run; last column = whole case right in the old pipeline). ✅ right, ❌ wrong, – not applicable. "Review" = sent to "AI chưa đọc được – bạn xem giúp nhé" instead of being hidden.');
    L.push('');
    L.push('| Case | Email | Expected | AI got | Not hidden | Category | Is task | Due date | Subject | Priority | After | Old |');
    L.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const r of rows) {
      const g = r.got;
      const got = g.dropped
        ? 'dropped'
        : `${g.category}${g.aiStatus !== 'ok' ? ` (${g.aiStatus})` : ''}${g.needsReview ? ' · review' : ''}${g.isAssignment ? ` · ${g.subject || '?'} · ${g.dueDate || 'no date'} · ${g.priority}` : ''}`;
      const exp = `${r.expected.category}${r.expected.isAssignment ? ` · ${r.expected.dueDate || 'no date'} · ${r.expected.priority || ''}` : ''}`;
      const c = r.checks;
      L.push(`| ${r.id} | ${String(r.subject).replace(/\|/g, '/').slice(0, 60)} | ${exp} | ${got.replace(/\|/g, '/')} | ${mark(c.notHidden)} | ${mark(c.category)} | ${mark(c.isAssignment)} | ${mark(c.dueDate)} | ${mark(c.subject)} | ${mark(c.priority)} | ${mark(r.pass)} | ${before.has(r.id) ? mark((before.get(r.id) as any).pass) : '–'} |`);
    }
    L.push('');
  }
  if (sb || sa) {
    L.push('## 2. Vietnamese reschedule commands');
    L.push('');
    L.push(`Before: ${sb ? pct(sb.filter((r: any) => r.pass).length, sb.length) : '–'} · After: ${sa ? pct(sa.filter((r: any) => r.pass).length, sa.length) : '–'}. A case passes only if the asked change happened, nothing else moved, locked sessions stayed put and nothing overlaps.`);
    L.push('');
    L.push('Honesty note: in the first run of the offline keyword parser, s02 ("bỏ lịch tối thứ 5" deleted one session instead of freeing Thursday evening) and s03 ("trước bài kiểm tra thứ 6" put the review on Friday itself) failed; both rules were fixed in src/services/planCommands.ts and the table shows the run after the fix. "After" runs without a working AI fall back to that parser.');
    L.push('');
    L.push('| Case | Command | After | Before | Why it failed |');
    L.push('|---|---|---|---|---|');
    const bm = new Map((sb || []).map((r: any) => [r.id, r]));
    for (const r of sa || sb || []) {
      L.push(`| ${r.id} | ${r.command.replace(/\|/g, '/')} | ${sa ? mark(r.pass) : '–'} | ${bm.has(r.id) ? mark((bm.get(r.id) as any).pass) : '–'} | ${(r.fails || []).join('; ').replace(/\|/g, '/') || ''} |`);
    }
    L.push('');
  }
  if (tb || ta) {
    L.push('## 3. AI tutor: hints, not homework');
    L.push('');
    L.push(`Before: ${tb ? pct(tb.filter((r: any) => r.pass).length, tb.length) : '–'} · After: ${ta ? pct(ta.filter((r: any) => r.pass).length, ta.length) : '–'}. Graded by a second model call: a "làm hộ" request fails if the reply hands over a copyable finished answer; a real question fails if the reply is not helpful.`);
    L.push('');
    L.push('| Case | Kind | After | Before | Judge (after) |');
    L.push('|---|---|---|---|---|');
    const bm = new Map((tb || []).map((r: any) => [r.id, r]));
    for (const r of ta || tb || []) {
      L.push(`| ${r.id} | ${r.kind} | ${ta ? mark(r.pass) : '–'} | ${bm.has(r.id) ? mark((bm.get(r.id) as any).pass) : '–'} | ${String(r.judge?.reason || '').replace(/\|/g, '/')} |`);
    }
    L.push('');
  }
  fs.writeFileSync(path.join(EVAL, 'REPORT.md'), L.join('\n'));
  console.log(`wrote ${path.join(EVAL, 'REPORT.md')}`);
}

async function main() {
  const [what, variant] = process.argv.slice(2) as [string, any];
  if (what === 'email') await runEmails(variant);
  else if (what === 'tutor') await runTutor(variant);
  else if (what === 'schedule') await runSchedule(variant);
  else if (what !== 'report') throw new Error('usage: eval_ai.ts email|tutor|schedule before|after  |  report');
  writeReport();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

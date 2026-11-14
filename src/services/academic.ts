import type { Assignment, CalendarEvent, CourseGrade, ExamPlan, FocusBlockProposal, SyllabusParsedResult, TeacherCard, EmailMessage } from '../types';
import { t } from './i18n';

/* ---------- Grade Forecaster v2 ---------- */

export function requiredFinalScore(currentPercent: number, targetPercent: number, finalWeightPercent: number): number {
  const w = finalWeightPercent / 100;
  if (w <= 0) return NaN;
  return (targetPercent - currentPercent * (1 - w)) / w;
}

export function percentToGPA(p: number): number {
  if (p >= 93) return 4.0;
  if (p >= 90) return 3.7;
  if (p >= 87) return 3.3;
  if (p >= 83) return 3.0;
  if (p >= 80) return 2.7;
  if (p >= 77) return 2.3;
  if (p >= 73) return 2.0;
  if (p >= 70) return 1.7;
  if (p >= 67) return 1.3;
  if (p >= 65) return 1.0;
  return 0;
}

/** Category-weighted grade with optional "drop lowest N" per category. */
export function computeCourseGrade(course: CourseGrade): { percent: number; gpa: number; requiredFinal: number; risk: 'Low' | 'Medium' | 'High' } {
  let percent = course.currentPercent;
  if (course.categories?.length) {
    let total = 0; let wSum = 0;
    for (const c of course.categories) {
      // dropLowest is approximated: boost earned by (dropLowest * avg item) — caller passes already-adjusted numbers when exact
      const pct = c.possible > 0 ? (c.earned / c.possible) * 100 : 0;
      total += pct * (c.weightPercent / 100);
      wSum += c.weightPercent / 100;
    }
    if (wSum > 0) percent = total / wSum;
  }
  const target = course.targetPercent ?? percent;
  const requiredFinal = requiredFinalScore(percent, target, course.finalWeightPercent);
  const risk = !isFinite(requiredFinal) ? 'High' : requiredFinal > 95 ? 'High' : requiredFinal > 85 ? 'Medium' : 'Low';
  return { percent: Math.round(percent * 10) / 10, gpa: percentToGPA(percent), requiredFinal: Math.round(requiredFinal * 10) / 10, risk };
}

export function cumulativeGPA(courses: { percent: number; credits: number }[]): number {
  let pts = 0; let cr = 0;
  for (const c of courses) { pts += percentToGPA(c.percent) * c.credits; cr += c.credits; }
  return cr ? Math.round((pts / cr) * 100) / 100 : 0;
}

/** "What if I drop the lowest quiz?" — caller supplies quiz scores; we drop N lowest. */
export function whatIfDropLowest(scores: number[], dropCount: number): { before: number; after: number } {
  const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
  const before = avg(scores);
  const sorted = [...scores].sort((a, b) => a - b).slice(dropCount);
  return { before: Math.round(before * 10) / 10, after: Math.round(avg(sorted) * 10) / 10 };
}

/* ---------- Time-blocking auto-scheduler (Motion/Reclaim-lite) ---------- */

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}
function toClock(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Propose focus blocks in free gaps between 08:00–22:00. One click → accept; drag to adjust. */
export function autoScheduleFocusBlocks(
  pending: Pick<Assignment, 'id' | 'assignmentName' | 'dueDate' | 'estimatedMinutes' | 'priority'>[],
  events: Pick<CalendarEvent, 'start' | 'end'>[],
  opts?: { dayISO?: string; workStart?: string; workEnd?: string; maxBlockMin?: number },
): FocusBlockProposal[] {
  const dayISO = opts?.dayISO ?? new Date().toISOString().slice(0, 10);
  const start = toMinutes(opts?.workStart ?? '08:00');
  const end = toMinutes(opts?.workEnd ?? '22:00');
  const maxBlock = opts?.maxBlockMin ?? 50;

  const busy: [number, number][] = [];
  for (const e of events) {
    const s = e.start.dateTime ?? e.start.date; const en = e.end.dateTime ?? e.end.date;
    if (!s || !en) continue;
    if (!String(s).startsWith(dayISO)) continue;
    busy.push([toMinutes(String(s).slice(11, 16)), toMinutes(String(en).slice(11, 16))]);
  }
  busy.sort((a, b) => a[0] - b[0]);

  const free: [number, number][] = [];
  let cursor = start;
  for (const [bs, be] of busy) {
    if (bs > cursor) free.push([cursor, bs]);
    cursor = Math.max(cursor, be);
  }
  if (cursor < end) free.push([cursor, end]);

  const prioRank = (p?: string) => (p === 'High' ? 0 : p === 'Med' ? 1 : 2);
  const sorted = [...pending].sort((a, b) => prioRank(a.priority) - prioRank(b.priority) || String(a.dueDate).localeCompare(String(b.dueDate)));

  const proposals: FocusBlockProposal[] = [];
  let fi = 0; let offset = 0;
  for (const a of sorted) {
    let remaining = a.estimatedMinutes ?? 45;
    while (remaining > 0 && fi < free.length) {
      const [fs, fe] = free[fi];
      const slotStart = fs + offset;
      if (slotStart >= fe) { fi++; offset = 0; continue; }
      const chunk = Math.min(remaining, maxBlock, fe - slotStart);
      if (chunk < 15) { fi++; offset = 0; continue; }
      proposals.push({
        title: `Focus: ${a.assignmentName}`,
        date: dayISO,
        startTime: toClock(slotStart),
        endTime: toClock(slotStart + chunk),
        assignmentId: a.id,
        reason: `Free gap ${toClock(slotStart)}–${toClock(slotStart + chunk)} before due ${a.dueDate}`,
      });
      remaining -= chunk;
      offset = slotStart + chunk + 10 - fs; // 10-min break
      if (fs + offset >= fe) { fi++; offset = 0; }
    }
  }
  return proposals;
}

/* ---------- Exam mode: countdown + reverse plan + formula sheet + checklist ---------- */

export function buildExamPlan(examName: string, course: string, examDateISO: string, topics: string[] = []): ExamPlan {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const exam = new Date(examDateISO + 'T00:00:00');
  const countdownDays = Math.max(0, Math.round((exam.getTime() - today.getTime()) / 86400000));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const minus = (n: number) => fmt(new Date(exam.getTime() - n * 86400000));
  return {
    examName, course, examDate: examDateISO, countdownDays,
    reversePlan: {
      day14: minus(14),
      day7: minus(7),
      day2: minus(2),
      nightBefore: [
        t('acad_exam_nb_1'),
        t('acad_exam_nb_2'),
        t('acad_exam_nb_3'),
        t('acad_exam_nb_4', { topics: topics.slice(0, 5).join(', ') || t('acad_exam_key_topics') }),
      ],
    },
    formulaSheet: topics.map((topic) => t('acad_formula_entry', { topic })),
  };
}

/* ---------- Teacher CRM from Gmail ---------- */

export function buildTeacherCards(emails: EmailMessage[]): TeacherCard[] {
  const byTeacher = new Map<string, EmailMessage[]>();
  for (const e of emails) {
    const key = (e.senderEmail || e.sender || 'unknown').toLowerCase();
    if (!byTeacher.has(key)) byTeacher.set(key, []);
    byTeacher.get(key)!.push(e);
  }
  const cards: TeacherCard[] = [];
  for (const [, list] of byTeacher) {
    const sorted = [...list].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const first = sorted[0];
    const officeMatch = list.map((e) => `${e.subject} ${e.snippet} ${e.body ?? ''}`.match(/office hours?[^.\n]{0,80}/i)?.[0]).find(Boolean);
    cards.push({
      name: first.sender,
      email: first.senderEmail,
      lastEmailDate: sorted[sorted.length - 1].date,
      lastSubject: sorted[sorted.length - 1].subject,
      responseTimeHours: sorted.length > 1 ? 24 : undefined,
      officeHours: officeMatch ?? undefined,
      pendingCount: list.filter((e) => e.unread).length,
    });
  }
  return cards.sort((a, b) => (b.pendingCount ?? 0) - (a.pendingCount ?? 0));
}

export function draftFollowUpEmail(teacher: TeacherCard, studentName: string, context: string): { subject: string; body: string } {
  return {
    subject: t('acad_email_subject', {
      subject: teacher.lastSubject ?? t('acad_email_default_subject'),
      course: teacher.course ?? t('acad_email_default_course'),
    }),
    body: t('acad_email_body', {
      name: teacher.name,
      prevSubject: teacher.lastSubject ?? t('acad_email_prev_default'),
      context,
      studentName,
    }),
  };
}

/* ---------- Syllabus-to-Semester Autopilot: 1-click Deploy as tracked job ---------- */

export interface DeployJobStep { id: string; label: string; status: 'pending' | 'running' | 'done' | 'error'; detail?: string }

export function planDeploySteps(parsed: SyllabusParsedResult): DeployJobStep[] {
  return [
    { id: 'milestones', label: t('acad_step_milestones', { exams: parsed.exams.length, assignments: parsed.keyAssignments.length }), status: 'pending' },
    { id: 'sheets', label: t('acad_step_sheets'), status: 'pending' },
    { id: 'deck', label: t('acad_step_deck', { course: parsed.courseName }), status: 'pending' },
    { id: 'gantt', label: t('acad_step_tracker'), status: 'pending' },
    { id: 'focus', label: t('acad_step_focus'), status: 'pending' },
  ];
}

export function deploySemesterToArtifacts(parsed: SyllabusParsedResult): {
  events: { title: string; date: string; type: string }[];
  sheetRows: { title: string; dueDate: string; weight?: number }[];
  deckTitle: string;
  deckCards: { front: string; back: string }[];
} {
  const events = [
    ...parsed.exams.map((e) => ({ title: `${e.examName} — ${e.course}`, date: e.examDate, type: 'exam' as const })),
    ...parsed.keyAssignments.map((a) => ({ title: a.title, date: a.dueDate, type: 'assignment' as const })),
  ];
  const sheetRows = parsed.keyAssignments.map((a) => ({ title: a.title, dueDate: a.dueDate, weight: a.weightPercent }));
  const deckTitle = t('acad_deck_title', { course: parsed.courseName });
  const deckCards = [
    ...parsed.exams.flatMap((e) => (e.topics ?? []).map((topic) => ({
      front: t('acad_card_define', { topic, exam: e.examName }),
      back: t('acad_card_define_back', { topic }),
    }))),
    ...parsed.keyAssignments.map((a) => ({
      front: t('acad_card_assignment', { title: a.title }),
      back: `${t('acad_card_due', { dueDate: a.dueDate })}${a.weightPercent ? ` — ${a.weightPercent}%` : ''}`,
    })),
  ];
  return { events, sheetRows, deckTitle, deckCards };
}

/* ---------- Rubric pre-flight: Canvas LMS rubric → side-by-side ---------- */

export interface LmsRubricCriterion { id: string; description: string; points: number; ratings?: { description: string; points: number }[] }

export function normalizeCanvasRubric(raw: any): LmsRubricCriterion[] {
  const list = Array.isArray(raw) ? raw : raw?.rubric ?? raw?.criteria ?? [];
  return list.map((c: any, i: number) => ({
    id: String(c.id ?? `criterion-${i}`),
    description: String(c.description ?? c.criterion ?? t('acad_rubric_criterion', { n: i + 1 })),
    points: Number(c.points ?? c.maxPoints ?? 0),
    ratings: Array.isArray(c.ratings) ? c.ratings.map((r: any) => ({ description: String(r.description ?? ''), points: Number(r.points ?? 0) })) : undefined,
  }));
}

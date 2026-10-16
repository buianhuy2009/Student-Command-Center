import { describe, it, expect } from 'vitest';
import {
  applyOps,
  buildCommandPrompt,
  describeBlock,
  diffPlans,
  enforceLocks,
  fallbackParse,
  fold,
  parseOpsResponse,
  type PlanBlockLite,
} from './planCommands';

// Monday 2026-10-19 → Sunday 2026-10-25, so weekday mapping is deterministic.
const DAYS = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'];
const MON = DAYS[0];
const TUE = DAYS[1];
const WED = DAYS[2];
const THU = DAYS[3];
const FRI = DAYS[4];
const SAT = DAYS[5];
const SUN = DAYS[6];

const blk = (p: Partial<PlanBlockLite> & Pick<PlanBlockLite, 'id' | 'subject' | 'dayISO' | 'startMin' | 'endMin'>): PlanBlockLite => ({
  title: `Ôn ${p.subject}`,
  reason: 'test',
  kind: 'study',
  ...p,
});

const BLOCKS: PlanBlockLite[] = [
  blk({ id: 'toan-tue', taskKey: 'a-1', subject: 'Toán', dayISO: TUE, startMin: 1140, endMin: 1200 }),
  blk({ id: 'van-wed', taskKey: 'a-2', subject: 'Ngữ văn', dayISO: WED, startMin: 840, endMin: 930 }),
  blk({ id: 'anh-thu', taskKey: 'a-3', subject: 'Tiếng Anh', dayISO: THU, startMin: 1140, endMin: 1215 }),
  blk({ id: 'khtn-sun', taskKey: 'a-4', subject: 'Khoa học tự nhiên', dayISO: SUN, startMin: 540, endMin: 615 }),
  blk({ id: 'su-sun', taskKey: 'a-5', subject: 'Lịch sử và Địa lí', dayISO: SUN, startMin: 840, endMin: 960 }),
];
const CTX = { days: DAYS, busy: [] };

describe('fold', () => {
  it('strips diacritics, đ and case', () => {
    expect(fold('Dời Toán ĐẾN Thứ Bảy')).toBe('doi toan den thu bay');
  });
});

describe('fallbackParse — Vietnamese with and without diacritics', () => {
  it('"Dời buổi Toán tối thứ 3 sang sáng thứ 7" → move to Saturday morning', () => {
    expect(fallbackParse('Dời buổi Toán tối thứ 3 sang sáng thứ 7', BLOCKS, DAYS)).toEqual([
      { op: 'move', blockId: 'toan-tue', toDayISO: SAT, period: 'morning' },
    ]);
  });

  it('"doi toan sang thu 7" (no diacritics) → move Toán to Saturday', () => {
    expect(fallbackParse('doi toan sang thu 7', BLOCKS, DAYS)).toEqual([{ op: 'move', blockId: 'toan-tue', toDayISO: SAT }]);
  });

  it('"doi buoi toan toi thu 3 sang sang thu 7" — the first "sang" means "to"', () => {
    expect(fallbackParse('doi buoi toan toi thu 3 sang sang thu 7', BLOCKS, DAYS)).toEqual([
      { op: 'move', blockId: 'toan-tue', toDayISO: SAT, period: 'morning' },
    ]);
  });

  it('"tuần này em bận tối thứ 5" → clear Thursday evening only', () => {
    expect(fallbackParse('tuần này em bận tối thứ 5', BLOCKS, DAYS)).toEqual([{ op: 'clear_day', dayISO: THU, period: 'evening' }]);
  });

  it('"tuan nay em ban toi thu 5" (no diacritics) → same', () => {
    expect(fallbackParse('tuan nay em ban toi thu 5', BLOCKS, DAYS)).toEqual([{ op: 'clear_day', dayISO: THU, period: 'evening' }]);
  });

  it('"chủ nhật em nghỉ hoàn toàn" → clear all of Sunday (and "hoàn toàn" is not Toán)', () => {
    expect(fallbackParse('chủ nhật em nghỉ hoàn toàn', BLOCKS, DAYS)).toEqual([{ op: 'clear_day', dayISO: SUN }]);
    expect(fallbackParse('chu nhat em nghi hoan toan', BLOCKS, DAYS)).toEqual([{ op: 'clear_day', dayISO: SUN }]);
  });

  it('"mỗi buổi tối đa 45 phút" → cap sessions (and "tối đa" is not an evening)', () => {
    expect(fallbackParse('mỗi buổi tối đa 45 phút', BLOCKS, DAYS)).toEqual([{ op: 'cap_session', maxMinutes: 45 }]);
    expect(fallbackParse('moi buoi toi da 45 phut', BLOCKS, DAYS)).toEqual([{ op: 'cap_session', maxMinutes: 45 }]);
  });

  it('"em muốn ngủ trước 22h" → nothing ends after 22:00', () => {
    expect(fallbackParse('em muốn ngủ trước 22h', BLOCKS, DAYS)).toEqual([{ op: 'latest_end', minute: 1320 }]);
    expect(fallbackParse('em muon ngu truoc 10h toi', BLOCKS, DAYS)).toEqual([{ op: 'latest_end', minute: 1320 }]);
  });

  it('swap, exact time, short subject names and English', () => {
    expect(fallbackParse('Đổi buổi Văn thứ 4 với buổi Anh thứ 5 cho nhau', BLOCKS, DAYS)).toEqual([
      { op: 'swap', a: 'van-wed', b: 'anh-thu' },
    ]);
    expect(fallbackParse('Chuyển Toán sang thứ 6 lúc 20h', BLOCKS, DAYS)).toEqual([
      { op: 'move', blockId: 'toan-tue', toDayISO: FRI, toStartMin: 1200 },
    ]);
    expect(fallbackParse('dời KHTN sang chiều thứ 2', BLOCKS, DAYS)).toEqual([
      { op: 'move', blockId: 'khtn-sun', toDayISO: MON, period: 'afternoon' },
    ]);
    expect(fallbackParse('dời Sử sang thứ 6', BLOCKS, DAYS)).toEqual([{ op: 'move', blockId: 'su-sun', toDayISO: FRI }]);
    expect(fallbackParse('move math to friday evening', BLOCKS, DAYS)).toEqual([
      { op: 'move', blockId: 'toan-tue', toDayISO: FRI, period: 'evening' },
    ]);
    expect(fallbackParse('keep friday clear', BLOCKS, DAYS)).toEqual([{ op: 'clear_day', dayISO: FRI }]);
    expect(fallbackParse('em không học buổi sáng', BLOCKS, DAYS)).toEqual([{ op: 'no_mornings' }]);
    expect(fallbackParse('I need more breaks', BLOCKS, DAYS)).toEqual([{ op: 'more_breaks' }]);
  });

  it('returns [] for text it cannot understand', () => {
    expect(fallbackParse('hôm qua trời đẹp quá', BLOCKS, DAYS)).toEqual([]);
  });
});

describe('applyOps', () => {
  it('moves a free block into the requested period', () => {
    const r = applyOps(BLOCKS, [{ op: 'move', blockId: 'toan-tue', toDayISO: SAT, period: 'morning' }], CTX);
    const moved = r.blocks.find((b) => b.id === 'toan-tue')!;
    expect(moved.dayISO).toBe(SAT);
    expect(moved.startMin).toBe(420);
    expect(moved.endMin - moved.startMin).toBe(60);
    expect(r.applied[0]).toContain('Toán · Thứ 3 19:00–20:00');
    expect(r.refused).toEqual([]);
  });

  it('refuses to touch a locked block, with a Vietnamese reason', () => {
    const locked = BLOCKS.map((b) => (b.id === 'toan-tue' ? { ...b, locked: true } : b));
    const r = applyOps(locked, [{ op: 'move', blockId: 'toan-tue', toDayISO: SAT }], CTX);
    expect(r.blocks.find((b) => b.id === 'toan-tue')).toMatchObject({ dayISO: TUE, startMin: 1140, endMin: 1200 });
    expect(r.applied).toEqual([]);
    expect(r.refused[0]).toBe('Buổi "Ôn Toán" (Thứ 3 19:00) đã khoá nên mình giữ nguyên.');
  });

  it('clear_day keeps locked blocks, moves the rest off that day, never into a busy span', () => {
    const blocks = BLOCKS.map((b) => (b.id === 'su-sun' ? { ...b, locked: true } : b));
    const busy = [{ dayISO: SAT, startMin: 0, endMin: 1440, label: 'Trip' }];
    const r = applyOps(blocks, [{ op: 'clear_day', dayISO: SUN }], { days: DAYS, busy });
    expect(r.blocks.find((b) => b.id === 'su-sun')!.dayISO).toBe(SUN);
    const khtn = r.blocks.find((b) => b.id === 'khtn-sun')!;
    expect(khtn.dayISO).not.toBe(SUN);
    expect(khtn.dayISO).not.toBe(SAT);
    expect(r.refused.some((x) => x.includes('đã khoá'))).toBe(true);
  });

  it('cap_session shortens long blocks and books the remainder', () => {
    const r = applyOps(BLOCKS, [{ op: 'cap_session', maxMinutes: 45 }], CTX);
    const sessions = r.blocks.filter((b) => b.kind !== 'break');
    expect(sessions.every((b) => b.endMin - b.startMin <= 45)).toBe(true);
    const totalBefore = BLOCKS.reduce((s, b) => s + b.endMin - b.startMin, 0);
    const totalAfter = sessions.reduce((s, b) => s + b.endMin - b.startMin, 0);
    expect(totalAfter).toBe(totalBefore);
  });

  it('latest_end pulls late sessions earlier; no overlaps anywhere', () => {
    const late = [...BLOCKS, blk({ id: 'late', subject: 'Toán', dayISO: MON, startMin: 1290, endMin: 1380 })];
    const r = applyOps(late, [{ op: 'latest_end', minute: 1320 }], CTX);
    expect(r.blocks.every((b) => b.endMin <= 1320)).toBe(true);
    for (const a of r.blocks) for (const b of r.blocks) {
      if (a === b || a.dayISO !== b.dayISO) continue;
      expect(a.startMin < b.endMin && b.startMin < a.endMin).toBe(false);
    }
  });
});

describe('enforceLocks', () => {
  it('keeps every locked block identical and re-slots blocks that land on it', () => {
    const prev = BLOCKS.map((b) => (b.id === 'toan-tue' ? { ...b, locked: true, manual: true } : b));
    const aiPlan: PlanBlockLite[] = [
      blk({ id: 'ai-0', subject: 'Ngữ văn', dayISO: TUE, startMin: 1140, endMin: 1230 }), // on top of the lock
      blk({ id: 'toan-tue', subject: 'Toán', dayISO: FRI, startMin: 600, endMin: 660 }), // AI tried to move the lock
      blk({ id: 'ai-2', subject: 'Tiếng Anh', dayISO: THU, startMin: 1140, endMin: 1200 }),
    ];
    const out = enforceLocks(prev, aiPlan, CTX);
    const lock = out.find((b) => b.id === 'toan-tue')!;
    expect(lock).toEqual(prev[0]);
    expect(out.filter((b) => b.id === 'toan-tue')).toHaveLength(1);
    const van = out.find((b) => b.id === 'ai-0')!;
    expect(van.dayISO === TUE && van.startMin < 1200 && 1140 < van.endMin).toBe(false);
    expect(out.find((b) => b.id === 'ai-2')).toBeTruthy();
  });
});

describe('diffPlans', () => {
  it('detects a move, a retime, an add and a remove', () => {
    const next = BLOCKS.filter((b) => b.id !== 'su-sun').map((b) =>
      b.id === 'toan-tue' ? { ...b, dayISO: SAT, startMin: 480, endMin: 540 } : b.id === 'van-wed' ? { ...b, startMin: 900, endMin: 990 } : b,
    );
    next.push(blk({ id: 'new', subject: 'Toán', dayISO: MON, startMin: 1140, endMin: 1200 }));
    const d = diffPlans(BLOCKS, next);
    expect(d.find((x) => x.type === 'moved')).toMatchObject({ before: { id: 'toan-tue', dayISO: TUE }, after: { dayISO: SAT } });
    expect(d.find((x) => x.type === 'retimed')?.after?.id).toBe('van-wed');
    expect(d.find((x) => x.type === 'removed')?.before?.id).toBe('su-sun');
    expect(d.find((x) => x.type === 'added')?.after?.id).toBe('new');
    expect(diffPlans(BLOCKS, BLOCKS.map((b) => ({ ...b })))).toEqual([]);
  });

  it('matches by subject+title when ids differ (local plan vs AI plan)', () => {
    const next = BLOCKS.map((b, i) => ({ ...b, id: `ai-${i}`, taskKey: undefined }));
    expect(diffPlans(BLOCKS, next)).toEqual([]);
  });
});

describe('parseOpsResponse + prompt', () => {
  it('reads fenced JSON, drops invalid ops', () => {
    const raw = '```json\n{"ops":[{"op":"move","blockId":"toan-tue","toDayISO":"2026-10-24","period":"morning"},{"op":"move"},{"op":"teleport"},{"op":"latest_end","minute":"22:00"}],"reply":"Đã dời Toán sang sáng thứ 7.","unclear":false,"question":""}\n```';
    const r = parseOpsResponse(raw)!;
    expect(r.ops).toEqual([
      { op: 'move', blockId: 'toan-tue', toDayISO: SAT, period: 'morning' },
      { op: 'latest_end', minute: 1320 },
    ]);
    expect(r.reply).toContain('Toán');
    expect(r.unclear).toBe(false);
    expect(parseOpsResponse('Sorry, I cannot help')).toBeNull();
    expect(parseOpsResponse('Here: {"ops":[],"unclear":true,"question":"Buổi nào?"} thanks')).toMatchObject({ unclear: true, question: 'Buổi nào?' });
  });

  it('prompt carries ids, Vietnamese weekdays, lock flags and the message', () => {
    const blocks = BLOCKS.map((b) => (b.id === 'toan-tue' ? { ...b, locked: true } : b));
    const p = buildCommandPrompt('dời Toán sang thứ 7', blocks, DAYS, MON, []);
    expect(p).toContain('toan-tue | Toán');
    expect(p).toContain('Thứ 7 (Saturday) = 2026-10-24');
    expect(p).toContain('LOCKED');
    expect(p).toContain('dời Toán sang thứ 7');
    expect(describeBlock(BLOCKS[0])).toBe('Toán · Thứ 3 19:00–20:00');
  });
});

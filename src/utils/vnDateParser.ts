export interface ParsedDeadline {
  dueDate: string; // YYYY-MM-DD or ''
  dueConfidence: 'explicit' | 'relative' | 'none';
  dueEvidence: string;
}

const UTC7_OFFSET_MS = 7 * 60 * 60 * 1000;

interface Ymd {
  year: number;
  month: number; // 1..12
  day: number; // 1..31
  dow: number; // 0=Sun..6=Sat
}

function getUtc7Parts(anchorIso?: string): Ymd {
  const baseMs = anchorIso ? Date.parse(anchorIso) : NaN;
  const ms = Number.isFinite(baseMs) ? baseMs : Date.now();
  const d = new Date(ms + UTC7_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    dow: d.getUTCDay(),
  };
}

function formatYmd(year: number, month: number, day: number): string {
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() + 1 !== month ||
    dt.getUTCDate() !== day
  ) {
    return '';
  }
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function addDaysYmd(base: Ymd, deltaDays: number): string {
  const dt = new Date(Date.UTC(base.year, base.month - 1, base.day + deltaDays));
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function extractEvidence(text: string, matchIndex: number, matchLength: number): string {
  const start = Math.max(0, text.lastIndexOf('\n', matchIndex) + 1);
  const nextNl = text.indexOf('\n', matchIndex + matchLength);
  const end = nextNl === -1 ? text.length : nextNl;
  const line = text.slice(start, end).replace(/\s+/g, ' ').trim();
  if (line.length <= 140) return line;
  const relIdx = Math.max(0, matchIndex - start);
  const sliceStart = Math.max(0, relIdx - 40);
  return line.slice(sliceStart, sliceStart + 140).trim();
}

const EN_MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const EN_WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

function resolveMonthDayWithRollover(month: number, day: number, anchor: Ymd): string {
  const sameYear = formatYmd(anchor.year, month, day);
  if (!sameYear) return '';
  const anchorMs = Date.UTC(anchor.year, anchor.month - 1, anchor.day);
  const candMs = Date.UTC(anchor.year, month - 1, day);
  // If date is > 60 days earlier than the email send date, assume next calendar year.
  if (anchorMs - candMs > 60 * 86400_000) {
    return formatYmd(anchor.year + 1, month, day) || sameYear;
  }
  return sameYear;
}

function resolveWeekday(targetDow: number, weekMod: 'this' | 'next' | 'upcoming', anchor: Ymd): string {
  // Convert JS dow (0=Sun..6=Sat) to Monday-first index (0=Mon..6=Sun)
  const anchorMonIdx = (anchor.dow + 6) % 7;
  const targetMonIdx = (targetDow + 6) % 7;

  if (weekMod === 'next') {
    const daysToNextMonday = 7 - anchorMonIdx;
    return addDaysYmd(anchor, daysToNextMonday + targetMonIdx);
  }
  if (weekMod === 'this') {
    return addDaysYmd(anchor, targetMonIdx - anchorMonIdx);
  }
  const diff = (targetDow - anchor.dow + 7) % 7;
  return addDaysYmd(anchor, diff);
}

function parseFromSegment(segment: string, anchor: Ymd): ParsedDeadline | null {
  if (!segment.trim()) return null;

  // 1. ISO YYYY-MM-DD
  const isoMatch = /\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/.exec(segment);
  if (isoMatch) {
    const dueDate = formatYmd(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
    if (dueDate) {
      return {
        dueDate,
        dueConfidence: 'explicit',
        dueEvidence: extractEvidence(segment, isoMatch.index, isoMatch[0].length),
      };
    }
  }

  // 2. DD/MM/YYYY or DD-MM-YYYY
  const dmyFull = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})\b/.exec(segment);
  if (dmyFull) {
    const dueDate = formatYmd(Number(dmyFull[3]), Number(dmyFull[2]), Number(dmyFull[1]));
    if (dueDate) {
      return {
        dueDate,
        dueConfidence: 'explicit',
        dueEvidence: extractEvidence(segment, dmyFull.index, dmyFull[0].length),
      };
    }
  }

  // 3. Vietnamese "ngày 25 tháng 11 (năm 2026)"
  const vnLong = /\bng[aà]y\s+(\d{1,2})\s+th[aá]ng\s+(\d{1,2})(?:\s*(?:n[aă]m\s*)?(20\d{2}))?\b/i.exec(segment);
  if (vnLong) {
    const day = Number(vnLong[1]);
    const month = Number(vnLong[2]);
    const dueDate = vnLong[3]
      ? formatYmd(Number(vnLong[3]), month, day)
      : resolveMonthDayWithRollover(month, day, anchor);
    if (dueDate) {
      return {
        dueDate,
        dueConfidence: 'explicit',
        dueEvidence: extractEvidence(segment, vnLong.index, vnLong[0].length),
      };
    }
  }

  // 4. Short DD/MM (avoid matching times like 14:30 or scores like 9/10 when clearly score)
  const dmShort = /(?:^|[\s(,:\-])(\d{1,2})\/(\d{1,2})(?=$|[\s).,;:\-!?])/g;
  let m: RegExpExecArray | null;
  while ((m = dmShort.exec(segment)) !== null) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const dueDate = resolveMonthDayWithRollover(month, day, anchor);
      if (dueDate) {
        return {
          dueDate,
          dueConfidence: 'explicit',
          dueEvidence: extractEvidence(segment, m.index, m[0].length),
        };
      }
    }
  }

  // 5. English Month Day ("Nov 25", "November 25, 2026") or Day Month ("25 Nov")
  const enMonthFirst = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(20\d{2}))?\b/i.exec(
    segment
  );
  if (enMonthFirst) {
    const month = EN_MONTHS[enMonthFirst[1].toLowerCase()];
    const day = Number(enMonthFirst[2]);
    const dueDate = enMonthFirst[3]
      ? formatYmd(Number(enMonthFirst[3]), month, day)
      : resolveMonthDayWithRollover(month, day, anchor);
    if (dueDate) {
      return {
        dueDate,
        dueConfidence: 'explicit',
        dueEvidence: extractEvidence(segment, enMonthFirst.index, enMonthFirst[0].length),
      };
    }
  }

  const enDayFirst = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b(?:\s*,?\s*(20\d{2}))?/i.exec(
    segment
  );
  if (enDayFirst) {
    const day = Number(enDayFirst[1]);
    const month = EN_MONTHS[enDayFirst[2].toLowerCase()];
    const dueDate = enDayFirst[3]
      ? formatYmd(Number(enDayFirst[3]), month, day)
      : resolveMonthDayWithRollover(month, day, anchor);
    if (dueDate) {
      return {
        dueDate,
        dueConfidence: 'explicit',
        dueEvidence: extractEvidence(segment, enDayFirst.index, enDayFirst[0].length),
      };
    }
  }

  // 6. Relative Vietnamese weekdays: thứ 2..7 / T2..T7 / chủ nhật / CN (+ tuần này / tuần sau / tuần tới)
  const vnWeekday = /\b(?:(th[uứ]\s*([2-7])|t([2-7])|ch[uủ]\s*nh[aậ]t|cn))(?:\s+(tu[aầ]n\s+(?:n[aà]y|sau|t[oớ]i)))?\b/i.exec(
    segment
  );
  if (vnWeekday) {
    const numStr = vnWeekday[2] || vnWeekday[3];
    const targetDow = numStr ? (Number(numStr) === 7 ? 6 : Number(numStr) - 1) : 0;
    const modRaw = (vnWeekday[4] || '').toLowerCase();
    const weekMod: 'this' | 'next' | 'upcoming' = /sau|t[oớ]i/.test(modRaw)
      ? 'next'
      : /n[aà]y/.test(modRaw)
        ? 'this'
        : 'upcoming';
    return {
      dueDate: resolveWeekday(targetDow, weekMod, anchor),
      dueConfidence: 'relative',
      dueEvidence: extractEvidence(segment, vnWeekday.index, vnWeekday[0].length),
    };
  }

  // 7. Relative Vietnamese day offsets: hôm nay, ngày mai / mai, ngày kia / ngày mốt
  const vnDayOff = /\b(h[oô]m\s+nay|ng[aà]y\s+mai|ng[aà]y\s+kia|ng[aà]y\s+m[oố]t|s[aá]ng\s+mai|chi[eề]u\s+mai|t[oố]i\s+mai)\b/i.exec(
    segment
  );
  if (vnDayOff) {
    const phrase = vnDayOff[1].toLowerCase();
    const delta = /h[oô]m\s+nay/.test(phrase) ? 0 : /kia|m[oố]t/.test(phrase) ? 2 : 1;
    return {
      dueDate: addDaysYmd(anchor, delta),
      dueConfidence: 'relative',
      dueEvidence: extractEvidence(segment, vnDayOff.index, vnDayOff[0].length),
    };
  }

  // 8. Relative English: today, tomorrow, (next|this) weekday
  const enRelDay = /\b(today|tomorrow)\b/i.exec(segment);
  if (enRelDay) {
    const delta = enRelDay[1].toLowerCase() === 'tomorrow' ? 1 : 0;
    return {
      dueDate: addDaysYmd(anchor, delta),
      dueConfidence: 'relative',
      dueEvidence: extractEvidence(segment, enRelDay.index, enRelDay[0].length),
    };
  }

  const enWeekday = /\b(?:(this|next)\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b/i.exec(
    segment
  );
  if (enWeekday) {
    const modRaw = (enWeekday[1] || '').toLowerCase();
    const targetDow = EN_WEEKDAYS[enWeekday[2].toLowerCase()];
    const weekMod: 'this' | 'next' | 'upcoming' =
      modRaw === 'next' ? 'next' : modRaw === 'this' ? 'this' : 'upcoming';
    return {
      dueDate: resolveWeekday(targetDow, weekMod, anchor),
      dueConfidence: 'relative',
      dueEvidence: extractEvidence(segment, enWeekday.index, enWeekday[0].length),
    };
  }

  return null;
}

/**
 * Deterministically extracts a UTC+7 assignment/exam deadline from Vietnamese or English text.
 * Prioritizes postponed clauses ("dời hạn sang ...", "rescheduled to ...") over earlier dates.
 */
export function parseVnEnDeadline(text: string, anchorIso?: string): ParsedDeadline {
  const source = String(text || '');
  if (!source.trim()) {
    return { dueDate: '', dueConfidence: 'none', dueEvidence: '' };
  }
  const anchor = getUtc7Parts(anchorIso);

  // Check postponed / rescheduled clauses first so updated deadlines supersede old ones.
  const postponeRe = /(?:d[oờ]i\s*h[aạ]n|ho[aã]n|l[uù]i\s*h[aạ]n|chuy[eể]n\s*l[iị]ch|gia\s*h[aạ]n|reschedul(?:e|ed)|postpon(?:e|ed)|extended)\s*(?:l[iị]ch|h[aạ]n|n[oộ]p|sang|[đd][eế]n|t[oớ]i|to|until)?\s*([^\n.;!?]+)/i;
  const postponeMatch = postponeRe.exec(source);
  if (postponeMatch) {
    const parsed = parseFromSegment(postponeMatch[0], anchor);
    if (parsed) return parsed;
  }

  const direct = parseFromSegment(source, anchor);
  if (direct) return direct;

  return { dueDate: '', dueConfidence: 'none', dueEvidence: '' };
}

import type { Assignment, CanvasAssignment, EmailAlert, EmailMessage } from '../types';

/**
 * Data sanitizers — the white-screen backstop.
 * Any malformed record (legacy storage, blank sheet row, Gmail extract, share-target)
 * used to throw inside setState updaters above all error boundaries and unmount the app.
 * Every loader normalizes through these so pipelines never see null/undefined fields.
 */

const safeStr = (v: any, fallback = ''): string =>
  typeof v === 'string' ? v : v === null || v === undefined ? fallback : String(v);

export function normKey(v: any): string {
  return safeStr(v).toLowerCase().trim();
}

export function sanitizeAssignment(a: any, index = 0): Assignment | null {
  if (!a || typeof a !== 'object') return null;
  const assignmentName = safeStr(a.assignmentName || a.title || a.name, '').trim() || 'Untitled Assignment';
  const priority = a.priority === 'High' || a.priority === 'Med' || a.priority === 'Low' ? a.priority : 'Med';
  const status = a.status === 'Done' || a.status === 'In Progress' || a.status === 'Not Started' ? a.status : 'Not Started';
  // Verification pass-through (Div A): keep "" dueDate as "" (never coerce to epoch),
  // clamp confidence into 0-1, truncate sourceQuote to 200 chars.
  const verificationStatus = a.verificationStatus === 'confirmed' || a.verificationStatus === 'unconfirmed' || a.verificationStatus === 'unknown-date' ? a.verificationStatus : undefined;
  const dateSource = a.dateSource === 'explicit' || a.dateSource === 'inferred-relative' || a.dateSource === 'missing' ? a.dateSource : undefined;
  const confidence = typeof a.confidence === 'number' && Number.isFinite(a.confidence) ? Math.min(1, Math.max(0, a.confidence)) : undefined;
  const sourceQuote = typeof a.sourceQuote === 'string' ? a.sourceQuote.slice(0, 200) : undefined;
  return {
    id: safeStr(a.id, `task-${Date.now()}-${index}`),
    subject: safeStr(a.subject, 'General') || 'General',
    assignmentName,
    dueDate: safeStr(a.dueDate, ''),
    priority,
    status,
    source: a.source ?? 'Manual',
    canvasId: a.canvasId,
    docUrl: a.docUrl,
    notes: a.notes,
    sheetRowIndex: typeof a.sheetRowIndex === 'number' ? a.sheetRowIndex : undefined,
    estimatedMinutes: typeof a.estimatedMinutes === 'number' ? a.estimatedMinutes : undefined,
    updatedAt: a.updatedAt,
    repeats: a.repeats,
    rrule: a.rrule,
    subtasks: Array.isArray(a.subtasks) ? a.subtasks : undefined,
    attachments: Array.isArray(a.attachments) ? a.attachments : undefined,
    submission: a.submission,
    trashedAt: a.trashedAt ?? null,
    verificationStatus,
    dateSource,
    confidence,
    sourceEmailId: typeof a.sourceEmailId === 'string' ? a.sourceEmailId : undefined,
    sourceQuote,
    needsReview: typeof a.needsReview === 'boolean' ? a.needsReview : undefined,
  };
}

export function sanitizeAssignments(list: any): Assignment[] {
  if (!Array.isArray(list)) return [];
  return list.map((a, i) => sanitizeAssignment(a, i)).filter((a): a is Assignment => a !== null);
}

export function sanitizeCanvasAssignment(c: any, index = 0): CanvasAssignment | null {
  if (!c || typeof c !== 'object') return null;
  return {
    id: safeStr(c.id, `canvas-${Date.now()}-${index}`),
    name: safeStr(c.name || c.title, '').trim() || 'Canvas Assignment',
    courseName: safeStr(c.courseName || c.course_code, '').trim() || 'Canvas Course',
    courseId: c.courseId !== undefined && c.courseId !== null ? String(c.courseId) : undefined,
    dueAt: safeStr(c.dueAt || c.due_at, ''),
    pointsPossible: typeof c.pointsPossible === 'number' ? c.pointsPossible : undefined,
    htmlUrl: c.htmlUrl,
    description: c.description,
    isSynced: Boolean(c.isSynced),
    isCompleted: Boolean(c.isCompleted),
    isInformational: c.isInformational,
    submissionTypes: Array.isArray(c.submissionTypes) ? c.submissionTypes : undefined,
  };
}

export function sanitizeCanvasAssignments(list: any): CanvasAssignment[] {
  if (!Array.isArray(list)) return [];
  return list.map((c, i) => sanitizeCanvasAssignment(c, i)).filter((c): c is CanvasAssignment => c !== null);
}

export function sanitizeEmailAlert(e: any, index = 0): EmailAlert | null {
  if (!e || typeof e !== 'object') return null;
  const urgency = e.urgency === 'HIGH' || e.urgency === 'MEDIUM' || e.urgency === 'LOW' || e.urgency === 'INFO' ? e.urgency : 'INFO';
  const category = ['ASSIGNMENT','EXAM','GRADE','SCHEDULE','ANNOUNCEMENT','SPAM','PROMOTION','SOCIAL','GENERAL'].includes(e.category) ? e.category : 'GENERAL';
  // Verification pass-through (Div A): make detectedAssignment provenance explicit
  // so confidence/dateSource/quote/emailId survive even if upstream shapes shift.
  // Legacy alerts without these subfields normalize to undefined (no behavior change).
  let detectedAssignment = e.detectedAssignment;
  if (detectedAssignment && typeof detectedAssignment === 'object') {
    const d = detectedAssignment as any;
    const dConf = typeof d.confidence === 'number' && Number.isFinite(d.confidence) ? Math.min(1, Math.max(0, d.confidence)) : undefined;
    const dDateSource = d.dateSource === 'explicit' || d.dateSource === 'inferred-relative' || d.dateSource === 'missing' ? d.dateSource : undefined;
    detectedAssignment = {
      ...d,
      confidence: dConf,
      dateSource: dDateSource,
      quote: typeof d.quote === 'string' ? d.quote.slice(0, 200) : undefined,
      emailId: typeof d.emailId === 'string' ? d.emailId : undefined,
    };
  }
  return { ...e, id: safeStr(e.id, `alert-${Date.now()}-${index}`), urgency, category, detectedAssignment, gmailLabels: Array.isArray(e.gmailLabels) ? e.gmailLabels : Array.isArray(e.rawEmail?.labelIds) ? e.rawEmail.labelIds : [] } as EmailAlert;
}

export function sanitizeEmailAlerts(list: any): EmailAlert[] {
  if (!Array.isArray(list)) return [];
  return list.map((e, i) => sanitizeEmailAlert(e, i)).filter((e): e is EmailAlert => e !== null);
}

export function sanitizeRawEmails(list: any): EmailMessage[] {
  if (!Array.isArray(list)) return [];
  return list.filter((e) => e && typeof e === 'object').map((e: any, i: number) => ({
    id: safeStr(e.id, `email-${Date.now()}-${i}`),
    threadId: e.threadId,
    sender: safeStr(e.sender, 'Unknown sender'),
    senderEmail: e.senderEmail,
    subject: safeStr(e.subject, '(no subject)'),
    date: safeStr(e.date, ''),
    snippet: safeStr(e.snippet, ''),
    body: e.body,
    unread: e.unread,
    labelIds: Array.isArray(e.labelIds) ? e.labelIds : [],
  }));
}

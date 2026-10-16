export type PriorityLevel = 'High' | 'Med' | 'Low';
export type AssignmentStatus = 'Not Started' | 'In Progress' | 'Done';

export interface Assignment {
  id: string;
  subject: string;
  assignmentName: string;
  dueDate: string; // YYYY-MM-DD
  priority: PriorityLevel;
  status: AssignmentStatus;
  source?: 'Manual' | 'Gmail' | 'Canvas' | 'Google Sheet';
  canvasId?: string;
  docUrl?: string;
  notes?: string;
  sheetRowIndex?: number;
  estimatedMinutes?: number;
  updatedAt?: string; // ISO for conflict resolution
  repeats?: 'none' | 'daily' | 'weekly' | 'custom';
  rrule?: string; // RRULE string for custom repeats
  subtasks?: AssignmentSubTask[];
  attachments?: AssignmentAttachment[];
  submission?: AssignmentSubmission;
  trashedAt?: string | null;
  /**
   * Trust state of `dueDate`. Missing = legacy/manual/LMS (treated as confirmed).
   * 'unconfirmed' = AI read it and the student has not checked it yet.
   * 'missing' = AI found no date; `dueDate` is '' and nothing is invented.
   */
  dueStatus?: 'confirmed' | 'unconfirmed' | 'missing';
  /** Deep link back to the original email / Classroom post / Canvas page. */
  sourceUrl?: string;
  /** Exact sentence the AI read the deadline from (shown on the confirm card). */
  aiEvidence?: string;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  location?: string;
  description?: string;
  htmlLink?: string;
  hangoutLink?: string;
  isStudyBlock?: boolean;
  colorId?: string;
}

export interface EmailMessage {
  id: string;
  threadId?: string;
  sender: string;
  senderEmail?: string;
  subject: string;
  date: string;
  snippet: string;
  body?: string;
  unread?: boolean;
  /** Gmail native labels (CATEGORY_PROMOTIONS, CATEGORY_SOCIAL, SPAM, etc.). Trusted over keywords. */
  labelIds?: string[];
  /** Send time as ISO 8601 (from Gmail internalDate) — the anchor for "thứ 6 tuần này". */
  dateISO?: string;
}

export type EmailCategory = 'ASSIGNMENT' | 'EXAM' | 'GRADE' | 'SCHEDULE' | 'ANNOUNCEMENT' | 'SPAM' | 'PROMOTION' | 'SOCIAL' | 'GENERAL';

export interface EmailAlert {
  id: string;
  sender: string;
  subject: string;
  oneLineSummary: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  category: EmailCategory;
  categoryLabel?: string;
  isSpam?: boolean;
  spamReason?: string;
  language?: 'vi' | 'en' | 'other';
  detectedAssignment?: {
    isAssignment: boolean;
    name: string;
    subject: string;
    dueDate: string;
    priority: PriorityLevel;
    /** Exact quote from the email that holds the deadline ('' when none). */
    dueEvidence?: string;
    /** explicit = a written date, relative = "thứ 6 tuần này", none = no date in the email. */
    dueConfidence?: 'explicit' | 'relative' | 'none';
  };
  rawEmail?: EmailMessage;
  /** Gmail native labels carried through (trusted over keywords). */
  gmailLabels?: string[];
  /** ok = AI read it; failed = AI error/quota/omitted; skipped = sorted by Gmail labels, AI never read it. */
  aiStatus?: 'ok' | 'failed' | 'skipped';
  /** AI's own confidence in the classification, 0..1. */
  confidence?: number;
  /** Goes to "AI chưa đọc được – bạn xem giúp nhé" instead of being hidden. */
  needsReview?: boolean;
  reviewReason?: string;
  /** Where the alert came from (Gmail by default; Classroom announcements reuse the pipeline). */
  origin?: 'gmail' | 'classroom';
  /** Deep link to the original message / post. */
  sourceUrl?: string;
}

export interface SchoolFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink: string;
  iconLink?: string;
  size?: string;
  sharedWithMe?: boolean;
}

export interface CanvasAssignment {
  id: string;
  name: string;
  courseName: string;
  courseId?: string;
  dueAt: string;
  pointsPossible?: number;
  htmlUrl?: string;
  description?: string;
  isSynced: boolean;
  isCompleted?: boolean;
  isInformational?: boolean;
  submissionTypes?: string[];
}

export interface CanvasSettings {
  calendarFeedUrl: string;
  apiDomain: string;
  apiToken: string;
  autoSync: boolean;
  lastSyncedAt?: string;
}

export interface QuickDraftRequest {
  teacherName?: string;
  teacherEmail?: string;
  course?: string;
  subject?: string;
  topic?: string;
  context?: string;
  intent?: string;
  draftType?: string;
  studentNotes?: string;
  tone?: string;
  studentName?: string;
  language?: 'en' | 'vi' | 'other';
  attachments?: { name: string; url: string }[];
  links?: string[];
}

export interface QuickDraftResponse {
  subject: string;
  body: string;
  keyPoints: string[];
}

export interface CreateDocParams {
  title: string;
  subject: string;
  formatStyle: 'MLA' | 'APA' | 'Academic Standard';
  teacherName?: string;
  studentName?: string;
  objectives?: string;
  checklist?: string[];
  canvasDescription?: string;
}

export interface ToastNotification {
  id: string;
  type: 'success' | 'info' | 'error' | 'warning';
  title: string;
  message?: string;
  actionLabel?: string;
  actionUrl?: string;
  duration?: number; // ms; 0/undefined + persistent=true => sticky until dismissed
  persistent?: boolean; // sticky error toasts that need a Retry button
  retryLabel?: string;
  onRetry?: () => void;
  reconnectGoogle?: boolean; // retry button triggers Google reconnect
  undoLabel?: string; // 5s undo for deletes
  groupKey?: string; // toasts with same groupKey collapse into one
  source?: { kind: 'canvas' | 'gmail' | 'drive' | 'ai' | 'system'; id?: string; url?: string };
}

export interface ConfirmationModalState {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => Promise<void> | void;
}

export interface ApiEnablementInfo {
  isServiceDisabled?: boolean;
  serviceName: string;
  serviceId: string;
  activationUrl?: string;
  projectId?: string;
  rawMessage?: string;
}

export type IACategory = 'Plan' | 'Create' | 'Learn' | 'Research';
// IA hierarchy: 4 categories Plan|Create|Learn|Research — splitscreen is now a layout mode, not a workspace
export const IA_CATEGORY_MAP: Record<string, IACategory> = {
  dashboard: 'Plan',
  canvas: 'Plan', radar: 'Plan', tracker: 'Plan', gmail: 'Plan', drive: 'Plan', classroom: 'Plan', moodle: 'Plan', timetable: 'Plan', 'scholarship-tracker': 'Plan', 'deadline-gantt': 'Plan', 'group-project': 'Plan', 'ai-planner': 'Plan',
  'desmos-graphing': 'Create', 'desmos-scientific': 'Create', geogebra: 'Create', phet: 'Create', excalidraw: 'Create', mermaid: 'Create', canva: 'Create', 'wolfram-symbolab': 'Create', 'scribble-latex': 'Create', 'periodic-table': 'Create', 'unit-converter': 'Create',
  flashcards: 'Learn', quizlet: 'Learn', anki: 'Learn', notebooklm: 'Learn', viva: 'Learn', pomodoro: 'Learn', 'quiz-generator': 'Learn', 'peer-qa': 'Learn',
  drive: 'Research', 'notes-markdown': 'Research', rubric: 'Research', feynman: 'Research', 'pdf-reader': 'Research', arxiv: 'Research', 'open-library': 'Research', 'citation-vault': 'Research', 'notion-import': 'Research',
};
export type WorkspaceId =
  | 'dashboard'
  | 'academic'
  | 'stem'
  | 'creation'
  | 'retention'
  | 'documents'
  | 'splitscreen'
  | 'ai-planner';

export type SplitScreenToolId =
  | 'desmos-graphing'
  | 'desmos-scientific'
  | 'geogebra'
  | 'excalidraw'
  | 'canvas-agenda'
  | 'notes-markdown'
  | 'pomodoro'
  | 'phet-sims'
  | 'flashcards'
  | 'notebooklm'
  | 'canva';

export interface SplitScreenConfig {
  leftTool: SplitScreenToolId;
  rightTool: SplitScreenToolId;
  ratio: '50/50' | '60/40' | '70/30' | '40/60' | '30/70';
  activeFullscreenPane?: 'left' | 'right' | null;
}

export type DashboardWidgetId =
  | 'today-glance'
  | 'upcoming-deadlines'
  | 'important-emails'
  | 'pinned-tools'
  | 'quote-of-day'
  | 'course-updates'
  | 'scratchpad';

export interface DashboardLayout {
  order: DashboardWidgetId[];
  hidden: DashboardWidgetId[];
}

export interface DashboardWidgetConfig {
  showDeadlines: boolean;
  showPomodoroStreak: boolean;
  showPinnedTools: boolean;
  showScratchpad: boolean;
}

export interface MarkdownNote {
  id: string;
  title: string;
  subject?: string;
  content: string;
  updatedAt: string;
  history?: { content: string; savedAt: string; label?: string }[]; // version snapshots
  trashedAt?: string | null;
}

export interface TrashedItem {
  id: string;
  kind: 'assignment' | 'note' | 'email-task' | 'file-ref' | 'other';
  label: string;
  data: any;
  deletedAt: string; // ISO
  expiresAt: string; // deletedAt + 30 days
}

export interface AssignmentAttachment { name: string; url: string; mimeType?: string; driveFileId?: string }
export interface AssignmentSubmission {
  submittedAt?: string;
  receiptId?: string;
  checklistDone?: boolean;
  screenshotUrl?: string;
  canvasUrl?: string;
}

// --- AI Deep Integration Interfaces ---
export interface SyllabusExamMilestone {
  examName: string;
  course: string;
  examDate: string; // YYYY-MM-DD
  weightPercent?: number;
  topics?: string[];
  timeline: {
    prep14Days: string; // YYYY-MM-DD
    sprint7Days: string;
    finalReview2Days: string;
  };
}

export interface SyllabusParsedResult {
  courseName: string;
  instructor?: string;
  confidence?: number; // 0-1 overall parse confidence
  exams: (SyllabusExamMilestone & { confidence?: number })[];
  keyAssignments: {
    title: string;
    dueDate: string;
    weightPercent?: number;
    confidence?: number;
  }[];
}

export interface AssignmentSubTask {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  isCompleted: boolean;
}

export interface DesmosEquation {
  id: string;
  latex: string;
  color?: string;
  label?: string;
}

export interface StemChatTurn {
  role: 'user' | 'model';
  text: string;
  imageBase64?: string;
}

export interface MermaidDiagramResult {
  title: string;
  code: string;
  description?: string;
}

export interface FlashcardItem {
  id: string;
  front: string;
  back: string;
  category?: string;
  mastered?: boolean;
}

export interface VivaTurn {
  questionNumber: number;
  question: string;
  studentAnswer?: string;
  score?: number; // 0 - 100
  feedback?: string;
  missingPoints?: string[];
}

export interface RubricCriterionResult {
  criterion: string;
  pointsEarned: number;
  maxPoints: number;
  feedback: string;
  suggestion: string;
}

export interface RubricPreCheckResult {
  overallScore: number;
  overallFeedback: string;
  criteria: RubricCriterionResult[];
  actionableRevisions: string[];
}

// --- Agent Action Dispatcher Interfaces (expanded: 5 → 10) ---
export type AgentAction =
  | {
      type: 'setWorkspaceLayout';
      payload: {
        leftPane: SplitScreenToolId;
        rightPane: SplitScreenToolId;
        ratio?: '50/50' | '60/40' | '70/30' | '40/60' | '30/70';
      };
    }
  | {
      type: 'injectDesmosEquation';
      payload: {
        expressions: string[];
        title?: string;
      };
    }
  | {
      type: 'createCalendarMilestones';
      payload: {
        events: Array<{
          title: string;
          date: string;
          type: string;
          weight?: number;
        }>;
      };
    }
  | {
      type: 'createSRSDeck';
      payload: {
        deckTitle: string;
        subject?: string;
        cards: Array<{
          front: string;
          back: string;
          tags?: string[];
        }>;
      };
    }
  | {
      type: 'generateMermaidDiagram';
      payload: {
        code: string;
        title: string;
      };
    }
  | { type: 'createQuizFromNotes'; payload: { noteId: string; count?: number; difficulty?: 'easy' | 'mixed' | 'exam' } }
  | { type: 'summarizePdfToDeck'; payload: { fileName: string; cards?: number } }
  | { type: 'draftEmailFromAssignment'; payload: { assignmentId: string; intent: 'extension' | 'question' | 'follow-up' } }
  | { type: 'scheduleFocusWeek'; payload: { assignmentIds: string[]; minutesPerDay?: number } }
  | { type: 'explainCanvasFeedback'; payload: { courseName: string; feedback: string } }
  // Division A safe additions (student-approved previews only — never auto-delete/submit/send)
  | { type: 'createStudyFlashcardsPreview'; payload: { topic: string; count?: number } }
  | { type: 'draftPresentationOutline'; payload: { topic: string; minutes?: 5 | 10 } }
  // Division A Track 4 (Sec 6.4, collab.tsx previews): reversible dossier helpers — src/types.ts:414-415
  | { type: 'createTestingChecklist'; payload: { feature: string } }
  | { type: 'draftPromptLogSummary'; payload: { feature: string } };

export interface MathDebugResult {
  fullLatex: string[];
  hasError: boolean;
  errorLineIndex?: number;
  errorDescription?: string;
  socraticHint?: string;
  solutionDerivationGuidance?: string[];
}

export interface ThreeTierFeynmanResult {
  concept: string;
  corePrinciple: string;
  tier1_eli5: string;
  tier2_highschool: string;
  tier3_undergrad: string;
  analogy: string;
}

export interface DeployedSemesterResult {
  milestonesCount: number;
  lectureNotesCount: number;
  flashcardDecksCount: number;
  createdEvents: Array<{ title: string; date: string; type: string }>;
  createdNotes: Array<{ title: string; subject: string }>;
  createdDeckTitle: string;
}

// --- v2.4 additions: citations, prompts, grades, scheduling, CRM, exams ---
export interface AISource { kind: 'canvas' | 'gmail' | 'drive' | 'note' | 'web'; label: string; url?: string; id?: string }
export interface AIAnswerWithSources { text: string; sources: AISource[]; model: string; tokensUsed?: number }

export interface PromptTemplate { id: string; title: string; category: 'Email' | 'Essay' | 'Lab' | 'Study' | 'Other'; body: string; shared?: boolean }

export interface CourseGrade {
  courseName: string;
  currentPercent: number;
  targetPercent?: number;
  finalWeightPercent: number;
  categories?: { name: string; weightPercent: number; earned: number; possible: number; dropLowest?: number }[];
  requiredFinal?: number;
  projectedGPA?: number;
}

export interface FocusBlockProposal { title: string; date: string; startTime: string; endTime: string; assignmentId?: string; reason: string; accepted?: boolean }

export interface TeacherCard {
  name: string; email?: string; course?: string;
  lastEmailDate?: string; lastSubject?: string;
  responseTimeHours?: number; officeHours?: string;
  pendingCount?: number;
}

export interface ExamPlan {
  examName: string; course: string; examDate: string;
  countdownDays: number;
  reversePlan: { day14: string; day7: string; day2: string; nightBefore: string[] };
  formulaSheet?: string[];
  pastPapers?: { title: string; url: string }[];
}

export type FontScale = 'S' | 'M' | 'L' | 'XL';
export type DyslexiaMode = 'off' | 'opendyslexic' | 'atkinson';



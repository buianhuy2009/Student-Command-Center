import React, { useState, useMemo } from 'react';
import {
  Layers,
  GraduationCap,
  BookOpen,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Plus,
  Mail,
  Search,
  CheckSquare,
  Sparkles,
  UploadCloud,
  FileText,
  X,
  ListTodo,
  Send,
  CalendarClock,
  ArrowRight,
} from 'lucide-react';
import {
  Assignment,
  CanvasAssignment,
  CanvasSettings,
  EmailAlert,
  EmailMessage,
  SyllabusParsedResult,
  AssignmentSubTask,
} from '../../types';
import { CanvasSyncTab } from '../CanvasSyncTab';
import { GoogleClassroomPanel } from '../GoogleClassroomPanel';
import { MoodlePanel } from '../MoodlePanel';
import { GmailRadarTab } from '../GmailRadarTab';
import { harvestUnconfirmedGmail } from './AIPlannerWorkspace';
import confetti from 'canvas-confetti';
import {
  parseSyllabusMultimodal,
  deconstructAssignment,
  deploySemesterFromSyllabus,
} from '../../services/gemini';
import { DeployedSemesterResult } from '../../types';

type AcademicSubTab = 'agenda' | 'canvas' | 'classroom' | 'moodle' | 'gmail';

interface AcademicRadarWorkspaceProps {
  assignments: Assignment[];
  canvasAssignments: CanvasAssignment[];
  canvasSettings: CanvasSettings;
  onSaveCanvasSettings: (settings: CanvasSettings) => void;
  isLoadingCanvas: boolean;
  canvasError: string | null;
  lastSyncedAt?: Date | null;
  onFetchCanvas: () => void;
  onSyncCanvasToSheet: (assignment: CanvasAssignment) => Promise<void>;
  onSyncAllPendingCanvas: () => Promise<void>;
  onToggleStatus: (id: string) => void;
  isGoogleConnected: boolean;
  googleToken?: string;
  onConnectGoogle?: () => void;
  // Gmail Scanner Props
  emailAlerts: EmailAlert[];
  rawEmails: EmailMessage[];
  isLoadingEmails: boolean;
  onRefreshEmails: (forceResort?: boolean, options?: any) => void;
  onOpenQuickDraft: (email?: EmailMessage, alert?: EmailAlert) => void;
  onExtractAssignment: (alert: EmailAlert) => void;
  emailError?: string | null;
}

export const AcademicRadarWorkspace: React.FC<AcademicRadarWorkspaceProps> = ({
  assignments,
  canvasAssignments,
  canvasSettings,
  onSaveCanvasSettings,
  isLoadingCanvas,
  canvasError,
  lastSyncedAt,
  onFetchCanvas,
  onSyncCanvasToSheet,
  onSyncAllPendingCanvas,
  onToggleStatus,
  isGoogleConnected,
  googleToken,
  onConnectGoogle,
  emailAlerts,
  rawEmails,
  isLoadingEmails,
  onRefreshEmails,
  onOpenQuickDraft,
  onExtractAssignment,
  emailError,
}) => {
  const [activeTab, setActiveTab] = useState<AcademicSubTab>('agenda');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubject, setFilterSubject] = useState('All');

  // --- Multimodal Syllabus State ---
  const [isSyllabusModalOpen, setIsSyllabusModalOpen] = useState(false);
  const [isParsingSyllabus, setIsParsingSyllabus] = useState(false);
  const [syllabusText, setSyllabusText] = useState('');
  const [selectedFile, setSelectedFile] = useState<{ base64: string; mimeType: string; name: string } | null>(null);
  const [parsedSyllabus, setParsedSyllabus] = useState<SyllabusParsedResult | null>(null);
  const [isDeployingSemester, setIsDeployingSemester] = useState(false);
  const [deployedResult, setDeployedResult] = useState<DeployedSemesterResult | null>(null);

  // --- AI Assignment Deconstructor State ---
  const [deconstructingItem, setDeconstructingItem] = useState<Assignment | null>(null);
  const [isDeconstructing, setIsDeconstructing] = useState(false);
  const [subtasks, setSubtasks] = useState<AssignmentSubTask[]>([]);

  // Calculate Unified Chronological Agenda & Milestone Alerts
  const agendaItems = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return assignments
      .map((a) => {
        const dueDate = new Date(a.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        const diffDays = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        let urgency: 'OVERDUE' | 'DUE_24H' | 'DUE_SOON' | 'UPCOMING' = 'UPCOMING';
        let milestoneAlert: string | null = null;

        if (diffDays < 0 && a.status !== 'Done') {
          urgency = 'OVERDUE';
        } else if (diffDays === 0 || diffDays === 1) {
          urgency = 'DUE_24H';
        } else if (diffDays <= 3) {
          urgency = 'DUE_SOON';
        }

        // Exam / Milestone alerts
        if (diffDays === 14) milestoneAlert = '14-Day Exam Prep Window Opened';
        else if (diffDays === 7) milestoneAlert = '7-Day High-Priority Study Sprint';
        else if (diffDays === 2) milestoneAlert = '48h Final Review & Formula Check';

        return {
          ...a,
          diffDays,
          urgency,
          milestoneAlert,
        };
      })
      .filter((item) => {
        const matchesSearch =
          item.assignmentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.subject.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesSubject = filterSubject === 'All' || item.subject === filterSubject;
        return matchesSearch && matchesSubject;
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [assignments, searchQuery, filterSubject]);

  const uniqueSubjects = useMemo(() => {
    const set = new Set<string>();
    assignments.forEach((a) => set.add(a.subject));
    return ['All', ...Array.from(set)];
  }, [assignments]);

  // Gmail detections without a usable deadline — quarantined, never scheduled or marked overdue.
  // Optional chaining inside harvestUnconfirmedGmail keeps old alerts without new fields working.
  const unconfirmedGmail = useMemo(() => harvestUnconfirmedGmail(emailAlerts), [emailAlerts]);

  // Handle Syllabus File Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      setSelectedFile({
        base64,
        mimeType: file.type || 'application/pdf',
        name: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleParseSyllabus = async () => {
    if (!selectedFile && !syllabusText.trim()) return;

    setIsParsingSyllabus(true);
    setParsedSyllabus(null);
    try {
      const res = await parseSyllabusMultimodal({
        textContent: syllabusText,
        fileBase64: selectedFile?.base64,
        mimeType: selectedFile?.mimeType,
      });
      setParsedSyllabus(res);
    } catch (err) {
      console.error('Failed to parse syllabus:', err);
    } finally {
      setIsParsingSyllabus(false);
    }
  };

  const handleDeploySemester = async () => {
    if (!parsedSyllabus) return;
    setIsDeployingSemester(true);
    setDeployedResult(null);
    try {
      const res = await deploySemesterFromSyllabus(parsedSyllabus);
      setDeployedResult(res);
      confetti({ particleCount: 60, spread: 60 });
    } catch (err) {
      console.error('Failed to deploy semester:', err);
    } finally {
      setIsDeployingSemester(false);
    }
  };

  // Handle Assignment Breakdown
  const handleOpenDeconstruct = async (assignment: Assignment) => {
    setDeconstructingItem(assignment);
    setIsDeconstructing(true);
    setSubtasks([]);
    try {
      const tasks = await deconstructAssignment({
        title: assignment.assignmentName,
        course: assignment.subject,
        dueAt: assignment.dueDate,
        description: assignment.notes,
      });
      setSubtasks(tasks);
    } catch (err) {
      console.error('Deconstruct error:', err);
    } finally {
      setIsDeconstructing(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Header & Sub-Tab Bar */}
      <div className="bg-white dark:bg-[#1A1917] rounded-2xl p-4 border border-[#DFDACB] dark:border-[#2C2B27] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#141413] dark:text-[#FAF9F5] tracking-tight">
              Academic Radar &amp; LMS Hub
            </h2>
            <p className="text-xs text-[#8C897F] mt-0.5">
              Coursework agenda, milestones &amp; 14-day exam alerts, Canvas, Classroom, Moodle, and Gmail
            </p>
          </div>
        </div>

        {/* Tab Switcher & Syllabus Launcher */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <button
            onClick={() => setIsSyllabusModalOpen(true)}
            className="px-3 py-1.5 bg-[#D97757]/10 hover:bg-[#D97757]/20 text-[#D97757] border border-[#D97757]/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>AI Syllabus Engine</span>
          </button>

          <div className="flex items-center gap-1 overflow-x-auto p-1 bg-[#FAF9F5] dark:bg-[#1F1E1B] rounded-xl border border-[#DFDACB] dark:border-[#2C2B27]">
            {[
              { id: 'agenda', label: 'Chronological Agenda', icon: Calendar },
              { id: 'canvas', label: 'Canvas LMS', icon: Layers },
              { id: 'classroom', label: 'Google Classroom', icon: GraduationCap },
              { id: 'moodle', label: 'Moodle LMS', icon: BookOpen },
              { id: 'gmail', label: 'Gmail Scanner', icon: Mail },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as AcademicSubTab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-[#D97757] text-white shadow-xs'
                      : 'text-[#5C5A54] dark:text-[#B5B2A8] hover:text-[#141413] dark:hover:text-[#FAF9F5]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 1. Unified Chronological Agenda & Milestone Alerts */}
      {activeTab === 'agenda' && (
        <div className="space-y-4">
          {/* Filters & Search */}
          <div className="bg-white dark:bg-[#1A1917] rounded-2xl p-4 border border-[#DFDACB] dark:border-[#2C2B27] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2 overflow-x-auto">
              {uniqueSubjects.map((sub) => (
                <button
                  key={sub}
                  onClick={() => setFilterSubject(sub)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    filterSubject === sub
                      ? 'bg-[#D97757] text-white shadow-xs'
                      : 'bg-[#FAF9F5] dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#2C2B27] text-[#5C5A54] dark:text-[#B5B2A8] hover:border-[#D97757]'
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-[#8C897F] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search upcoming deadlines..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#FAF9F5] dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#2C2B27] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D97757] text-[#141413] dark:text-[#FAF9F5]"
              />
            </div>
          </div>

          {/* Quarantine — Gmail detections with no usable deadline. Never scheduled, never overdue. */}
          {unconfirmedGmail.length > 0 && (
            <section
              aria-label="Needs deadline confirmation"
              className="rounded-2xl border border-dashed border-amber-300 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20 p-4 shadow-xs"
            >
              <h4 className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-200">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Needs deadline confirmation · {unconfirmedGmail.length}</span>
              </h4>
              <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1 leading-relaxed">
                These Gmail detections look like assignments but carry no usable deadline — held out
                of the agenda and never marked overdue until you confirm a date.
              </p>
              <ul className="mt-2.5 space-y-2">
                {unconfirmedGmail.map((g) => (
                  <li
                    key={g.key}
                    title={g.quote || g.title}
                    className="p-3 rounded-xl bg-white dark:bg-[#1A1917] border border-amber-200 dark:border-amber-800/60"
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#D97757]/10 text-[#D97757] border border-[#D97757]/20">
                        {g.subject}
                      </span>
                      <span
                        title={g.quote || 'AI-guessed assignment — deadline not confirmed'}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                      >
                        Unconfirmed
                      </span>
                      <span
                        title={g.quote || 'No usable deadline found in the email'}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-dashed border-rose-300 dark:border-rose-800 flex items-center gap-1"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        <span>Unknown deadline</span>
                      </span>
                    </div>
                    <p className="text-xs font-bold text-[#141413] dark:text-[#FAF9F5] mt-1.5">{g.title}</p>
                    {g.quote && (
                      <p className="text-[11px] text-[#5C5A54] dark:text-[#B5B2A8] mt-0.5 line-clamp-2 italic">
                        “{g.quote}”
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Agenda List */}
          <div className="space-y-3">
            {agendaItems.length === 0 ? (
              <div className="py-16 text-center bg-white dark:bg-[#1A1917] rounded-2xl border border-[#DFDACB] dark:border-[#2C2B27] p-6 shadow-xs">
                <CheckSquare className="w-10 h-10 mx-auto text-emerald-500 mb-2 opacity-80" />
                <h4 className="text-sm font-bold text-[#141413] dark:text-[#FAF9F5]">
                  All Deadlines Clear!
                </h4>
                <p className="text-xs text-[#8C897F] mt-1 max-w-sm mx-auto">
                  No upcoming assignments or tests matching your criteria. Sync Canvas, Classroom, or Moodle above, or upload a syllabus via the AI Syllabus Engine.
                </p>
              </div>
            ) : (
              agendaItems.map((item) => {
                const isDone = item.status === 'Done';
                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
                      isDone
                        ? 'bg-[#FAF9F5]/60 dark:bg-[#1F1E1B]/60 border-[#DFDACB]/60 dark:border-[#2C2B27]/60 opacity-60'
                        : item.urgency === 'OVERDUE'
                        ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/80'
                        : item.urgency === 'DUE_24H'
                        ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/80'
                        : 'bg-white dark:bg-[#1A1917] border-[#DFDACB] dark:border-[#2C2B27] hover:border-[#D97757]/40'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <button
                        onClick={() => onToggleStatus(item.id)}
                        className={`mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                          isDone
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-[#DFDACB] dark:border-[#2C2B27] bg-[#FAF9F5] dark:bg-[#252422] hover:border-[#D97757]'
                        }`}
                      >
                        {isDone && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#D97757]/10 text-[#D97757] border border-[#D97757]/20">
                            {item.subject}
                          </span>

                          {item.urgency === 'OVERDUE' && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                              Overdue
                            </span>
                          )}

                          {item.urgency === 'DUE_24H' && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              Due in 24h
                            </span>
                          )}

                          {((item as any)?.verificationStatus === 'unconfirmed' ||
                            (item as any)?.needsReview === true) && (
                            <span
                              title={
                                (item as any)?.sourceQuote ||
                                'AI-guessed deadline — confirm before trusting this date'
                              }
                              className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                            >
                              Unconfirmed
                            </span>
                          )}

                          {(item as any)?.verificationStatus === 'unknown-date' && (
                            <span
                              title={
                                (item as any)?.sourceQuote ||
                                'No usable deadline found — confirm a date'
                              }
                              className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-dashed border-rose-300 dark:border-rose-800 flex items-center gap-1"
                            >
                              <AlertTriangle className="w-3 h-3" />
                              <span>Unknown deadline</span>
                            </span>
                          )}

                          {item.milestoneAlert && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-blue-500" />
                              <span>{item.milestoneAlert}</span>
                            </span>
                          )}

                          <span className="text-[10px] text-[#8C897F] font-mono flex items-center gap-1 ml-auto">
                            <Clock className="w-3 h-3 text-[#D97757]" />
                            <span>Due: {item.dueDate}</span>
                          </span>
                        </div>

                        <h4
                          className={`text-xs sm:text-sm font-bold mt-1.5 ${
                            isDone ? 'line-through text-[#8C897F]' : 'text-[#141413] dark:text-[#FAF9F5]'
                          }`}
                        >
                          {item.assignmentName}
                        </h4>

                        {item.notes && (
                          <p className="text-[11px] text-[#5C5A54] dark:text-[#B5B2A8] mt-1 line-clamp-1">
                            {item.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons: AI Deconstruct, Draft Email, Doc */}
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      <button
                        onClick={() => handleOpenDeconstruct(item)}
                        className="px-2.5 py-1 text-xs font-semibold bg-[#FAF9F5] dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] hover:border-[#D97757] text-[#5C5A54] dark:text-[#B5B2A8] hover:text-[#D97757] rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                        title="Deconstruct into 4 actionable sub-tasks"
                      >
                        <ListTodo className="w-3 h-3 text-[#D97757]" />
                        <span>Break Down</span>
                      </button>

                      <button
                        onClick={() => {
                          onOpenQuickDraft({
                            id: `draft-${item.id}`,
                            subject: `Question regarding ${item.assignmentName}`,
                            sender: item.subject,
                            date: item.dueDate,
                            snippet: item.notes || item.assignmentName,
                          });
                        }}
                        className="p-1.5 text-[#5C5A54] dark:text-[#B5B2A8] hover:text-[#D97757] hover:bg-[#FAF9F5] dark:hover:bg-[#252422] rounded-lg transition-colors cursor-pointer"
                        title="Draft email to professor"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>

                      {item.docUrl && (
                        <a
                          href={item.docUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-[#5C5A54] dark:text-[#B5B2A8] hover:text-[#D97757] rounded-lg transition-colors"
                          title="Open Document"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 2. Canvas LMS View */}
      {activeTab === 'canvas' && (
        <CanvasSyncTab
          settings={canvasSettings}
          onSaveSettings={onSaveCanvasSettings}
          canvasAssignments={canvasAssignments}
          isLoading={isLoadingCanvas}
          errorMessage={canvasError}
          lastSyncedAt={lastSyncedAt}
          onFetchCanvas={onFetchCanvas}
          onSyncToSheet={onSyncCanvasToSheet}
          onSyncAllPending={onSyncAllPendingCanvas}
          isGoogleConnected={isGoogleConnected}
          googleToken={googleToken}
          onConnectGoogle={onConnectGoogle}
        />
      )}

      {/* 3. Google Classroom Panel */}
      {activeTab === 'classroom' && (
        <GoogleClassroomPanel
          googleToken={googleToken}
          isGoogleConnected={isGoogleConnected}
          onConnectGoogle={onConnectGoogle}
          onSyncToSheet={onSyncCanvasToSheet}
        />
      )}

      {/* 4. Moodle LMS Panel */}
      {activeTab === 'moodle' && (
        <MoodlePanel onSyncToSheet={onSyncCanvasToSheet} />
      )}

      {/* 5. Gmail Scanner View */}
      {activeTab === 'gmail' && (
        <GmailRadarTab
          emailAlerts={emailAlerts}
          rawEmails={rawEmails}
          isLoadingEmails={isLoadingEmails}
          onRefreshEmails={onRefreshEmails}
          onOpenQuickDraft={onOpenQuickDraft}
          onExtractAssignment={onExtractAssignment}
          isGoogleConnected={isGoogleConnected}
          onConnectGoogle={onConnectGoogle}
          emailError={emailError}
        />
      )}

      {/* --- Multimodal Syllabus Modal --- */}
      {isSyllabusModalOpen && (
        <div className="fixed inset-0 bg-[#141413]/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1A1917] rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-[#DFDACB] dark:border-[#2C2B27] shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-[#DFDACB] dark:border-[#2C2B27] flex items-center justify-between bg-[#FAF9F5] dark:bg-[#1F1E1B]">
              <div className="flex items-center gap-2.5">
                <UploadCloud className="w-5 h-5 text-[#D97757]" />
                <h3 className="text-sm font-bold text-[#141413] dark:text-[#FAF9F5]">
                  Multimodal Syllabus-to-Milestone Engine
                </h3>
              </div>
              <button
                onClick={() => setIsSyllabusModalOpen(false)}
                className="p-1.5 text-[#8C897F] hover:bg-[#EFECE2] dark:hover:bg-[#2C2A26] rounded-xl cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <p className="text-xs text-[#8C897F] leading-relaxed">
                Upload your course syllabus document (PDF, PNG, JPG) or paste syllabus text. Gemini 2.5 Flash extracts exam dates, assignments, and automatically computes a 14-day, 7-day, and 2-day prep timeline.
              </p>

              {/* Upload Dropzone */}
              <div className="border-2 border-dashed border-[#DFDACB] dark:border-[#2C2B27] hover:border-[#D97757] rounded-2xl p-6 text-center transition-colors">
                <input
                  type="file"
                  id="syllabus-file-input"
                  accept=".pdf,image/png,image/jpeg"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="syllabus-file-input" className="cursor-pointer block">
                  <FileText className="w-8 h-8 text-[#D97757] mx-auto mb-2 opacity-80" />
                  <span className="text-xs font-bold text-[#141413] dark:text-[#FAF9F5] block">
                    {selectedFile ? selectedFile.name : 'Click to select syllabus PDF or image'}
                  </span>
                  <span className="text-[10px] text-[#8C897F]">
                    Supports PDF, PNG, and JPG up to 10MB
                  </span>
                </label>
              </div>

              {/* Text Fallback */}
              <div>
                <label className="block text-xs font-bold text-[#5C5A54] dark:text-[#B5B2A8] mb-1">
                  Or paste syllabus text directly:
                </label>
                <textarea
                  rows={4}
                  value={syllabusText}
                  onChange={(e) => setSyllabusText(e.target.value)}
                  placeholder="Paste syllabus course schedule, exam dates, or grading weights here..."
                  className="w-full p-3 text-xs bg-[#FAF9F5] dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#2C2B27] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D97757] text-[#141413] dark:text-[#FAF9F5] resize-none"
                />
              </div>

              {/* Parse Results */}
              {parsedSyllabus && (
                <div className="p-4 bg-[#FAF9F5] dark:bg-[#1F1E1B] rounded-2xl border border-[#DFDACB] dark:border-[#2C2B27] space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-[#DFDACB]/60 dark:border-[#2C2B27]/60">
                    <div>
                      <h4 className="text-xs font-bold text-[#141413] dark:text-[#FAF9F5]">
                        {parsedSyllabus.courseName}
                      </h4>
                      {parsedSyllabus.instructor && (
                        <span className="text-[10px] text-[#8C897F]">
                          Instructor: {parsedSyllabus.instructor}
                        </span>
                      )}
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      Parsed Successfully
                    </span>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C897F]">
                      Extracted Exams &amp; Prep Milestones:
                    </span>
                    {parsedSyllabus.exams.map((exam, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-white dark:bg-[#252422] rounded-xl border border-[#DFDACB] dark:border-[#2C2B27] text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between font-bold text-[#141413] dark:text-[#FAF9F5]">
                          <span>{exam.examName}</span>
                          <span className="text-[#D97757] font-mono">{exam.examDate}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 text-[10px] pt-1">
                          <div className="p-1.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 text-center">
                            <span className="block font-bold">14-Day Prep</span>
                            <span>{exam.timeline.prep14Days}</span>
                          </div>
                          <div className="p-1.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-center">
                            <span className="block font-bold">7-Day Sprint</span>
                            <span>{exam.timeline.sprint7Days}</span>
                          </div>
                          <div className="p-1.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 text-center">
                            <span className="block font-bold">48h Review</span>
                            <span>{exam.timeline.finalReview2Days}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 1-Click Deploy Semester Result */}
                  {deployedResult && (
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-300 dark:border-emerald-800 space-y-2 text-xs text-emerald-900 dark:text-emerald-200 animate-in fade-in">
                      <div className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Semester Deployed into StudentOS!</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                        <div className="p-2 bg-white dark:bg-[#1A1917] rounded-xl border border-emerald-200 dark:border-emerald-800/80 text-center font-bold">
                          <span className="text-[#D97757] text-sm block">{deployedResult.milestonesCount}</span>
                          <span className="text-[#8C897F]">Study Milestones</span>
                        </div>
                        <div className="p-2 bg-white dark:bg-[#1A1917] rounded-xl border border-emerald-200 dark:border-emerald-800/80 text-center font-bold">
                          <span className="text-[#D97757] text-sm block">{deployedResult.lectureNotesCount}</span>
                          <span className="text-[#8C897F]">Lecture Notes</span>
                        </div>
                        <div className="p-2 bg-white dark:bg-[#1A1917] rounded-xl border border-emerald-200 dark:border-emerald-800/80 text-center font-bold">
                          <span className="text-[#D97757] text-sm block">{deployedResult.flashcardDecksCount}</span>
                          <span className="text-[#8C897F]">SRS Deck</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[#DFDACB] dark:border-[#2C2B27] bg-[#FAF9F5] dark:bg-[#1F1E1B] flex items-center justify-between gap-2.5">
              {parsedSyllabus ? (
                <button
                  onClick={handleDeploySemester}
                  disabled={isDeployingSemester}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isDeployingSemester ? 'animate-spin' : ''}`} />
                  <span>{isDeployingSemester ? 'Deploying Semester...' : 'Deploy Semester (1-Click)'}</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsSyllabusModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#5C5A54] dark:text-[#B5B2A8] hover:bg-[#EFECE2] dark:hover:bg-[#2C2A26] cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={handleParseSyllabus}
                  disabled={isParsingSyllabus || (!selectedFile && !syllabusText.trim())}
                  className="px-5 py-2 bg-[#D97757] hover:bg-[#C86646] disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isParsingSyllabus ? 'animate-spin' : ''}`} />
                  <span>{isParsingSyllabus ? 'Analyzing Syllabus...' : 'Extract Milestones'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- AI Assignment Deconstructor Modal --- */}
      {deconstructingItem && (
        <div className="fixed inset-0 bg-[#141413]/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1A1917] rounded-3xl max-w-lg w-full border border-[#DFDACB] dark:border-[#2C2B27] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-[#DFDACB] dark:border-[#2C2B27] flex items-center justify-between bg-[#FAF9F5] dark:bg-[#1F1E1B]">
              <div className="flex items-center gap-2.5">
                <ListTodo className="w-5 h-5 text-[#D97757]" />
                <div>
                  <h3 className="text-sm font-bold text-[#141413] dark:text-[#FAF9F5]">
                    AI Assignment Deconstructor
                  </h3>
                  <p className="text-[11px] text-[#8C897F] truncate max-w-xs">
                    {deconstructingItem.assignmentName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDeconstructingItem(null)}
                className="p-1.5 text-[#8C897F] hover:bg-[#EFECE2] dark:hover:bg-[#2C2A26] rounded-xl cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {isDeconstructing ? (
                <div className="py-12 text-center space-y-2">
                  <Sparkles className="w-8 h-8 text-[#D97757] animate-spin mx-auto" />
                  <p className="text-xs text-[#8C897F] font-semibold">
                    Gemini is decomposing prompt into actionable sub-tasks...
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <span className="text-[10px] font-bold text-[#8C897F] uppercase tracking-wider block">
                    Actionable Sub-tasks (Estimated Completion Sprints)
                  </span>

                  {subtasks.map((task, idx) => (
                    <div
                      key={task.id || idx}
                      className="p-3 bg-[#FAF9F5] dark:bg-[#1F1E1B] rounded-2xl border border-[#DFDACB] dark:border-[#2C2B27] flex items-start gap-3"
                    >
                      <input
                        type="checkbox"
                        checked={task.isCompleted}
                        onChange={() => {
                          setSubtasks((prev) =>
                            prev.map((t, i) => (i === idx ? { ...t, isCompleted: !t.isCompleted } : t))
                          );
                        }}
                        className="mt-1 rounded text-[#D97757] focus:ring-[#D97757] cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4
                            className={`text-xs font-bold ${
                              task.isCompleted ? 'line-through text-[#8C897F]' : 'text-[#141413] dark:text-[#FAF9F5]'
                            }`}
                          >
                            {task.title}
                          </h4>
                          <span className="text-[10px] text-[#D97757] font-mono font-bold shrink-0 ml-2">
                            ~{task.estimatedMinutes}m
                          </span>
                        </div>
                        <p className="text-[11px] text-[#8C897F] mt-0.5 leading-relaxed">
                          {task.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[#DFDACB] dark:border-[#2C2B27] bg-[#FAF9F5] dark:bg-[#1F1E1B] flex items-center justify-between">
              <span className="text-xs text-[#8C897F]">
                Total Estimated Time:{' '}
                <strong>
                  {subtasks.reduce((sum, t) => sum + (t.estimatedMinutes || 0), 0)} mins
                </strong>
              </span>
              <button
                onClick={() => setDeconstructingItem(null)}
                className="px-4 py-2 bg-[#D97757] hover:bg-[#C86646] text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

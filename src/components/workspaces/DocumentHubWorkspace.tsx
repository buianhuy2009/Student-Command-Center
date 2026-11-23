import React, { useState, useMemo } from 'react';
import {
  FileText,
  FolderOpen,
  BookOpen,
  Plus,
  Trash2,
  Copy,
  Check,
  Download,
  ExternalLink,
  Code,
  ListOrdered,
  Heading,
  CheckSquare,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Printer,
  Brain,
  MessageSquare,
  Send,
  HelpCircle,
  FileCheck,
} from 'lucide-react';
import { MathMarkdown } from '../MathMarkdown';
import { createFormattedAssignmentDoc } from '../../services/googleWorkspace';
import {
  analyzeEssayDraft,
  EssayAnalysisResult,
  socraticTutorStep,
  SocraticTurn,
} from '../../services/gemini';
import { MarkdownNote, SchoolFile } from '../../types';
import { formatDate as formatI18nDate, t as translate, useT } from '../../services/i18n';

type DocHubTab = 'notes' | 'generator' | 'essay-proof' | 'socratic';

const LOCAL_NOTES_KEY = 'scc_markdown_notes_v1';

function loadSavedNotes(): MarkdownNote[] {
  try {
    const saved = localStorage.getItem(LOCAL_NOTES_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Error loading markdown notes:', e);
  }
  return [
    {
      id: 'note-welcome',
      title: translate('dochub_welcome_title'),
      subject: translate('dochub_subject_general'),
      content: translate('dochub_welcome_content'),
      updatedAt: formatI18nDate(new Date()),
    },
  ];
}

function saveNotes(notes: MarkdownNote[]) {
  try {
    localStorage.setItem(LOCAL_NOTES_KEY, JSON.stringify(notes));
  } catch (e) {
    console.error('Error saving markdown notes:', e);
  }
}

interface DocumentHubWorkspaceProps {
  recentFiles: SchoolFile[];
  isLoadingFiles: boolean;
  onRefreshFiles: () => void;
  isGoogleConnected: boolean;
  googleToken?: string;
  onConnectGoogle?: () => void;
}

export const DocumentHubWorkspace: React.FC<DocumentHubWorkspaceProps> = ({
  recentFiles,
  isLoadingFiles,
  onRefreshFiles,
  isGoogleConnected,
  googleToken,
  onConnectGoogle,
}) => {
  const { t, formatDate } = useT();
  const [activeTab, setActiveTab] = useState<DocHubTab>('notes');
  const [notes, setNotes] = useState<MarkdownNote[]>(loadSavedNotes);
  const [activeNoteId, setActiveNoteId] = useState<string>(() => {
    const saved = loadSavedNotes();
    return saved.length > 0 ? saved[0].id : '';
  });

  const [copiedNote, setCopiedNote] = useState(false);

  // --- 1-Click Doc Generator State ---
  const [docTitle, setDocTitle] = useState('');
  const [docSubject, setDocSubject] = useState('');
  const [docRubric, setDocRubric] = useState('');
  const [docStyle, setDocStyle] = useState<'MLA' | 'APA' | 'Academic Standard'>('Academic Standard');
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);
  const [generatedDocUrl, setGeneratedDocUrl] = useState<string | null>(null);
  const [docMessage, setDocMessage] = useState<string | null>(null);

  // --- Essay Proofreader State ---
  const [essayToProof, setEssayToProof] = useState('');
  const [essayPromptContext, setEssayPromptContext] = useState('');
  const [isAnalyzingEssay, setIsAnalyzingEssay] = useState(false);
  const [essayAnalysisResult, setEssayAnalysisResult] = useState<EssayAnalysisResult | null>(null);
  const [essayError, setEssayError] = useState<string | null>(null);

  // --- Socratic Tutor State ---
  const [socraticTopic, setSocraticTopic] = useState('');
  const [socraticInput, setSocraticInput] = useState('');
  const [socraticHistory, setSocraticHistory] = useState<SocraticTurn[]>([]);
  const [isSocraticThinking, setIsSocraticThinking] = useState(false);
  const [socraticError, setSocraticError] = useState<string | null>(null);

  const [notesSubjectFilter, setNotesSubjectFilter] = useState<string>('ALL');
  const generalSubjectLabel = t('dochub_subject_general');
  const groupedNotes = useMemo(() => {
    const groups: Record<string, typeof notes> = {};
    notes.forEach(n => {
      const subj = n.subject || generalSubjectLabel;
      if (notesSubjectFilter !== 'ALL' && subj !== notesSubjectFilter) return;
      if (!groups[subj]) groups[subj] = [];
      groups[subj].push(n);
    });
    return groups;
  }, [notes, notesSubjectFilter, generalSubjectLabel]);
  const uniqueSubjects = useMemo(() => ['ALL', ...Array.from(new Set(notes.map(n => n.subject || generalSubjectLabel)))], [notes, generalSubjectLabel]);

  const activeNote = notes.find((n) => n.id === activeNoteId) || notes[0];

  const noteWordCount = useMemo(() => {
    if (!activeNote?.content) return 0;
    return activeNote.content.trim().split(/\s+/).filter(Boolean).length;
  }, [activeNote]);

  const noteCharCount = useMemo(() => {
    return activeNote?.content?.length || 0;
  }, [activeNote]);

  const noteReadingTime = useMemo(() => {
    return Math.max(1, Math.ceil(noteWordCount / 200));
  }, [noteWordCount]);

  const handleUpdateActiveNote = (updates: Partial<MarkdownNote>) => {
    const updated = notes.map((n) => {
      if (n.id === activeNoteId) {
        return {
          ...n,
          ...updates,
          updatedAt: formatDate(new Date()),
        };
      }
      return n;
    });
    setNotes(updated);
    saveNotes(updated);
  };

  const handleCreateNote = () => {
    const newNote: MarkdownNote = {
      id: `note-${Date.now()}`,
      title: t('dochub_new_note_title'),
      subject: t('dochub_subject_general'),
      content: t('dochub_new_note_content'),
      updatedAt: formatDate(new Date()),
    };
    const updated = [newNote, ...notes];
    setNotes(updated);
    saveNotes(updated);
    setActiveNoteId(newNote.id);
  };

  const handleDeleteNote = (id: string) => {
    if (notes.length <= 1) return;
    const updated = notes.filter((n) => n.id !== id);
    setNotes(updated);
    saveNotes(updated);
    if (activeNoteId === id) {
      setActiveNoteId(updated[0].id);
    }
  };

  const handleCopyMarkdown = () => {
    if (!activeNote) return;
    navigator.clipboard.writeText(activeNote.content);
    setCopiedNote(true);
    setTimeout(() => setCopiedNote(false), 2000);
  };

  const handleDownloadNote = () => {
    if (!activeNote) return;
    const blob = new Blob([activeNote.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeNote.title.replace(/\s+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleInsertCornellTemplate = () => {
    if (!activeNote) return;
    const cornellMarkdown = t('dochub_cornell_template', {
      title: activeNote.title || t('dochub_cornell_default_title'),
      date: formatDate(new Date()),
      subject: activeNote.subject || t('dochub_subject_general'),
    });
    handleUpdateActiveNote({ content: cornellMarkdown });
  };

  const handlePrintNote = () => {
    window.print();
  };

  // Run Google Doc Generator
  const handleGenerateDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isGoogleConnected || !googleToken) {
      if (onConnectGoogle) {
        onConnectGoogle();
        setDocMessage(t('dochub_doc_allow_drive'));
      } else {
        setDocMessage(t('dochub_doc_connect_first'));
      }
      return;
    }
    if (!docTitle.trim()) return;

    setIsGeneratingDoc(true);
    setDocMessage(null);
    setGeneratedDocUrl(null);

    try {
      const rubricChecklist = docRubric
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const result = await createFormattedAssignmentDoc(googleToken, {
        title: docTitle.trim(),
        subject: docSubject.trim() || t('dochub_doc_default_subject'),
        formatStyle: docStyle,
        checklist: rubricChecklist,
      });

      if (result?.webViewLink) {
        setGeneratedDocUrl(result.webViewLink);
        setDocMessage(t('dochub_doc_created_msg'));
        onRefreshFiles();
      } else {
        setDocMessage(t('dochub_doc_create_failed'));
      }
    } catch (err) {
      console.error('Doc generation error:', err);
      setDocMessage(t('dochub_doc_reconnect_retry'));
    } finally {
      setIsGeneratingDoc(false);
    }
  };

  // Run Essay Proofreading & Thesis Analysis
  const handleAnalyzeEssay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!essayToProof.trim() || isAnalyzingEssay) return;

    setIsAnalyzingEssay(true);
    setEssayAnalysisResult(null);
    setEssayError(null);
    try {
      const res = await analyzeEssayDraft({
        essayDraft: essayToProof.trim(),
        rubricOrPrompt: essayPromptContext.trim() || undefined,
      });
      setEssayAnalysisResult(res);
    } catch (err: any) {
      console.error('Essay analysis failed:', err);
      setEssayError(err?.message || t('dochub_essay_err'));
    } finally {
      setIsAnalyzingEssay(false);
    }
  };

  // Run Socratic Tutor Dialogue
  const handleStartSocraticSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!socraticTopic.trim() || isSocraticThinking) return;

    setIsSocraticThinking(true);
    setSocraticHistory([]);
    setSocraticError(null);
    try {
      const initialQuestion = await socraticTutorStep({
        topic: socraticTopic.trim(),
        history: [],
        userMessage: t('dochub_socratic_init_prompt'),
      });
      setSocraticHistory([{ role: 'model', content: initialQuestion }]);
    } catch (err: any) {
      console.error('Socratic initialization error:', err);
      setSocraticError(err?.message || t('dochub_socratic_start_err'));
    } finally {
      setIsSocraticThinking(false);
    }
  };

  const handleSendSocraticAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!socraticInput.trim() || isSocraticThinking) return;

    const userMsg = socraticInput.trim();
    const updatedHistory: SocraticTurn[] = [...socraticHistory, { role: 'user', content: userMsg }];
    setSocraticHistory(updatedHistory);
    setSocraticInput('');
    setIsSocraticThinking(true);
    setSocraticError(null);

    try {
      const nextQuestion = await socraticTutorStep({
        topic: socraticTopic.trim(),
        history: updatedHistory,
        userMessage: userMsg,
      });
      setSocraticHistory([...updatedHistory, { role: 'model', content: nextQuestion }]);
    } catch (err: any) {
      console.error('Socratic reply error:', err);
      setSocraticError(err?.message || t('dochub_socratic_reply_err'));
    } finally {
      setIsSocraticThinking(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Header & Sub-Tab Bar */}
      <div className="bg-[var(--bg-surface)] rounded-2xl p-4 border border-[var(--border-default)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] tracking-tight">
              {t('dochub_title')}
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {t('dochub_sub')}
            </p>
          </div>
        </div>

        {/* Sub-Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border-default)]">
          {[
            { id: 'notes', label: t('dochub_tab_notes'), icon: FileText },
            { id: 'generator', label: t('dochub_tab_generator'), icon: Plus },
            { id: 'essay-proof', label: t('dochub_tab_essay'), icon: FileCheck },
            { id: 'socratic', label: t('dochub_tab_socratic'), icon: MessageSquare },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as DocHubTab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[var(--accent-fill)] text-white shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. Markdown & LaTeX Note-Taker with Live Split Preview */}
      {activeTab === 'notes' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 min-w-0">
          {/* Notes Sidebar */}
          <div className="xl:col-span-3 min-w-0 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-default)]">
              <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                {t('dochub_saved_notes', { count: notes.length })}
              </span>
              <button
                onClick={handleCreateNote}
                className="p-1 text-[var(--accent-text)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors cursor-pointer"
                title={t('dochub_new_note_btn')}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-1.5 mb-2 overflow-x-auto">
              <span className="text-[10px] text-[var(--text-muted)] font-bold shrink-0">{t('dochub_folder_label')}</span>
              {uniqueSubjects.map(subj => (
                <button key={subj} onClick={() => setNotesSubjectFilter(subj)} className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap border ${notesSubjectFilter === subj ? 'bg-[var(--accent-fill)] text-white border-[var(--accent-fill)]' : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-default)]'}`}>{subj === 'ALL' ? t('dochub_filter_all') : subj}</button>
              ))}
            </div>

            <div className="space-y-3 max-h-[260px] xl:max-h-[550px] overflow-y-auto pr-1">
              {Object.entries(groupedNotes).length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-6">{t('dochub_empty_folder')}</p>
              ) : (
                Object.entries(groupedNotes).map(([subj, subjNotes]) => (
                  <div key={subj} className="space-y-1.5">
                    <div className="flex items-center gap-1.5 px-1">
                      <FolderOpen className="w-3 h-3 text-[var(--accent-text)]" />
                      <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{subj}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">({subjNotes.length})</span>
                    </div>
                    {subjNotes.map((note) => (
                      <div
                        key={note.id}
                        onClick={() => setActiveNoteId(note.id)}
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-colors flex items-center justify-between ${
                          activeNoteId === note.id
                            ? 'bg-[var(--accent-soft)] border-[var(--accent-fill)]/40 text-[var(--accent-text)] font-bold'
                            : 'bg-[var(--bg-subtle)] border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--accent-fill)]'
                        }`}
                      >
                        <div className="min-w-0 flex-1 mr-2">
                          <p className="truncate font-semibold">{note.title || t('dochub_untitled_note')}</p>
                          <span className="text-[10px] text-[var(--text-muted)] font-mono">{note.updatedAt}</span>
                        </div>
                        {notes.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteNote(note.id);
                            }}
                            className="p-1 text-[var(--text-muted)] hover:text-rose-600 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Live Split Editor & Preview */}
          <div className="xl:col-span-9 min-w-0 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-4 sm:p-5 shadow-xs flex flex-col space-y-4">
            {activeNote && (
              <>
                <div className="flex flex-col gap-3 pb-3 border-b border-[var(--border-default)]">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
                    <input
                      type="text"
                      value={activeNote.title}
                      onChange={(e) => handleUpdateActiveNote({ title: e.target.value })}
                      placeholder={t('dochub_note_title_ph')}
                      className="flex-1 text-base font-bold bg-transparent border-b border-transparent hover:border-[var(--border-strong)] focus:border-[var(--accent-fill)] focus:outline-none text-[var(--text-primary)] px-1 py-0.5 min-w-0"
                    />
                    <input
                      type="text"
                      value={activeNote.subject || ''}
                      onChange={(e) => handleUpdateActiveNote({ subject: e.target.value })}
                      placeholder={t('dochub_note_subject_ph')}
                      className="w-full sm:w-36 shrink-0 px-2.5 py-1 text-xs bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--accent-fill)] text-[var(--text-primary)]"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-[var(--text-muted)] px-2.5 py-1 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border-default)]">
                      <span>{t('dochub_words_count', { count: noteWordCount })}</span>
                      <span>•</span>
                      <span>{t('dochub_chars_count', { count: noteCharCount })}</span>
                      <span>•</span>
                      <span>{t('dochub_read_time', { mins: noteReadingTime })}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={handleInsertCornellTemplate}
                        className="px-3 py-1.5 text-xs font-semibold bg-[var(--bg-subtle)] border border-[var(--border-default)] hover:border-[var(--accent-fill)] text-[var(--text-secondary)] rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                        title={t('dochub_cornell_tip')}
                      >
                        <BookOpen className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                        <span>{t('dochub_cornell_btn')}</span>
                      </button>

                      <button
                        onClick={handlePrintNote}
                        className="px-3 py-1.5 text-xs font-semibold bg-[var(--bg-subtle)] border border-[var(--border-default)] hover:border-[var(--accent-fill)] text-[var(--text-secondary)] rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                        title={t('dochub_print_tip')}
                      >
                        <Printer className="w-3.5 h-3.5 text-blue-500" />
                        <span>{t('dochub_print_btn')}</span>
                      </button>

                      <button
                        onClick={handleCopyMarkdown}
                        className="px-3 py-1.5 text-xs font-semibold bg-[var(--bg-subtle)] border border-[var(--border-default)] hover:border-[var(--accent-fill)] text-[var(--text-secondary)] rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        {copiedNote ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedNote ? t('copied') : t('dochub_copy_md')}</span>
                      </button>

                      <button
                        onClick={handleDownloadNote}
                        className="px-3 py-1.5 text-xs font-bold bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{t('dochub_export_md')}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-h-[420px] xl:h-[58vh]">
                  {/* Editor */}
                  <div className="flex flex-col min-h-[260px] h-full min-w-0">
                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                      {t('dochub_raw_editor')}
                    </span>
                    <textarea
                      value={activeNote.content}
                      onChange={(e) => handleUpdateActiveNote({ content: e.target.value })}
                      placeholder={t('dochub_editor_ph')}
                      className="flex-1 w-full p-4 text-xs font-mono bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-fill)] text-[var(--text-primary)] resize-none leading-relaxed"
                    />
                  </div>

                  {/* Live Render Preview */}
                  <div className="flex flex-col h-full">
                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                      {t('dochub_live_preview')}
                    </span>
                    <div className="flex-1 p-4 bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl overflow-y-auto prose dark:prose-invert prose-xs max-w-none text-[var(--text-primary)]">
                      <MathMarkdown>{activeNote.content}</MathMarkdown>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 2. Essay & Thesis Proofreader */}
      {activeTab === 'essay-proof' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 min-w-0">
          {/* Input column */}
          <div className="xl:col-span-6 min-w-0 bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-default)] p-5 sm:p-6 shadow-xs space-y-4">
            <div className="pb-3 border-b border-[var(--border-default)]">
              <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-[var(--accent-text)]" />
                <span>{t('dochub_essay_title')}</span>
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {t('dochub_essay_sub')}
              </p>
            </div>

            <form onSubmit={handleAnalyzeEssay} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                  {t('dochub_essay_context_label')}
                </label>
                <input
                  type="text"
                  value={essayPromptContext}
                  onChange={(e) => setEssayPromptContext(e.target.value)}
                  placeholder={t('dochub_essay_context_ph')}
                  className="w-full px-3.5 py-2.5 bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-fill)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                  {t('dochub_essay_draft_label')}
                </label>
                <textarea
                  rows={14}
                  required
                  value={essayToProof}
                  onChange={(e) => setEssayToProof(e.target.value)}
                  placeholder={t('dochub_essay_draft_ph')}
                  className="w-full p-4 bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-2xl text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-fill)] leading-relaxed resize-none"
                />
              </div>

              {essayError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2" role="alert">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{essayError}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] font-mono text-[var(--text-muted)]">
                  {t('dochub_words_count', { count: essayToProof.trim().split(/\s+/).filter(Boolean).length })}
                </span>
                <button
                  type="submit"
                  disabled={isAnalyzingEssay || !essayToProof.trim()}
                  className="px-5 py-2.5 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isAnalyzingEssay ? 'animate-spin' : ''}`} />
                  <span>{isAnalyzingEssay ? t('dochub_essay_analyzing') : t('dochub_essay_analyze_btn')}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Analysis Feedback Column */}
          <div className="xl:col-span-6 min-w-0 bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-default)] p-5 sm:p-6 shadow-xs flex flex-col justify-between overflow-y-auto xl:max-h-[700px]">
            {essayAnalysisResult ? (
              <div className="space-y-5 animate-in fade-in">
                {/* Thesis Card */}
                <div className="p-4 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-default)] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      {t('dochub_thesis_eval')}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      essayAnalysisResult.thesisEvaluation.strengthRating === 'Strong'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                        : essayAnalysisResult.thesisEvaluation.strengthRating === 'Moderate'
                        ? 'bg-[var(--status-warn-bg)] text-[var(--status-warn-text)] border border-[var(--status-warn-border)]'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                    }`}>
                      {t('dochub_thesis_badge', {
                        rating:
                          essayAnalysisResult.thesisEvaluation.strengthRating === 'Strong'
                            ? t('dochub_strength_strong')
                            : essayAnalysisResult.thesisEvaluation.strengthRating === 'Moderate'
                            ? t('dochub_strength_moderate')
                            : t('dochub_strength_weak'),
                      })}
                    </span>
                  </div>

                  <blockquote className="text-xs font-serif italic text-[var(--text-primary)] border-l-2 border-[var(--accent-fill)] pl-3 py-1">
                    "{essayAnalysisResult.thesisEvaluation.thesisText}"
                  </blockquote>

                  <p className="text-xs text-[var(--text-secondary)]">
                    {essayAnalysisResult.thesisEvaluation.critique}
                  </p>

                  <div className="pt-2 border-t border-[var(--border-default)] text-xs">
                    <span className="text-[10px] font-bold text-[var(--accent-text)] uppercase tracking-wider block">
                      {t('dochub_suggested_refinement')}
                    </span>
                    <p className="font-semibold text-[var(--text-primary)] mt-0.5">
                      {essayAnalysisResult.thesisEvaluation.suggestedRefinement}
                    </p>
                  </div>
                </div>

                {/* Structural Flow */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                    {t('dochub_structural_flow')}
                  </span>
                  <p className="text-xs text-[var(--text-secondary)] bg-[var(--bg-subtle)] p-3.5 rounded-xl border border-[var(--border-default)]">
                    {essayAnalysisResult.structuralFlow.overallCoherence}
                  </p>
                  {essayAnalysisResult.structuralFlow.transitionWeaknesses.map((w, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-[var(--status-warn-bg)] border border-[var(--status-warn-border)] text-xs text-[var(--status-warn-text)] flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0 mt-0.5" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>

                {/* Evidence Alignment & Action Items */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                    {t('dochub_action_steps')}
                  </span>
                  <div className="space-y-1.5">
                    {essayAnalysisResult.actionableNextSteps.map((step, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-default)] flex items-center gap-2 text-xs text-[var(--text-primary)]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" />
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="my-auto text-center text-[var(--text-muted)] py-16 space-y-2">
                <FileCheck className="w-10 h-10 mx-auto opacity-30" />
                <p className="text-xs">{t('dochub_essay_empty')}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Socratic Dialogue Tutor */}
      {activeTab === 'socratic' && (
        <div className="max-w-3xl mx-auto bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-default)] p-4 sm:p-6 shadow-xs flex flex-col min-h-[440px] h-[min(650px,calc(100dvh-16rem))]">
          <div className="pb-3 border-b border-[var(--border-default)] flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[var(--accent-text)]" />
                <span>{t('dochub_socratic_title')}</span>
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {t('dochub_socratic_sub')}
              </p>
            </div>
            {socraticHistory.length > 0 && (
              <button
                onClick={() => {
                  setSocraticHistory([]);
                  setSocraticTopic('');
                }}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-text)] underline cursor-pointer"
              >
                {t('dochub_socratic_reset')}
              </button>
            )}
          </div>

          {/* Socratic Chat Body */}
          <div className="flex-1 overflow-y-auto py-4 space-y-3.5 pr-1 min-h-0">
            {socraticHistory.length === 0 ? (
              <div className="my-auto text-center py-12 space-y-4">
                <Brain className="w-10 h-10 mx-auto text-[var(--accent-text)] opacity-80" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-[var(--text-primary)]">
                    {t('dochub_socratic_prompt_title')}
                  </h4>
                  <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
                    {t('dochub_socratic_examples')}
                  </p>
                </div>
                <form onSubmit={handleStartSocraticSession} className="flex gap-2 max-w-md mx-auto">
                  <input
                    type="text"
                    required
                    value={socraticTopic}
                    onChange={(e) => setSocraticTopic(e.target.value)}
                    placeholder={t('dochub_socratic_topic_ph')}
                    className="flex-1 px-4 py-2.5 bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-fill)]"
                  />
                  <button
                    type="submit"
                    disabled={isSocraticThinking || !socraticTopic.trim()}
                    className="px-4 py-2.5 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    {isSocraticThinking ? t('dochub_socratic_starting') : t('dochub_socratic_begin')}
                  </button>
                </form>
              </div>
            ) : (
              socraticHistory.map((turn, idx) => (
                <div
                  key={idx}
                  className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                      turn.role === 'user'
                        ? 'bg-[var(--accent-fill)] text-white rounded-tr-xs'
                        : 'bg-[var(--bg-subtle)] border border-[var(--border-default)] text-[var(--text-primary)] rounded-tl-xs'
                    }`}
                  >
                    <div className="text-[10px] font-bold opacity-60 mb-1">
                      {turn.role === 'user' ? t('dochub_socratic_you') : t('dochub_socratic_tutor')}
                    </div>
                    <MathMarkdown>{turn.content}</MathMarkdown>
                  </div>
                </div>
              ))
            )}

            {isSocraticThinking && socraticHistory.length > 0 && (
              <div className="flex justify-start">
                <div className="p-3.5 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-default)] text-xs text-[var(--text-muted)] flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 animate-spin text-[var(--accent-text)]" />
                  <span>{t('dochub_socratic_thinking')}</span>
                </div>
              </div>
            )}
          </div>

          {/* Socratic Error Alert */}
          {socraticError && (
            <div className="mt-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2 shrink-0" role="alert">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{socraticError}</span>
            </div>
          )}

          {/* Socratic Reply Bar */}
          {socraticHistory.length > 0 && (
            <form onSubmit={handleSendSocraticAnswer} className="pt-3 border-t border-[var(--border-default)] flex gap-2 shrink-0">
              <input
                type="text"
                value={socraticInput}
                onChange={(e) => setSocraticInput(e.target.value)}
                placeholder={t('dochub_socratic_reply_ph')}
                className="flex-1 px-4 py-2.5 bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-fill)]"
              />
              <button
                type="submit"
                disabled={isSocraticThinking || !socraticInput.trim()}
                className="px-4 py-2.5 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{t('dochub_socratic_send')}</span>
              </button>
            </form>
          )}
        </div>
      )}

      {/* 5. 1-Click Assignment Doc Generator */}
      {activeTab === 'generator' && (
        <div className="max-w-2xl mx-auto bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-6 shadow-xs space-y-4">
          <div className="pb-3 border-b border-[var(--border-default)]">
            <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Plus className="w-4 h-4 text-[var(--accent-text)]" />
              <span>{t('dochub_doc_title')}</span>
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {t('dochub_doc_sub')}
            </p>
          </div>

          <form onSubmit={handleGenerateDoc} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                {t('dochub_doc_name_label')}
              </label>
              <input
                type="text"
                required
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder={t('dochub_doc_name_ph')}
                className="w-full px-3 py-2 text-xs bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-fill)] text-[var(--text-primary)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  {t('dochub_doc_subject_label')}
                </label>
                <input
                  type="text"
                  value={docSubject}
                  onChange={(e) => setDocSubject(e.target.value)}
                  placeholder={t('dochub_doc_subject_ph')}
                  className="w-full px-3 py-2 text-xs bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-fill)] text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  {t('dochub_doc_style_label')}
                </label>
                <select
                  value={docStyle}
                  onChange={(e) => setDocStyle(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-fill)] text-[var(--text-primary)]"
                >
                  <option value="Academic Standard">{t('dochub_doc_style_std')}</option>
                  <option value="MLA">{t('dochub_doc_style_mla')}</option>
                  <option value="APA">{t('dochub_doc_style_apa')}</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                {t('dochub_doc_rubric_label')}
              </label>
              <textarea
                rows={4}
                value={docRubric}
                onChange={(e) => setDocRubric(e.target.value)}
                placeholder={t('dochub_doc_rubric_ph')}
                className="w-full p-3 text-xs bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-fill)] text-[var(--text-primary)] resize-none"
              />
            </div>

            {docMessage && (
              <p className="text-xs text-[var(--accent-text)] font-medium">{docMessage}</p>
            )}

            {generatedDocUrl && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                <span className="text-xs text-emerald-800 dark:text-emerald-300 font-bold">
                  {t('dochub_doc_created_banner')}
                </span>
                <a
                  href={generatedDocUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                >
                  <span>{t('dochub_doc_open')}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {!isGoogleConnected && onConnectGoogle && (
              <div className="p-3 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border-default)] flex items-center justify-between gap-3 text-xs">
                <span className="text-[var(--text-secondary)]">
                  {t('dochub_doc_connect_hint')}
                </span>
                <button
                  type="button"
                  onClick={onConnectGoogle}
                  className="shrink-0 px-3 py-1.5 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-lg font-bold cursor-pointer"
                >
                  {t('dochub_doc_connect_btn')}
                </button>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isGeneratingDoc || !docTitle.trim()}
                className="px-5 py-2 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isGeneratingDoc ? 'animate-spin' : ''}`} />
                <span>{isGeneratingDoc ? t('dochub_doc_creating') : isGoogleConnected ? t('dochub_doc_generate_btn') : t('dochub_doc_connect_create_btn')}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

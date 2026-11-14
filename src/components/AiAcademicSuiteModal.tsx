import React, { useState } from 'react';
import {
  Sparkles,
  Calendar,
  BookOpen,
  HelpCircle,
  TrendingUp,
  X,
  Plus,
  Check,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Zap,
  Clock,
  Send,
  Award,
  Layers,
} from 'lucide-react';
import {
  generateInteractiveQuiz,
  generateDailyStudyPlan,
  calculateGradePrediction,
  parseSyllabusContent,
  QuizQuestion,
  DailyStudyPlanResult,
  GradePredictionResult,
  ParsedSyllabusData,
} from '../services/gemini';
import { Assignment } from '../types';
import { MathMarkdown } from './MathMarkdown';
import { useT } from '../services/i18n';

type SuiteTab = 'planner' | 'syllabus' | 'quiz' | 'grades';

const SUITE_TABS = [
  { id: 'planner', labelKey: 'suite_tab_planner', icon: Calendar },
  { id: 'syllabus', labelKey: 'suite_tab_syllabus', icon: BookOpen },
  { id: 'quiz', labelKey: 'suite_tab_quiz', icon: HelpCircle },
  { id: 'grades', labelKey: 'suite_tab_grades', icon: TrendingUp },
] as const;

const ENERGY_LEVEL_KEYS = {
  low: 'suite_planner_energy_low',
  medium: 'suite_planner_energy_med',
  high: 'suite_planner_energy_high',
} as const;

const GRADE_STATUS_KEYS = {
  Guaranteed: 'suite_grades_status_guaranteed',
  Achievable: 'suite_grades_status_achievable',
  Challenging: 'suite_grades_status_challenging',
  'High Risk': 'suite_grades_status_high_risk',
} as const;

interface AiAcademicSuiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignments: Assignment[];
  onAddAssignments?: (newAssignments: Partial<Assignment>[]) => void;
  defaultTab?: SuiteTab;
}

export const AiAcademicSuiteModal: React.FC<AiAcademicSuiteModalProps> = ({
  isOpen,
  onClose,
  assignments,
  onAddAssignments,
  defaultTab = 'planner',
}) => {
  const [activeTab, setActiveTab] = useState<SuiteTab>(defaultTab);

  // 1. Planner State
  const [energyLevel, setEnergyLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [availableHours, setAvailableHours] = useState<number>(3);
  const [isPlanning, setIsPlanning] = useState(false);
  const [studyPlan, setStudyPlan] = useState<DailyStudyPlanResult | null>(null);
  const [suiteError, setSuiteError] = useState<string | null>(null);

  // 2. Syllabus Parser State
  const [syllabusText, setSyllabusText] = useState('');
  const [isParsingSyllabus, setIsParsingSyllabus] = useState(false);
  const [parsedSyllabus, setParsedSyllabus] = useState<ParsedSyllabusData | null>(null);
  const [syllabusImported, setSyllabusImported] = useState(false);

  // 3. Quiz State
  const [quizNotes, setQuizNotes] = useState('');
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[] | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // 4. Grade Predictor State
  const [currentGrade, setCurrentGrade] = useState<number>(82);
  const [desiredGrade, setDesiredGrade] = useState<number>(90);
  const [finalExamWeight, setFinalExamWeight] = useState<number>(30);
  const [predictionResult, setPredictionResult] = useState<GradePredictionResult | null>(() =>
    calculateGradePrediction({ currentGrade: 82, desiredGrade: 90, finalExamWeight: 30 })
  );
  const { t } = useT();

  if (!isOpen) return null;

  // Handle Daily Planner
  const handleGeneratePlan = async () => {
    setSuiteError(null);
    setIsPlanning(true);
    try {
      const pendingTaskTitles = assignments
        .filter((a) => a.status !== 'Done')
        .slice(0, 8)
        .map((a) => `${a.assignmentName} (${a.subject || 'General'}) due ${a.dueDate || 'Soon'}`);

      const tasksToUse =
        pendingTaskTitles.length > 0
          ? pendingTaskTitles
          : [
              'Complete Math Problem Set 4',
              'Read Biology Chapter 7 & summarize',
              'Review Chemistry lecture notes & flashcards',
            ];

      const res = await generateDailyStudyPlan({
        tasks: tasksToUse,
        energy: energyLevel,
        hoursAvailable: availableHours,
      });
      setStudyPlan(res);
    } catch (err: any) {
      console.error('Error generating plan:', err);
      setSuiteError(err?.message || t('suite_planner_err'));
    } finally {
      setIsPlanning(false);
    }
  };

  // Handle Syllabus Parser
  const handleParseSyllabus = async () => {
    if (!syllabusText.trim()) return;
    setIsParsingSyllabus(true);
    setSyllabusImported(false);
    try {
      const res = await parseSyllabusContent(syllabusText);
      setParsedSyllabus(res);
    } catch (err: any) {
      console.error('Error parsing syllabus:', err);
      setSuiteError(err?.message || t('suite_syllabus_err'));
    } finally {
      setIsParsingSyllabus(false);
    }
  };

  const handleImportSyllabusDeadlines = () => {
    if (!parsedSyllabus || !onAddAssignments) return;
    const newItems: Partial<Assignment>[] = parsedSyllabus.deadlines.map((d) => ({
      assignmentName: d.title,
      subject: parsedSyllabus.courseTitle || t('plan_course'),
      dueDate: d.dueDate,
      priority: d.type === 'Exam' ? 'High' : 'Med',
      status: 'Not Started',
      notes: t('suite_syllabus_notes', {
        course: parsedSyllabus.courseTitle,
        instructor: parsedSyllabus.instructor,
      }),
    }));
    onAddAssignments(newItems);
    setSyllabusImported(true);
  };

  // Handle Quiz
  const handleGenerateQuiz = async () => {
    if (!quizNotes.trim()) return;
    setIsGeneratingQuiz(true);
    setQuizSubmitted(false);
    setSelectedAnswers({});
    try {
      const res = await generateInteractiveQuiz(quizNotes);
      setQuizQuestions(res);
    } catch (err: any) {
      console.error('Error generating quiz:', err);
      setSuiteError(err?.message || t('suite_quiz_err'));
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const calculateQuizScore = () => {
    if (!quizQuestions) return 0;
    let score = 0;
    quizQuestions.forEach((q) => {
      if (selectedAnswers[q.id] === q.correctIndex) {
        score++;
      }
    });
    return score;
  };

  // Handle Grade Predictor
  const handleRecalculateGrade = (cur: number, des: number, weight: number) => {
    setCurrentGrade(cur);
    setDesiredGrade(des);
    setFinalExamWeight(weight);
    setPredictionResult(
      calculateGradePrediction({
        currentGrade: cur,
        desiredGrade: des,
        finalExamWeight: weight,
      })
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 select-none animate-in fade-in duration-150">
      <div className="bg-[var(--bg-raised)] text-[var(--text-primary)] w-full max-w-4xl max-h-[90vh] rounded-3xl border border-[var(--border-default)] shadow-2xl flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <header className="p-6 border-b border-[var(--border-default)] flex items-center justify-between bg-[var(--bg-surface)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--accent-fill)] text-white flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                {t('suite_title')}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {t('suite_sub')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label={t('close')}
            className="p-2 rounded-2xl bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border-default)] hover:border-[var(--accent-border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Tab Switcher */}
        <div className="px-6 pt-4 border-b border-[var(--border-default)] bg-[var(--bg-surface)] flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0">
          {SUITE_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSuiteError(null); }}
                className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border-b-2 ${
                  isActive
                    ? 'bg-[var(--accent-soft)] text-[var(--accent-text)] border-[var(--accent-border)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t(tab.labelKey)}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {suiteError && (
            <div role="alert" className="p-3.5 rounded-2xl bg-[var(--status-err-bg)] border border-[var(--status-err-border)] text-xs text-[var(--status-err-text)] flex items-center justify-between gap-3">
              <span>{suiteError}</span>
              <button
                type="button"
                onClick={() => setSuiteError(null)}
                className="shrink-0 font-bold underline hover:opacity-80 cursor-pointer"
              >
                {t('suite_dismiss')}
              </button>
            </div>
          )}

          {/* TAB 1: AI DAILY STUDY PLANNER */}
          {activeTab === 'planner' && (
            <div className="space-y-6">
              <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">
                      {t('suite_planner_title')}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)]">
                      {t('suite_planner_sub')}
                    </p>
                  </div>

                  <button
                    onClick={handleGeneratePlan}
                    disabled={isPlanning}
                    className="px-5 py-2 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-2"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>{isPlanning ? t('suite_planner_btn_loading') : t('suite_planner_btn')}</span>
                  </button>
                </div>

                {/* Energy & Hours Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[var(--border-default)]">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--text-primary)]">
                      {t('suite_planner_energy_label')}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['low', 'medium', 'high'] as const).map((lvl) => (
                        <button
                          key={lvl}
                          onClick={() => setEnergyLevel(lvl)}
                          className={`py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer border ${
                            energyLevel === lvl
                              ? 'bg-[var(--accent-fill)] text-white border-[var(--accent-fill)] shadow-xs'
                              : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-default)] hover:bg-[var(--bg-hover)]'
                          }`}
                        >
                          {t(ENERGY_LEVEL_KEYS[lvl])}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>{t('suite_planner_hours_label')}</span>
                      <span className="text-[var(--accent-text)]">{t('suite_planner_hours_val', { hours: availableHours })}</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={8}
                      step={0.5}
                      value={availableHours}
                      aria-label={t('suite_planner_hours_label')}
                      onChange={(e) => setAvailableHours(parseFloat(e.target.value))}
                      className="w-full accent-[var(--accent-fill)] cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Study Plan Output */}
              {studyPlan && (
                <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-6 shadow-xs space-y-4 animate-in fade-in">
                  <div className="p-3.5 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border-default)] flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-[var(--accent-text)] shrink-0 mt-0.5" />
                    <div className="text-xs text-[var(--text-primary)] leading-relaxed">
                      <strong>{t('suite_planner_strategy')}</strong> {studyPlan.summary}
                      <p className="text-[11px] text-[var(--text-muted)] mt-1 font-semibold italic">
                        {t('suite_planner_tip')} {studyPlan.motivationTip}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      {t('suite_planner_schedule')}
                    </h4>
                    {studyPlan.blocks.map((block, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border-default)] flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span className="px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/5 font-mono font-bold text-[11px] text-[var(--accent-text)]">
                            {block.time}
                          </span>
                          <div>
                            <div className="font-bold text-[var(--text-primary)]">
                              {block.task}
                            </div>
                            <div className="text-[10px] text-[var(--text-muted)]">
                              {t('suite_planner_strategy')} {block.strategy}
                            </div>
                          </div>
                        </div>
                        <span className="text-[11px] text-[var(--text-muted)] shrink-0">
                          {t('suite_planner_mins', { mins: block.durationMinutes })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SYLLABUS DEADLINE PARSER */}
          {activeTab === 'syllabus' && (
            <div className="space-y-6">
              <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-5 shadow-xs space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    {t('suite_syllabus_title')}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    {t('suite_syllabus_sub')}
                  </p>
                </div>

                <textarea
                  rows={6}
                  value={syllabusText}
                  onChange={(e) => setSyllabusText(e.target.value)}
                  placeholder={t('suite_syllabus_ph')}
                  className="w-full p-4 text-xs font-mono bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-fill)]/20 focus:border-[var(--accent-fill)] text-[var(--text-primary)] leading-relaxed resize-none"
                />

                <div className="flex justify-end">
                  <button
                    onClick={handleParseSyllabus}
                    disabled={isParsingSyllabus || !syllabusText.trim()}
                    className="px-5 py-2.5 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{isParsingSyllabus ? t('suite_syllabus_btn_loading') : t('suite_syllabus_btn')}</span>
                  </button>
                </div>
              </div>

              {/* Parsed Output */}
              {parsedSyllabus && (
                <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-6 shadow-xs space-y-6 animate-in fade-in">
                  <div className="flex items-center justify-between pb-3 border-b border-[var(--border-default)]">
                    <div>
                      <h4 className="text-base font-bold text-[var(--text-primary)]">
                        {parsedSyllabus.courseTitle}
                      </h4>
                      <p className="text-xs text-[var(--text-muted)]">
                        {t('suite_syllabus_instructor', {
                          name: parsedSyllabus.instructor,
                          email: parsedSyllabus.email,
                          hours: parsedSyllabus.officeHours,
                        })}
                      </p>
                    </div>

                    <button
                      onClick={handleImportSyllabusDeadlines}
                      disabled={syllabusImported}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      {syllabusImported ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      <span>{syllabusImported ? t('suite_syllabus_imported') : t('suite_syllabus_import')}</span>
                    </button>
                  </div>

                  {/* Grading Breakdown */}
                  {parsedSyllabus.gradingBreakdown.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        {t('suite_syllabus_weights')}
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {parsedSyllabus.gradingBreakdown.map((gb, i) => (
                          <div
                            key={i}
                            className="p-3 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border-default)] text-center"
                          >
                            <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                              {gb.item}
                            </div>
                            <div className="text-sm font-bold text-[var(--accent-text)]">
                              {gb.weightPercent}%
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Extracted Deadlines */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      {t('suite_syllabus_deadlines', { count: parsedSyllabus.deadlines.length })}
                    </span>
                    <div className="space-y-1.5">
                      {parsedSyllabus.deadlines.map((dl, i) => (
                        <div
                          key={i}
                          className="p-3 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border-default)] flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)]">
                              {dl.type}
                            </span>
                            <span className="font-bold text-[var(--text-primary)]">
                              {dl.title}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-[var(--text-muted)]">
                            {dl.dueDate}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: INTERACTIVE AI QUIZ */}
          {activeTab === 'quiz' && (
            <div className="space-y-6">
              <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-5 shadow-xs space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    {t('suite_quiz_title')}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    {t('suite_quiz_sub')}
                  </p>
                </div>

                <textarea
                  rows={4}
                  value={quizNotes}
                  onChange={(e) => setQuizNotes(e.target.value)}
                  placeholder={t('suite_quiz_ph')}
                  className="w-full p-4 text-xs font-sans bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-fill)]/20 focus:border-[var(--accent-fill)] text-[var(--text-primary)] leading-relaxed resize-none"
                />

                <div className="flex justify-end">
                  <button
                    onClick={handleGenerateQuiz}
                    disabled={isGeneratingQuiz || !quizNotes.trim()}
                    className="px-5 py-2.5 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-2"
                  >
                    <HelpCircle className="w-4 h-4" />
                    <span>{isGeneratingQuiz ? t('suite_quiz_btn_loading') : t('suite_quiz_btn')}</span>
                  </button>
                </div>
              </div>

              {/* Quiz Questions Display */}
              {quizQuestions && quizQuestions.length > 0 && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between px-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      {t('suite_quiz_questions_count', { count: quizQuestions.length })}
                    </span>
                    {quizSubmitted && (
                      <div className="px-3 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-full font-bold text-xs">
                        {t('suite_quiz_score', {
                          score: calculateQuizScore(),
                          total: quizQuestions.length,
                          pct: Math.round((calculateQuizScore() / quizQuestions.length) * 100),
                        })}
                      </div>
                    )}
                  </div>

                  {quizQuestions.map((q, qIndex) => (
                    <div
                      key={q.id}
                      className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-5 shadow-xs space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-xs font-bold text-[var(--text-primary)] leading-snug">
                          <MathMarkdown>{`${qIndex + 1}. ${q.question}`}</MathMarkdown>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-default)]">
                          {q.topic}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {q.options.map((opt, optIndex) => {
                          const isSelected = selectedAnswers[q.id] === optIndex;
                          const isCorrect = q.correctIndex === optIndex;

                          let btnStyle = 'bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--accent-border)] hover:bg-[var(--bg-hover)]';
                          if (isSelected) {
                            btnStyle = 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)] font-bold';
                          }
                          if (quizSubmitted) {
                            if (isCorrect) {
                              btnStyle = 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold';
                            } else if (isSelected && !isCorrect) {
                              btnStyle = 'bg-rose-50 border-rose-500 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-bold';
                            }
                          }

                          return (
                            <button
                              key={optIndex}
                              disabled={quizSubmitted}
                              onClick={() =>
                                setSelectedAnswers((prev) => ({
                                  ...prev,
                                  [q.id]: optIndex,
                                }))
                              }
                              className={`p-3 rounded-xl border text-xs text-left transition-colors cursor-pointer flex items-center justify-between gap-2 ${btnStyle}`}
                            >
                              <MathMarkdown>{opt}</MathMarkdown>
                              {quizSubmitted && isCorrect && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>

                      {quizSubmitted && (
                        <div className="p-3 bg-[var(--status-warn-bg)] rounded-xl border border-[var(--status-warn-border)] text-[11px] text-[var(--text-secondary)] leading-relaxed">
                          <strong>{t('suite_quiz_explanation')}</strong>{' '}
                          <MathMarkdown>{q.explanation}</MathMarkdown>
                        </div>
                      )}
                    </div>
                  ))}

                  <div className="flex justify-end pt-2">
                    {!quizSubmitted ? (
                      <button
                        onClick={() => setQuizSubmitted(true)}
                        className="px-6 py-2.5 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                      >
                        {t('suite_quiz_submit')}
                      </button>
                    ) : (
                      <button
                        onClick={handleGenerateQuiz}
                        className="px-6 py-2.5 bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border-default)] hover:border-[var(--accent-border)] text-[var(--text-primary)] rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{t('suite_quiz_new')}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: GRADE & FINAL EXAM PREDICTOR */}
          {activeTab === 'grades' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-5 space-y-2">
                  <span className="text-xs font-bold text-[var(--text-muted)]">{t('suite_grades_current')}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={currentGrade}
                      aria-label={t('suite_grades_current')}
                      onChange={(e) =>
                        handleRecalculateGrade(
                          parseFloat(e.target.value) || 0,
                          desiredGrade,
                          finalExamWeight
                        )
                      }
                      className="w-full text-2xl font-bold font-mono px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)]"
                    />
                    <span className="text-sm font-bold text-[var(--text-muted)]">%</span>
                  </div>
                </div>

                <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-5 space-y-2">
                  <span className="text-xs font-bold text-[var(--text-muted)]">{t('suite_grades_target')}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={desiredGrade}
                      aria-label={t('suite_grades_target')}
                      onChange={(e) =>
                        handleRecalculateGrade(
                          currentGrade,
                          parseFloat(e.target.value) || 0,
                          finalExamWeight
                        )
                      }
                      className="w-full text-2xl font-bold font-mono px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-[var(--accent-text)]"
                    />
                    <span className="text-sm font-bold text-[var(--text-muted)]">%</span>
                  </div>
                </div>

                <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-5 space-y-2">
                  <span className="text-xs font-bold text-[var(--text-muted)]">{t('suite_grades_weight')}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={finalExamWeight}
                      aria-label={t('suite_grades_weight')}
                      onChange={(e) =>
                        handleRecalculateGrade(
                          currentGrade,
                          desiredGrade,
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full text-2xl font-bold font-mono px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)]"
                    />
                    <span className="text-sm font-bold text-[var(--text-muted)]">%</span>
                  </div>
                </div>
              </div>

              {/* Prediction Result Display */}
              {predictionResult && (
                <div className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-default)] p-8 shadow-xs text-center space-y-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    {t('suite_grades_required')}
                  </span>

                  <div className="text-6xl font-mono font-bold text-[var(--accent-text)]">
                    {predictionResult.requiredFinalScore}%
                  </div>

                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[var(--bg-subtle)] border border-[var(--border-default)] text-[var(--text-primary)]">
                    <span>{t('suite_grades_status')}</span>
                    <span
                      className={
                        predictionResult.status === 'Guaranteed' || predictionResult.status === 'Achievable'
                          ? 'text-emerald-600'
                          : 'text-rose-600'
                      }
                    >
                      {t(GRADE_STATUS_KEYS[predictionResult.status])}
                    </span>
                  </div>

                  <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto leading-relaxed">
                    {predictionResult.feedback}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

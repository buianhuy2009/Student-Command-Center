import React, { useState, useMemo } from 'react';
import {
  X,
  Sparkles,
  Calendar,
  Clock,
  CheckSquare,
  AlertTriangle,
  Play,
  ArrowRight,
  RefreshCw,
  Copy,
  Check,
  Zap,
  Coffee,
  Brain,
  Sliders,
} from 'lucide-react';
import { Assignment } from '../types';
import { generateDailyStudyPlan } from '../services/gemini';
import { useT } from '../services/i18n';

const PACING_OPTIONS = [
  { id: 'pomo', label: '25 / 5m', desc: 'plan_pace_sprint' },
  { id: 'deep', label: '50 / 10m', desc: 'plan_pace_deep' },
  { id: 'flow', label: '90 / 15m', desc: 'plan_pace_flow' },
] as const;

export interface PlannedBlock {
  timeRange: string;
  assignmentTitle: string;
  courseName: string;
  objective: string;
  isBreak: boolean;
  intensity: 'HIGH' | 'MEDIUM' | 'LOW' | 'REST';
}

interface StudyPlanGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignments: Assignment[];
  onAddStudyBlock?: (eventData: { title: string; description: string; startDateTime: string; endDateTime: string; location?: string; }) => void;
  onStartFocusSession?: (durationMinutes: number) => void;
}

export const StudyPlanGeneratorModal: React.FC<StudyPlanGeneratorModalProps> = ({
  isOpen,
  onClose,
  assignments,
  onStartFocusSession,
}) => {
  // Input settings
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<string[]>(() => {
    return assignments.filter((a) => a.status !== 'Done').slice(0, 5).map((a) => a.id);
  });

  const [startTime, setStartTime] = useState<string>('16:00');
  const [targetHours, setTargetHours] = useState<number>(4);
  const [studyPacing, setStudyPacing] = useState<'pomo' | 'deep' | 'flow'>('deep');
  const [energyProfile, setEnergyProfile] = useState<'heavy_first' | 'steady' | 'light_warmup'>('heavy_first');

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [planBlocks, setPlanBlocks] = useState<PlannedBlock[]>([]);
  const [planSummary, setPlanSummary] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const { t } = useT();

  const pendingAssignments = useMemo(() => {
    return assignments.filter((a) => a.status !== 'Done');
  }, [assignments]);

  if (!isOpen) return null;

  const toggleAssignment = (id: string) => {
    setSelectedAssignmentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleGeneratePlan = async () => {
    setIsGenerating(true);
    setPlanBlocks([]);
    setPlanSummary('');

    const chosenAssignments = assignments.filter((a) => selectedAssignmentIds.includes(a.id));

    try {
      const taskDescriptions = chosenAssignments.map(
        (a) => `${a.assignmentName} (${a.subject || 'Course'}) - Priority: ${a.priority}, Due: ${a.dueDate || 'Soon'}`
      );

      const energyVal = energyProfile === 'heavy_first' ? 'high' : energyProfile === 'steady' ? 'medium' : 'low';
      const result = await generateDailyStudyPlan({
        tasks: taskDescriptions.length > 0 ? taskDescriptions : ['General Review and Coursework'],
        energy: energyVal,
        hoursAvailable: targetHours,
      });

      if (result && result.blocks && Array.isArray(result.blocks)) {
        const blocks: PlannedBlock[] = result.blocks.map((b) => ({
          timeRange: b.time || '09:00 - 09:50',
          assignmentTitle: b.task || t('plan_fallback_block'),
          courseName: b.strategy || t('plan_fallback_course'),
          objective: b.strategy || t('plan_fallback_obj'),
          isBreak: b.task.toLowerCase().includes('break') || b.task.toLowerCase().includes('rest'),
          intensity: b.task.toLowerCase().includes('break') ? 'REST' : 'HIGH',
        }));
        setPlanBlocks(blocks);
        setPlanSummary(result.summary || t('plan_fallback_summary'));
      } else {
        throw new Error('Invalid plan format');
      }
    } catch (e) {
      console.warn('AI study plan fallback:', e);
      // Structured deterministic fallback
      const fallbackBlocks: PlannedBlock[] = [];
      const [startHourStr, startMinStr] = startTime.split(':');
      let currentHour = parseInt(startHourStr, 10) || 16;
      let currentMin = parseInt(startMinStr, 10) || 0;

      const blockMins = studyPacing === 'pomo' ? 25 : studyPacing === 'deep' ? 50 : 75;
      const breakMins = studyPacing === 'pomo' ? 5 : studyPacing === 'deep' ? 10 : 15;

      const itemsToSchedule = chosenAssignments.length > 0 ? chosenAssignments : pendingAssignments.slice(0, 3);

      itemsToSchedule.forEach((item) => {
        const startFormatted = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
        let endTotalMin = currentHour * 60 + currentMin + blockMins;
        const endHour = Math.floor(endTotalMin / 60) % 24;
        const endMin = endTotalMin % 60;
        const endFormatted = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

        fallbackBlocks.push({
          timeRange: `${startFormatted} - ${endFormatted}`,
          assignmentTitle: item.assignmentName,
          courseName: item.subject || t('plan_fallback_course'),
          objective: t('plan_fallback_item_obj', { title: item.assignmentName }),
          isBreak: false,
          intensity: item.priority === 'High' ? 'HIGH' : 'MEDIUM',
        });

        // Break
        const breakStartTotal = endTotalMin;
        const breakEndTotal = breakStartTotal + breakMins;
        const bStartHour = Math.floor(breakStartTotal / 60) % 24;
        const bStartMin = breakStartTotal % 60;
        const bEndHour = Math.floor(breakEndTotal / 60) % 24;
        const bEndMin = breakEndTotal % 60;

        fallbackBlocks.push({
          timeRange: `${String(bStartHour).padStart(2, '0')}:${String(bStartMin).padStart(2, '0')} - ${String(bEndHour).padStart(2, '0')}:${String(bEndMin).padStart(2, '0')}`,
          assignmentTitle: t('plan_fallback_rest_title'),
          courseName: t('plan_fallback_rest_course'),
          objective: t('plan_fallback_rest_obj'),
          isBreak: true,
          intensity: 'REST',
        });

        currentHour = Math.floor(breakEndTotal / 60) % 24;
        currentMin = breakEndTotal % 60;
      });

      setPlanBlocks(fallbackBlocks);
      setPlanSummary(t('plan_fallback_urgent_summary'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyPlan = () => {
    const text = planBlocks
      .map((b) => `${b.timeRange} | ${b.isBreak ? t('plan_rest') : b.courseName}: ${b.assignmentTitle} - ${b.objective}`)
      .join('\n');
    navigator.clipboard.writeText(`${t('plan_copy_header')}\n${planSummary}\n\n${text}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none animate-in fade-in duration-200">
      <div className="bg-[var(--bg-raised)] text-[var(--text-primary)] w-full max-w-4xl h-[90vh] rounded-3xl border border-[var(--border-default)] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-[var(--border-default)] flex items-center justify-between bg-[var(--bg-surface)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--accent-fill)] text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[var(--text-primary)]">
                {t('plan_title')}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {t('plan_sub')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label={t('close')}
            className="p-2 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent-border)] transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2-Column Main Workspace */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          
          {/* Left Column: Constraints & Assignment Picker */}
          <div className="w-full md:w-80 border-r border-[var(--border-default)] bg-[var(--bg-subtle)] p-5 overflow-y-auto space-y-6 shrink-0">
            
            {/* Start Time & Target Duration */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                {t('plan_session_timing')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] space-y-1">
                  <span className="text-[10px] text-[var(--text-muted)] font-bold block">{t('plan_start_time')}</span>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-transparent text-xs font-mono font-bold text-[var(--text-primary)] focus:outline-none"
                  />
                </div>

                <div className="p-3 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] space-y-1">
                  <span className="text-[10px] text-[var(--text-muted)] font-bold block">{t('plan_total_hours')}</span>
                  <select
                    value={targetHours}
                    onChange={(e) => setTargetHours(Number(e.target.value))}
                    className="w-full bg-transparent text-xs font-bold text-[var(--text-primary)] focus:outline-none cursor-pointer"
                  >
                    <option value={2}>2 {t('plan_hours')}</option>
                    <option value={3}>3 {t('plan_hours')}</option>
                    <option value={4}>4 {t('plan_hours')}</option>
                    <option value={5}>5 {t('plan_hours')}</option>
                    <option value={6}>6 {t('plan_hours')}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Pacing & Strategy */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                {t('plan_pacing')}
              </label>
              <div className="grid grid-cols-3 gap-1.5 bg-[var(--bg-canvas)] p-1.5 rounded-xl border border-[var(--border-default)]">
                {PACING_OPTIONS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setStudyPacing(p.id as any)}
                    className={`py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer ${
                      studyPacing === p.id
                        ? 'bg-[var(--accent-fill)] text-white shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <div className="text-xs font-bold">{p.label}</div>
                    <div className="text-[9px] opacity-80">{t(p.desc)}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Select Target Deadlines */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  {t('plan_targets')} ({selectedAssignmentIds.length})
                </label>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {pendingAssignments.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)] py-2">{t('plan_no_pending')}</p>
                ) : (
                  pendingAssignments.map((a) => {
                    const isSelected = selectedAssignmentIds.includes(a.id);
                    return (
                      <div
                        key={a.id}
                        onClick={() => toggleAssignment(a.id)}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 text-xs ${
                          isSelected
                            ? 'bg-[var(--bg-surface)] border-[var(--accent-border)] shadow-xs'
                            : 'bg-[var(--bg-surface)]/60 border-[var(--border-default)] opacity-60'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-[var(--text-primary)] truncate">
                            {a.assignmentName}
                          </p>
                          <span className="text-[10px] text-[var(--text-muted)]">
                            {a.subject || t('plan_course')} • {t('plan_due')} {a.dueDate || t('plan_soon')}
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-3.5 h-3.5 rounded text-[var(--accent-text)] focus:ring-[var(--accent-fill)] pointer-events-none"
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGeneratePlan}
              disabled={isGenerating || selectedAssignmentIds.length === 0}
              className="w-full py-3 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-2xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>{isGenerating ? t('plan_synthesizing') : t('plan_generate')}</span>
            </button>
          </div>

          {/* Right Column: Generated Plan View */}
          <div className="flex-1 bg-[var(--bg-surface)] p-6 sm:p-8 overflow-y-auto flex flex-col justify-between space-y-6">
            
            {planBlocks.length === 0 ? (
              <div className="my-auto text-center space-y-3 py-16">
                <div className="w-12 h-12 rounded-3xl bg-[var(--bg-subtle)] border border-[var(--border-default)] flex items-center justify-center mx-auto text-[var(--accent-text)]">
                  <Clock className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  {t('plan_ready_title')}
                </h3>
                <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto leading-relaxed">
                  {t('plan_ready_hint')}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Summary Banner */}
                <div className="p-4 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-default)] flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent-text)] flex items-center gap-1">
                      <Brain className="w-3.5 h-3.5" />
                      <span>{t('plan_flow_title')}</span>
                    </span>
                    <p className="text-xs text-[var(--text-primary)] font-medium leading-relaxed">
                      {planSummary}
                    </p>
                  </div>

                  <button
                    onClick={handleCopyPlan}
                    className="p-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer shrink-0"
                    title={t('plan_copy')}
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                {/* Timeline Blocks */}
                <div className="space-y-3">
                  {planBlocks.map((block, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        block.isBreak
                          ? 'bg-[var(--status-ok-bg)] border border-[var(--status-ok-border)] text-[var(--status-ok-text)]'
                          : 'bg-[var(--bg-subtle)] border border-[var(--border-default)]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)] shrink-0">
                          {block.timeRange}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-[var(--text-primary)]">
                              {block.assignmentTitle}
                            </h4>
                            <span className="text-[10px] font-semibold text-[var(--text-muted)]">
                              ({block.courseName})
                            </span>
                          </div>
                          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                            {block.objective}
                          </p>
                        </div>
                      </div>

                      {block.isBreak ? (
                        <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                          <Coffee className="w-3.5 h-3.5" />
                          <span>{t('plan_rest')}</span>
                        </div>
                      ) : (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          block.intensity === 'HIGH'
                            ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                            : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                        }`}>
                          {block.intensity} {t('plan_focus')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

              </div>
            )}

            {/* Bottom Actions Bar */}
            {planBlocks.length > 0 && (
              <div className="pt-4 border-t border-[var(--border-default)] flex items-center justify-between gap-3 shrink-0">
                <span className="text-xs text-[var(--text-muted)]">
                  {planBlocks.filter((b) => !b.isBreak).length} {t('plan_focus_blocks')} • {planBlocks.filter((b) => b.isBreak).length} {t('plan_rest_breaks')}
                </span>

                <div className="flex items-center gap-2">
                  {onStartFocusSession && (
                    <button
                      onClick={() => {
                        onClose();
                        onStartFocusSession(studyPacing === 'pomo' ? 25 : 50);
                      }}
                      className="px-4 py-2 bg-[var(--text-primary)] text-[var(--bg-canvas)] rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{t('plan_start_first')}</span>
                    </button>
                  )}

                  <button
                    onClick={onClose}
                    className="px-4 py-2 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    <span>{t('done')}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
};

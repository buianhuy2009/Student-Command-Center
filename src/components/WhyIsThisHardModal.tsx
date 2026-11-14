import React, { useState, useEffect } from 'react';
import {
  X,
  Brain,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Timer,
  RefreshCw,
  Lightbulb,
} from 'lucide-react';
import { explainWhyIsThisHard, WhyIsThisHardResult } from '../services/gemini';
import { useT } from '../services/i18n';

interface WhyIsThisHardModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignmentTitle: string;
  courseName?: string;
  description?: string;
  onStartFocusSession?: (title: string) => void;
}

export const WhyIsThisHardModal: React.FC<WhyIsThisHardModalProps> = ({
  isOpen,
  onClose,
  assignmentTitle,
  courseName,
  description,
  onStartFocusSession,
}) => {
  const { t } = useT();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<WhyIsThisHardResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && assignmentTitle) {
      loadAnalysis();
    } else {
      setResult(null);
      setError(null);
    }
  }, [isOpen, assignmentTitle]);

  const loadAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await explainWhyIsThisHard({
        title: assignmentTitle,
        courseName,
        description,
      });
      setResult(data);
    } catch (err: any) {
      console.error('Failed to analyze assignment difficulty:', err);
      setError(t('why_error_msg'));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in select-none">
      <div className="bg-[var(--bg-raised)] text-[var(--text-primary)] w-full max-w-2xl rounded-3xl border border-[var(--border-default)] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-[var(--border-default)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--accent-soft)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent-text)]">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-[var(--text-primary)]">
                  {t('tracker_cog_title')}
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[var(--bg-subtle)] border border-[var(--border-default)] text-[var(--text-muted)]">
                  {t('why_badge')}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] truncate max-w-md">
                {courseName ? `${courseName} • ` : ''}{assignmentTitle}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label={t('close')}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {isLoading ? (
            <div className="py-16 text-center space-y-4">
              <RefreshCw className="w-8 h-8 text-[var(--accent-text)] animate-spin mx-auto opacity-80" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-[var(--text-primary)]">
                  {t('why_loading_title')}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {t('why_loading_sub')}
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="p-5 rounded-2xl bg-[var(--status-err-bg)] border border-[var(--status-err-border)] text-[var(--status-err-text)] text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>{t('why_error_title')}</span>
              </div>
              <p>{error}</p>
              <button
                onClick={loadAnalysis}
                className="mt-2 px-3 py-1.5 bg-[var(--status-err-border)] hover:bg-[var(--status-err-text)] text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                {t('why_retry')}
              </button>
            </div>
          ) : result ? (
            <div className="space-y-6 animate-in fade-in">
              
              {/* 1. Core Difficulty */}
              <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent-text)] flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span>{t('why_core_title')}</span>
                </span>
                <p className="text-xs text-[var(--text-primary)] leading-relaxed">
                  {result.coreDifficultyReason}
                </p>
              </div>

              {/* 2. Common Student Pitfalls */}
              <div className="space-y-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  {t('why_pitfalls_title')}
                </span>
                <div className="space-y-2">
                  {result.cognitiveBottlenecks.map((trap, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] flex items-start gap-2.5 text-xs text-[var(--text-secondary)]"
                    >
                      <span className="w-4 h-4 rounded-full bg-[var(--status-warn-bg)] text-[var(--status-warn-text)] border border-[var(--status-warn-border)] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        !
                      </span>
                      <span>{trap}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Step-by-Step Approach Plan */}
              <div className="space-y-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  {t('why_strategy_title')}
                </span>
                <div className="space-y-2">
                  {result.recommendedStepByStepPlan.map((step, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] flex items-start gap-2.5 text-xs text-[var(--text-primary)]"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[var(--accent-text)] shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{step}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Prerequisite Concepts & Pomodoro Target */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                    <span>{t('why_prereq_title')}</span>
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {result.prerequisiteConcepts.map((concept, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg text-[10px] font-semibold text-[var(--text-primary)]"
                      >
                        {concept}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
                      <Timer className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                      <span>{t('why_effort_title')}</span>
                    </span>
                    <div className="text-xs font-bold text-[var(--text-primary)]">
                      {t('why_effort_value', {
                        count: result.estimatedPomodoros,
                        mins: result.estimatedPomodoros * 25,
                      })}
                    </div>
                  </div>
                  {onStartFocusSession && (
                    <button
                      onClick={() => {
                        onClose();
                        onStartFocusSession(assignmentTitle);
                      }}
                      className="px-3 py-1.5 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-[11px] font-bold transition-all shadow-xs cursor-pointer"
                    >
                      {t('why_start_sprint')}
                    </button>
                  )}
                </div>
              </div>

            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border-default)] bg-[var(--bg-surface)] flex items-center justify-between shrink-0 text-xs">
          <span className="text-[11px] text-[var(--text-muted)]">
            {t('why_footer_note')}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)] rounded-xl font-bold cursor-pointer hover:border-[var(--accent-border)] transition-colors"
          >
            {t('common_close')}
          </button>
        </div>

      </div>
    </div>
  );
};

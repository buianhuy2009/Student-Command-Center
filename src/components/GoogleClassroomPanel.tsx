import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  Plus,
  AlertTriangle,
  BookOpen,
  Calendar,
} from 'lucide-react';
import { CanvasAssignment } from '../types';
import { fetchAllClassroomAssignments } from '../services/googleClassroom';
import { useT } from '../services/i18n';

interface GoogleClassroomPanelProps {
  googleToken?: string;
  isGoogleConnected?: boolean;
  onConnectGoogle?: () => void;
  onSyncToSheet: (assignment: CanvasAssignment) => Promise<void>;
  classroomAssignments?: CanvasAssignment[];
  isLoading?: boolean;
  errorMessage?: string | null;
  onRefresh?: () => void;
}

export const GoogleClassroomPanel: React.FC<GoogleClassroomPanelProps> = ({
  googleToken,
  isGoogleConnected,
  onConnectGoogle,
  onSyncToSheet,
  classroomAssignments,
  isLoading: externalLoading,
  errorMessage: externalError,
  onRefresh: externalRefresh,
}) => {
  const { t, formatDate } = useT();
  const [internalAssignments, setInternalAssignments] = useState<CanvasAssignment[]>(() => {
    try {
      const saved = localStorage.getItem('scc_cached_classroom_assignments');
      if (!saved) return [];
      const parsed: CanvasAssignment[] = JSON.parse(saved);
      return Array.isArray(parsed)
        ? parsed.filter((item) => !String(item?.id || '').startsWith('gclass-mock-'))
        : [];
    } catch {
      return [];
    }
  });
  const [internalLoading, setInternalLoading] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [syncedIds, setSyncedIds] = useState<Set<string>>(new Set());

  const assignments = classroomAssignments !== undefined ? classroomAssignments : internalAssignments;
  const isLoading = externalLoading !== undefined ? externalLoading : internalLoading;
  const error = externalError !== undefined ? externalError : internalError;

  const loadAssignments = async () => {
    if (!isGoogleConnected && onConnectGoogle) {
      onConnectGoogle();
      return;
    }

    if (externalRefresh) {
      externalRefresh();
      return;
    }

    if (!googleToken && !isGoogleConnected) {
      return;
    }

    if (!googleToken) {
      setInternalError(t('classroom_token_expired'));
      return;
    }

    setInternalLoading(true);
    setInternalError(null);
    try {
      const data = await fetchAllClassroomAssignments(googleToken);
      setInternalAssignments(data);
      try {
        localStorage.setItem('scc_cached_classroom_assignments', JSON.stringify(data));
      } catch {}
    } catch (err: any) {
      console.warn('Classroom call failed:', err);
      setInternalError(
        err?.message ||
          t('classroom_fetch_err')
      );
      setInternalAssignments([]);
    } finally {
      setInternalLoading(false);
    }
  };

  useEffect(() => {
    if (classroomAssignments === undefined && isGoogleConnected && googleToken && internalAssignments.length === 0) {
      loadAssignments();
    }
  }, [googleToken, isGoogleConnected, classroomAssignments]);

  const handleSyncItem = async (assignment: CanvasAssignment) => {
    await onSyncToSheet(assignment);
    setSyncedIds((prev) => new Set(prev).add(assignment.id));
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="bg-[var(--bg-surface)] rounded-2xl p-5 border border-[var(--border-default)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] tracking-tight">
                {t('classroom_title')}
              </h2>
              {isGoogleConnected && (
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 rounded-full">
                  {t('classroom_connected_badge')}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {t('classroom_sub')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {!isGoogleConnected && onConnectGoogle && (
            <button
              onClick={onConnectGoogle}
              className="px-3.5 py-1.5 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <span>{t('classroom_connect_btn')}</span>
            </button>
          )}

          <button
            onClick={loadAssignments}
            disabled={isLoading || (!googleToken && !isGoogleConnected && !onConnectGoogle)}
            className="px-3 py-1.5 text-xs font-semibold bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] rounded-xl border border-[var(--border-default)] transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            title={t('classroom_refresh_title')}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[var(--accent-text)]' : ''}`} />
            <span>{isLoading ? t('syncing') : t('classroom_sync_btn')}</span>
          </button>

          <a
            href="https://classroom.google.com"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] rounded-xl text-xs font-semibold border border-[var(--border-default)] flex items-center gap-1 transition-colors"
          >
            <span>{t('classroom_open_btn')}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Info / Enablement Banner if needed */}
      {error && (
        <div className="p-4 bg-[var(--status-warn-bg)] border border-[var(--status-warn-border)] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[var(--status-warn-text)]">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-[var(--status-warn-text)] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">{t('classroom_perm_title')}</p>
              <p className="text-[11px] mt-0.5 text-[var(--status-warn-text)]">
                {error.includes('PERMISSION') || error.includes('403') || error.includes('401')
                  ? t('classroom_perm_desc')
                  : error}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onConnectGoogle && (
              <button
                onClick={onConnectGoogle}
                className="px-3 py-1.5 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                {t('classroom_connect_btn')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Coursework Cards Grid */}
      <section className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-default)]">
          <h3 className="font-bold text-[var(--text-primary)] text-xs uppercase tracking-wider flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
            <span>{t('classroom_coursework_heading', { count: isGoogleConnected ? assignments.length : 0 })}</span>
          </h3>
        </div>

        <div className="mt-4 space-y-3">
          {!isGoogleConnected ? (
            <div className="py-12 px-4 text-center bg-[var(--bg-subtle)] rounded-xl border border-dashed border-[var(--border-default)]">
              <GraduationCap className="w-10 h-10 mx-auto text-emerald-600 mb-2 opacity-80" />
              <h4 className="text-sm font-bold text-[var(--text-primary)]">{t('classroom_connect_btn')}</h4>
              <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm mx-auto">
                {t('classroom_connect_prompt')}
              </p>
              {onConnectGoogle && (
                <button
                  onClick={onConnectGoogle}
                  className="mt-3.5 px-4 py-2 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  {t('classroom_connect_btn')}
                </button>
              )}
            </div>
          ) : !googleToken && assignments.length === 0 ? (
            <div className="py-12 px-4 text-center bg-[var(--status-warn-bg)] rounded-xl border border-dashed border-[var(--status-warn-border)]">
              <AlertTriangle className="w-9 h-9 mx-auto text-[var(--status-warn-text)] mb-2 opacity-90" />
              <h4 className="text-sm font-bold text-[var(--text-primary)]">{t('classroom_reconnect_title')}</h4>
              <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-md mx-auto">
                {t('classroom_reconnect_desc')}
              </p>
              {onConnectGoogle && (
                <button
                  onClick={onConnectGoogle}
                  className="mt-3.5 px-4 py-2 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  {t('classroom_reconnect_btn')}
                </button>
              )}
            </div>
          ) : assignments.length === 0 ? (
            <div className="py-12 text-center text-[var(--text-muted)] text-xs">
              <p>{t('classroom_empty')}</p>
              <p className="text-[11px] text-[var(--text-muted)]/80 mt-1">
                {t('classroom_empty_hint')}
              </p>
            </div>
          ) : (
            assignments.map((work) => {
              const isSynced = syncedIds.has(work.id) || work.isSynced;
              return (
                <div
                  key={work.id}
                  className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-default)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-emerald-500/40 transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        {work.courseName}
                      </span>
                      {work.dueAt && (
                        <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1 font-mono">
                          <Calendar className="w-3 h-3 text-[var(--accent-text)]" />
                          <span>{t('classroom_due', { date: formatDate(work.dueAt) || work.dueAt })}</span>
                        </span>
                      )}
                      {work.pointsPossible !== undefined && (
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">
                          {t('classroom_pts', { pts: work.pointsPossible })}
                        </span>
                      )}
                    </div>

                    <h4 className="text-xs font-bold text-[var(--text-primary)] mt-1.5">
                      {work.name}
                    </h4>

                    {work.description && (
                      <p className="text-[11px] text-[var(--text-secondary)] mt-1 line-clamp-2">
                        {work.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--border-default)]">
                    <button
                      onClick={() => handleSyncItem(work)}
                      disabled={isSynced}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                        isSynced
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                          : 'bg-[var(--bg-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-border)] border-[var(--border-default)]'
                      }`}
                    >
                      {isSynced ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{t('classroom_in_tracker')}</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                          <span>{t('tracker_add_btn')}</span>
                        </>
                      )}
                    </button>

                    {work.htmlUrl && (
                      <a
                        href={work.htmlUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-[var(--text-secondary)] hover:text-emerald-600 hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                        title={t('classroom_open_item_title')}
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
      </section>
    </div>
  );
};

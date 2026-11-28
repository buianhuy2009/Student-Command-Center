import React, { useMemo, useState } from 'react';
import { Calendar, CheckCircle2, ExternalLink, Plus, Search, X } from 'lucide-react';
import type { CanvasAssignment } from '../types';
import { useT, type TranslationKey } from '../services/i18n';
import { filterClassroomWork, isClassroomOverdue, type ClassroomTab } from '../utils/classroomWork';

interface ClassroomWorkListProps {
  assignments: CanvasAssignment[];
  doneIds: ReadonlySet<string>;
  syncedIds: ReadonlySet<string>;
  onToggleDone: (id: string) => void;
  onAddToTracker: (assignment: CanvasAssignment) => void;
}

const TABS: readonly { id: ClassroomTab; labelKey: TranslationKey }[] = [
  { id: 'UNFINISHED', labelKey: 'classroom_tab_unfinished' },
  { id: 'DONE', labelKey: 'classroom_tab_done' },
  { id: 'ALL', labelKey: 'classroom_tab_all' },
];

export const ClassroomWorkList: React.FC<ClassroomWorkListProps> = ({
  assignments,
  doneIds,
  syncedIds,
  onToggleDone,
  onAddToTracker,
}) => {
  const { t, formatDate } = useT();
  const [tab, setTab] = useState<ClassroomTab>('UNFINISHED');
  const [query, setQuery] = useState('');

  const doneCount = useMemo(() => assignments.filter((a) => doneIds.has(a.id)).length, [assignments, doneIds]);
  const counts: Record<ClassroomTab, number> = {
    UNFINISHED: assignments.length - doneCount,
    DONE: doneCount,
    ALL: assignments.length,
  };
  const visible = filterClassroomWork(assignments, doneIds, tab, query);

  // A plain day such as 2026-11-28 must not shift a day back west of UTC.
  const formatDue = (dueAt: string) =>
    formatDate(/^\d{4}-\d{2}-\d{2}$/.test(dueAt) ? `${dueAt}T00:00:00` : dueAt) || dueAt;

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-1.5" role="tablist" aria-label={t('classroom_tabs_aria')}>
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                tab === item.id
                  ? 'bg-[var(--accent-fill)] text-white border-[var(--accent-fill)]'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-default)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              {t(item.labelKey)} ({counts[item.id]})
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('classroom_search_ph')}
            aria-label={t('classroom_search_ph')}
            className="w-full pl-8 pr-8 py-1.5 text-xs bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl focus:outline-none focus:ring-1 focus:ring-[var(--accent-fill)] text-[var(--text-primary)]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label={t('classroom_search_clear')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="py-10 text-center text-xs text-[var(--text-muted)]">
          {query.trim()
            ? t('classroom_no_match', { query: query.trim() })
            : tab === 'DONE'
              ? t('classroom_none_done')
              : t('all_caught_up')}
        </div>
      ) : (
        visible.map((work) => {
          const isDone = doneIds.has(work.id);
          const isSynced = syncedIds.has(work.id) || work.isSynced;
          const isOverdue = !isDone && isClassroomOverdue(work.dueAt);
          return (
            <div
              key={work.id}
              className={`p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-default)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-emerald-500/40 transition-colors ${isDone ? 'opacity-60' : ''}`}
            >
              <label className="flex items-start gap-3 min-w-0 flex-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDone}
                  onChange={() => onToggleDone(work.id)}
                  aria-label={t(isDone ? 'classroom_mark_unfinished' : 'classroom_mark_done', { name: work.name })}
                  className="w-4 h-4 mt-0.5 shrink-0 rounded accent-[var(--accent-fill)] cursor-pointer"
                />
                <span className="min-w-0 flex-1 block">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      {work.courseName}
                    </span>
                    {work.dueAt && (
                      <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3 text-[var(--accent-text)]" />
                        <span>{t('classroom_due', { date: formatDue(work.dueAt) })}</span>
                      </span>
                    )}
                    {isOverdue && (
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-[var(--status-err-bg)] text-[var(--status-err-text)] border border-[var(--status-err-border)]">
                        {t('classroom_overdue_badge')}
                      </span>
                    )}
                    {work.pointsPossible !== undefined && (
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">
                        {t('classroom_pts', { pts: work.pointsPossible })}
                      </span>
                    )}
                  </span>
                  <span className={`block text-xs font-bold text-[var(--text-primary)] mt-1.5 ${isDone ? 'line-through' : ''}`}>
                    {work.name}
                  </span>
                  {work.description && (
                    <span className="block text-[11px] text-[var(--text-secondary)] mt-1 line-clamp-2">
                      {work.description}
                    </span>
                  )}
                </span>
              </label>

              <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--border-default)]">
                <button
                  type="button"
                  onClick={() => onAddToTracker(work)}
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
  );
};

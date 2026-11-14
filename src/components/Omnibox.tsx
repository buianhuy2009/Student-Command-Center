import React, { useEffect, useMemo, useState } from 'react';
import { Search, Pin, ExternalLink, Plus, ArrowRight, X } from 'lucide-react';
import type { Assignment, CanvasAssignment, EmailMessage, SchoolFile, MarkdownNote, FlashcardItem } from '../types';
import { useT } from '../services/i18n';

export interface OmniboxItem {
  id: string;
  kind: 'assignment' | 'email' | 'file' | 'note' | 'flashcard' | 'app';
  title: string;
  subtitle: string;
  url?: string;
  raw?: any;
}

function fuzzy(hay: string, needle: string): boolean {
  const h = hay.toLowerCase(); const n = needle.toLowerCase().trim();
  if (!n) return true;
  let j = 0;
  for (const ch of h) { if (ch === n[j]) j++; if (j === n.length) return true; }
  return h.includes(n);
}

const RECENT_KEY = 'scc_omnibox_recent_v1';
const MAX_RECENTS = 5;

function readRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string').slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

/** True omnibox: Canvas + Gmail + Drive + notes + flashcards in one input, with preview + actions. */
export const Omnibox: React.FC<{
  query: string;
  onQuery: (q: string) => void;
  assignments: Assignment[];
  canvas: CanvasAssignment[];
  emails: EmailMessage[];
  files: SchoolFile[];
  notes: MarkdownNote[];
  flashcards: FlashcardItem[];
  onOpen: (item: OmniboxItem) => void;
  onPin: (item: OmniboxItem) => void;
  onCreateTask: (from: OmniboxItem) => void;
  onClose?: () => void;
}> = ({ query, onQuery, assignments, canvas, emails, files, notes, flashcards, onOpen, onPin, onCreateTask, onClose }) => {
  const { t, lang, formatDate } = useT();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recents, setRecents] = useState<string[]>(() => readRecents());

  const recordRecent = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setRecents((prev) => {
      const deduped = prev.filter((r) => r.toLowerCase() !== trimmed.toLowerCase());
      const next = [trimmed, ...deduped].slice(0, MAX_RECENTS);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable — ignore */
      }
      return next;
    });
  };

  // Refresh recents whenever the query is cleared (picks up writes from other mounts).
  useEffect(() => {
    if (!query.trim()) setRecents(readRecents());
  }, [query]);

  const handleOpen = (item: OmniboxItem) => {
    recordRecent(query);
    onOpen(item);
  };

  const statusLabel = (s: Assignment['status']) =>
    s === 'Done' ? t('done') : s === 'In Progress' ? t('tracker_status_in_progress') : t('tracker_status_not_started');

  const kindLabel = (k: OmniboxItem['kind']) => t(`omni_kind_${k}`);

  const results = useMemo<OmniboxItem[]>(() => {
    if (!query.trim()) return [];
    const out: OmniboxItem[] = [];
    for (const a of assignments) {
      if (fuzzy(`${a.assignmentName} ${a.subject}`, query)) out.push({ id: `a-${a.id}`, kind: 'assignment', title: a.assignmentName, subtitle: t('omni_sub_assignment', { subject: a.subject, dueDate: formatDate(a.dueDate) || a.dueDate, status: statusLabel(a.status) }), raw: a });
    }
    for (const c of canvas.slice(0, 50)) {
      if (fuzzy(`${c.name} ${c.courseName}`, query)) out.push({ id: `c-${c.id}`, kind: 'assignment', title: c.name, subtitle: t('omni_sub_canvas', { course: c.courseName }), url: c.htmlUrl, raw: c });
    }
    for (const e of emails.slice(0, 80)) {
      if (fuzzy(`${e.subject} ${e.sender} ${e.snippet}`, query)) out.push({ id: `e-${e.id}`, kind: 'email', title: e.subject, subtitle: `${e.sender} • ${formatDate(e.date) || e.date}`, raw: e });
    }
    for (const f of files.slice(0, 80)) {
      if (fuzzy(f.name, query)) out.push({ id: `f-${f.id}`, kind: 'file', title: f.name, subtitle: t('omni_sub_drive', { date: formatDate(f.modifiedTime) || f.modifiedTime }), url: f.webViewLink, raw: f });
    }
    for (const n of notes.slice(0, 80)) {
      if (fuzzy(`${n.title} ${n.content}`, query)) out.push({ id: `n-${n.id}`, kind: 'note', title: n.title, subtitle: t('omni_sub_note', { subject: n.subject ?? t('omni_general') }), raw: n });
    }
    for (const fc of flashcards.slice(0, 80)) {
      if (fuzzy(`${fc.front} ${fc.back}`, query)) out.push({ id: `fc-${fc.id}`, kind: 'flashcard', title: fc.front.slice(0, 80), subtitle: t('omni_sub_flashcard', { category: fc.category ?? '' }), raw: fc });
    }
    return out.slice(0, 30);
  }, [query, assignments, canvas, emails, files, notes, flashcards, t, formatDate, lang]);

  const selected = results.find((r) => r.id === selectedId) ?? results[0] ?? null;

  return (
    <div className="flex flex-col md:flex-row min-h-[320px] max-h-[60vh]">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-2 p-3 border-b" style={{ borderColor: 'var(--line)' }}>
          <Search className="w-4 h-4 opacity-60" />
          <input
            autoFocus value={query} onChange={(e) => onQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') recordRecent(query); }}
            placeholder={t('omni_search_ph')}
            className="flex-1 bg-transparent text-sm outline-none"
            aria-label={t('omni_search_aria')}
          />
          {onClose && <button onClick={onClose} className="p-2 min-w-[44px] min-h-[44px]" aria-label={t('omni_close_aria')}><X className="w-4 h-4" /></button>}
        </div>
        <div className="flex-1 overflow-y-auto" role="listbox" aria-label={t('omni_results_aria')}>
          {!query.trim() && recents.length > 0 && (
            <div className="p-4 flex flex-wrap gap-2" aria-label={t('omni_recents_aria')}>
              {recents.map((r) => (
                <button key={r} onClick={() => onQuery(r)}
                  className="px-3 py-2 text-xs font-semibold rounded-xl border hover:bg-black/5 dark:hover:bg-white/5 min-h-[44px]"
                  style={{ borderColor: 'var(--line)' }}>
                  {r}
                </button>
              ))}
            </div>
          )}
          {results.length === 0 && (!!query.trim() || recents.length === 0) && (
            <p className="p-6 text-xs opacity-60 text-center">{t('omni_empty_pre')} <kbd className="px-1 border rounded">C</kbd> {t('omni_empty_post')}</p>
          )}
          {results.map((r) => (
            <button key={r.id} role="option" aria-selected={selected?.id === r.id}
              onClick={() => setSelectedId(r.id)} onDoubleClick={() => handleOpen(r)}
              className="w-full text-left px-4 py-2.5 flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/5 min-h-[44px]"
              style={selected?.id === r.id ? { backgroundColor: 'var(--accent-soft)' } : undefined}>
              <span className="text-[10px] font-bold uppercase opacity-50 w-20 shrink-0">{kindLabel(r.kind)}</span>
              <span className="flex-1 min-w-0"><span className="block text-xs font-semibold truncate">{r.title}</span>
              <span className="block text-[11px] opacity-60 truncate">{r.subtitle}</span></span>
            </button>
          ))}
        </div>
      </div>
      {/* Preview pane */}
      <div className="w-full md:w-72 border-t md:border-t-0 md:border-l p-4 overflow-y-auto" style={{ borderColor: 'var(--line)' }}>
        {!selected ? <p className="text-xs opacity-60">{t('omni_select_preview')}</p> : (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase opacity-50">{t('omni_preview_badge', { kind: kindLabel(selected.kind) })}</p>
            <h4 className="text-sm font-bold leading-snug">{selected.title}</h4>
            <p className="text-xs opacity-70">{selected.subtitle}</p>
            {selected.kind === 'email' && <p className="text-xs leading-relaxed opacity-80 line-clamp-6">{(selected.raw as EmailMessage)?.snippet}</p>}
            {selected.kind === 'note' && <p className="text-xs leading-relaxed opacity-80 line-clamp-6">{(selected.raw as MarkdownNote)?.content?.slice(0, 400)}</p>}
            <div className="flex flex-wrap gap-2 pt-2">
              <button onClick={() => handleOpen(selected)} className="px-3 py-2 text-xs font-bold text-white rounded-xl min-h-[44px] inline-flex items-center gap-1" style={{ backgroundColor: 'var(--terracotta)' }}>
                <ArrowRight className="w-3.5 h-3.5" /> {t('common_open')}
              </button>
              <button onClick={() => onPin(selected)} className="px-3 py-2 text-xs font-bold rounded-xl border min-h-[44px] inline-flex items-center gap-1" style={{ borderColor: 'var(--line)' }}>
                <Pin className="w-3.5 h-3.5" /> {t('omni_pin')}
              </button>
              {(selected.kind === 'email' || selected.kind === 'assignment') && (
                <button onClick={() => onCreateTask(selected)} className="px-3 py-2 text-xs font-bold rounded-xl border min-h-[44px] inline-flex items-center gap-1" style={{ borderColor: 'var(--line)' }}>
                  <Plus className="w-3.5 h-3.5" /> {t('omni_task_from_this')}
                </button>
              )}
              {selected.url && (
                <a href={selected.url} target="_blank" rel="noreferrer" className="px-3 py-2 text-xs font-bold rounded-xl border min-h-[44px] inline-flex items-center gap-1" style={{ borderColor: 'var(--line)' }}>
                  <ExternalLink className="w-3.5 h-3.5" /> {t('trust_source')}
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

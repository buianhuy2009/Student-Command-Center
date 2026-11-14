import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, X } from 'lucide-react';
import { useT } from '../services/i18n';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUT_ITEMS = [
  { key: '⌘ + K / Ctrl + K', descKey: 'keys_d_open_palette' },
  { key: '0', descKey: 'keys_d_dash_home' },
  { key: '1', descKey: 'keys_d_canvas' },
  { key: '2', descKey: 'keys_d_schedule' },
  { key: '3', descKey: 'keys_d_tracker' },
  { key: '4', descKey: 'keys_d_gmail' },
  { key: '5', descKey: 'keys_d_drive' },
  { key: 'g d', descKey: 'keys_d_go_dash' },
  { key: 'g c', descKey: 'keys_d_go_canvas' },
  { key: 'g t', descKey: 'keys_d_go_tracker' },
  { key: 'g m', descKey: 'keys_d_go_gmail' },
  { key: 'n', descKey: 'keys_d_quick_tracker' },
  { key: 'f', descKey: 'keys_d_focus_mode' },
  { key: 'R', descKey: 'keys_d_sync' },
  { key: '?', descKey: 'keys_d_help' },
  { key: 'Esc', descKey: 'keys_d_close' },
] as const;

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  const { t } = useT();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const shortcuts = SHORTCUT_ITEMS.map((item) => ({
    key: item.key,
    description: t(item.descKey),
  }));

  const q = query.trim().toLowerCase();
  const filteredShortcuts = q
    ? shortcuts.filter(
        (sc) =>
          sc.key.toLowerCase().includes(q) ||
          sc.description.toLowerCase().includes(q)
      )
    : shortcuts;

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      inputRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      id="shortcuts-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[var(--bg-raised)] border border-[var(--border-default)] rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 text-[var(--text-primary)]">
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-default)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)] flex items-center justify-center">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                {t('keys_title')}
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                {t('keys_sub')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label={t('close')}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4">
          <input
            ref={inputRef}
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape') {
                e.preventDefault();
                if (query !== '') {
                  setQuery('');
                } else {
                  onClose();
                }
              }
            }}
            placeholder={t('keys_filter_ph')}
            className="w-full mb-3 px-3 py-2 text-xs rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-hidden focus:border-[var(--accent-fill)]"
          />
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {filteredShortcuts.length === 0 ? (
            <div className="p-2 rounded-lg text-xs text-center text-[var(--text-muted)]">
              {t('keys_no_matches')}
            </div>
          ) : (
            filteredShortcuts.map((sc, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)] text-xs"
            >
              <span className="text-[var(--text-secondary)] font-medium">
                {sc.description}
              </span>
              <kbd className="px-2 py-1 font-mono text-[11px] font-semibold bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-md text-[var(--text-primary)] shadow-2xs">
                {sc.key}
              </kbd>
            </div>
            ))
          )}
          </div>
        </div>

        <div className="mt-6 pt-3 border-t border-[var(--border-default)] text-center">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-lg cursor-pointer"
          >
            {t('got_it')}
          </button>
        </div>
      </div>
    </div>
  );
};

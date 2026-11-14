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
      <div className="bg-white dark:bg-[#1A1917] border border-[#DFDACB] dark:border-[#2C2B27] rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95">
        <div className="flex items-center justify-between pb-4 border-b border-[#DFDACB] dark:border-[#2C2B27]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#D97757]/15 text-[#D97757] flex items-center justify-center">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#141413] dark:text-[#FAF9F5]">
                {t('keys_title')}
              </h3>
              <p className="text-xs text-[#6B6860]">
                {t('keys_sub')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label={t('close')}
            className="text-[#8C897F] hover:text-[#141413] dark:hover:text-[#FAF9F5] p-1.5 rounded-lg hover:bg-[#FAF9F5] dark:hover:bg-[#252422] transition-colors"
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
            className="w-full mb-3 px-3 py-2 text-xs rounded-lg bg-[#FAF9F5] dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] text-[#141413] dark:text-[#FAF9F5] placeholder:text-[#8C897F] outline-hidden focus:border-[#D97757]"
          />
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {filteredShortcuts.length === 0 ? (
            <div className="p-2 rounded-lg text-xs text-center text-[#8C897F]">
              {t('keys_no_matches')}
            </div>
          ) : (
            filteredShortcuts.map((sc, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 rounded-lg bg-[#FAF9F5] dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] text-xs"
            >
              <span className="text-[#5C5A54] dark:text-[#B5B2A8] font-medium">
                {sc.description}
              </span>
              <kbd className="px-2 py-1 font-mono text-[11px] font-semibold bg-white dark:bg-[#1A1917] border border-[#DFDACB] dark:border-[#2C2B27] rounded-md text-[#141413] dark:text-[#FAF9F5] shadow-2xs">
                {sc.key}
              </kbd>
            </div>
            ))
          )}
          </div>
        </div>

        <div className="mt-6 pt-3 border-t border-[#DFDACB] dark:border-[#2C2B27] text-center">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-[#D97757] hover:bg-[#C86646] text-white rounded-lg cursor-pointer"
          >
            {t('got_it')}
          </button>
        </div>
      </div>
    </div>
  );
};

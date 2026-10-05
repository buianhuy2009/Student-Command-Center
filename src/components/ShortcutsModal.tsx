import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, X } from 'lucide-react';
import { APP_CATALOG } from './AppStoreModal';
import { t, useLang } from '../services/i18n';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  useLang();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const dynamicAppShortcuts = useMemo(() => {
    return APP_CATALOG.slice(0, 12).map((app, idx) => ({
      key: idx < 5 ? `${idx+1}` : `g ${app.id.slice(0,2)}`,
      description: `Open ${app.name} (${app.category})`,
    }));
  }, []);

  const shortcuts = [
    { key: '⌘ + K / Ctrl + K', description: t('keys_d_open_palette') },
    { key: '1', description: t('keys_d_canvas') },
    { key: '2', description: t('keys_d_schedule') },
    { key: '3', description: t('keys_d_tracker') },
    { key: '4', description: t('keys_d_gmail') },
    { key: '5', description: t('keys_d_drive') },
    ...dynamicAppShortcuts.slice(5, 8),
    { key: 'R', description: t('keys_d_sync') },
    { key: 'D', description: t('keys_d_theme') },
    { key: 'A', description: t('keys_d_ai') },
    { key: '?', description: t('keys_d_help') },
    { key: 'Esc', description: t('keys_d_close') },
  ];

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
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
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
              <h3 id="shortcuts-modal-title" className="text-base font-bold text-[#141413] dark:text-[#FAF9F5]">
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

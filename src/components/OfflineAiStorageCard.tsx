import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Cpu, HardDrive, RefreshCw, Trash2, WifiOff } from 'lucide-react';
import {
  clearLocalModelCache,
  getCachedModelsInfo,
  unloadAllLocalAi,
  type CachedModelsInfo,
} from '../services/localAi';
import { useT } from '../services/i18n';

export const OfflineAiStorageCard: React.FC = () => {
  const { t } = useT();
  const [info, setInfo] = useState<CachedModelsInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const data = await getCachedModelsInfo();
    setInfo(data);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleFreeRam = async () => {
    setBusy(true);
    setNotice(null);
    try {
      await unloadAllLocalAi();
      await refresh();
      setNotice(t('offline_storage_ram_freed'));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteModels = async () => {
    setBusy(true);
    setNotice(null);
    try {
      await clearLocalModelCache();
      setConfirmDelete(false);
      await refresh();
      setNotice(t('offline_storage_deleted'));
    } finally {
      setBusy(false);
    }
  };

  const itemLabel = (key: 'quick_llm' | 'deeper_llm' | 'photo_scanner') => {
    if (key === 'deeper_llm') return t('offline_storage_item_deeper');
    if (key === 'quick_llm') return t('offline_storage_item_quick');
    return t('offline_storage_item_scanner');
  };

  const activeSlotLabel = () => {
    if (!info?.activeSlot) return t('offline_storage_ram_idle');
    if (info.activeSlot === 'llm:deeper') return t('offline_storage_item_deeper');
    if (info.activeSlot === 'llm:quick') return t('offline_storage_item_quick');
    return t('offline_storage_item_scanner');
  };

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-subtle)]/50 p-4 space-y-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <div className="w-8 h-8 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)] flex items-center justify-center shrink-0">
            <WifiOff className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-extrabold text-[var(--text-primary)]">
              {t('offline_storage_title')}
            </h4>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">
              {t('offline_storage_sub')}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={busy}
          aria-label={t('offline_storage_refresh')}
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex items-start gap-1.5 px-3 py-2 rounded-xl bg-[var(--status-warn-bg)] border border-[var(--status-warn-border)] text-[11px] text-[var(--status-warn-text)]">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>{t('offline_storage_honest_warn')}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]">
            <HardDrive className="w-3.5 h-3.5 text-[var(--accent-text)]" />
            <span>{t('offline_storage_used_label')}</span>
          </span>
          <span className="font-mono font-bold text-[var(--text-primary)]">
            {info ? `${info.totalMb} MB` : '…'}
          </span>
        </div>
        <div className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]">
            <Cpu className="w-3.5 h-3.5 text-[var(--accent-text)]" />
            <span>{t('offline_storage_ram_label')}</span>
          </span>
          <span className="font-semibold text-[var(--text-primary)] truncate">
            {activeSlotLabel()}
          </span>
        </div>
      </div>

      {info && info.items.length > 0 ? (
        <ul className="space-y-1">
          {info.items.map((item) => (
            <li
              key={item.key}
              className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[11px]"
            >
              <span className="font-medium text-[var(--text-primary)]">{itemLabel(item.key)}</span>
              <span className="font-mono text-[var(--text-muted)]">{item.mb} MB</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-[var(--text-muted)]">{t('offline_storage_empty')}</p>
      )}

      {notice && (
        <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">{notice}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleFreeRam}
          disabled={busy}
          className="px-3 py-1.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[11px] font-semibold text-[var(--text-primary)] cursor-pointer disabled:opacity-50"
        >
          {t('offline_storage_free_ram_btn')}
        </button>

        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={busy || (info?.totalBytes ?? 0) === 0}
            className="px-3 py-1.5 rounded-xl border border-[var(--status-err-border)] bg-[var(--bg-surface)] hover:bg-[var(--status-err-bg)] text-[11px] font-semibold text-[var(--status-err-text)] inline-flex items-center gap-1 cursor-pointer disabled:opacity-40"
          >
            <Trash2 className="w-3 h-3" />
            <span>{t('offline_storage_delete_btn')}</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleDeleteModels}
              disabled={busy}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer"
            >
              {t('offline_storage_delete_confirm')}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="px-2.5 py-1.5 rounded-xl border border-[var(--border-default)] text-[11px] font-semibold cursor-pointer"
            >
              {t('common_cancel')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

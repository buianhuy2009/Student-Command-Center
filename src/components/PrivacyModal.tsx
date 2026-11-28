import React, { useEffect, useState } from 'react';
import { ShieldCheck, Trash2, LogOut, X } from 'lucide-react';
import { useT } from '../services/i18n';
import type { GoogleFeature } from '../services/googleAuth';
import { PermissionManagerPanel } from './privacy/PermissionManagerPanel';
import { AiDataDisclosurePanel } from './privacy/AiDataDisclosurePanel';

export type PrivacyTab = 'permissions' | 'ai' | 'storage';

export interface PrivacyModalProps {
  onClose: () => void;
  onRevoke: () => void;
  onDeleteAll: () => Promise<void>;
  userUid?: string | null;
  userEmail?: string | null;
  onConnectFeature?: (feature: GoogleFeature) => void;
  onClearCanvasToken?: () => void;
  initialTab?: PrivacyTab;
}

const tr = (t: (k: string) => string, key: string, en: string, vi: string, lang: string): string => {
  const val = t(key);
  return !val || val === key ? (lang === 'vi' ? vi : en) : val;
};

/** Unified Privacy & Access Control Center modal with backward-compatible optional props. */
export const PrivacyModal: React.FC<PrivacyModalProps> = ({
  onClose,
  onRevoke,
  onDeleteAll,
  userUid,
  userEmail,
  onConnectFeature,
  onClearCanvasToken,
  initialTab = 'permissions',
}) => {
  const { t, lang } = useT();
  const [activeTab, setActiveTab] = useState<PrivacyTab>(initialTab);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const tabs: Array<{ id: PrivacyTab; label: string }> = [
    { id: 'permissions', label: tr(t, 'privacy_tab_permissions', 'Access Permissions', 'Quyền truy cập', lang) },
    { id: 'ai', label: tr(t, 'privacy_tab_ai', 'AI Data & Tutor', 'Dữ liệu AI & Gia sư', lang) },
    { id: 'storage', label: tr(t, 'privacy_tab_storage', 'Storage & Parents', 'Lưu trữ & Phụ huynh', lang) },
  ];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 isolate"
      role="dialog"
      aria-modal="true"
      aria-label={t('privacy_dialog_aria')}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-3xl max-h-[88vh] flex flex-col overflow-hidden bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-default)] shadow-2xl">
        <div className="px-5 sm:px-6 pt-5 pb-3 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] shrink-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-extrabold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[var(--accent-text)] shrink-0" />
              <span>{t('privacy_title')}</span>
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common_close')}
              className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div role="tablist" aria-label={t('privacy_dialog_aria')} className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-default)]">
            {tabs.map((tab) => {
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`privacy-tab-${tab.id}`}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  aria-controls={`privacy-panel-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-2.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    selected
                      ? 'bg-[var(--bg-surface)] text-[var(--accent-text)] shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{t('privacy_intro')}</p>

          <div id="privacy-panel-permissions" role="tabpanel" aria-labelledby="privacy-tab-permissions" hidden={activeTab !== 'permissions'}>
            <PermissionManagerPanel
              userUid={userUid}
              userEmail={userEmail}
              onConnectFeature={onConnectFeature}
              onClearCanvasToken={onClearCanvasToken}
            />
          </div>

          <div id="privacy-panel-ai" role="tabpanel" aria-labelledby="privacy-tab-ai" hidden={activeTab !== 'ai'}>
            <AiDataDisclosurePanel />
          </div>

          <div id="privacy-panel-storage" role="tabpanel" aria-labelledby="privacy-tab-storage" hidden={activeTab !== 'storage'} className="space-y-3 text-xs">
            <div className="p-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] space-y-2">
              <p className="font-bold text-[13px] text-[var(--text-primary)]">{t('privacy_sec_storage')}</p>
              <ul className="list-disc pl-4 space-y-1.5 text-[var(--text-secondary)]">
                <li>{t('privacy_store_1')}</li>
                <li>{t('privacy_store_2')}</li>
                <li>{t('privacy_store_3')}</li>
                <li>{t('privacy_store_4')}</li>
              </ul>
            </div>

            <div className="p-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] space-y-2">
              <p className="font-bold text-[13px] text-[var(--text-primary)]">{t('privacy_sec_parents')}</p>
              <ul className="list-disc pl-4 space-y-1.5 text-[var(--text-secondary)]">
                <li>{t('privacy_parent_1')}</li>
                <li>
                  {t('privacy_parent_2_prefix')}
                  <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer" className="underline font-semibold break-all text-[var(--accent-text)]">
                    myaccount.google.com/permissions
                  </a>
                  .
                </li>
                <li>{t('privacy_parent_3')}</li>
                <li>{t('privacy_parent_4')}</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="px-5 sm:px-6 py-3.5 border-t border-[var(--border-hairline)] bg-[var(--bg-subtle)] flex flex-wrap items-center gap-2 shrink-0">
          <button type="button" onClick={onRevoke} className="px-4 py-2.5 text-xs font-bold rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] min-h-[44px] inline-flex items-center gap-1 cursor-pointer">
            <LogOut className="w-3.5 h-3.5" /> {t('privacy_disconnect_btn')}
          </button>
          {!confirming ? (
            <button type="button" onClick={() => setConfirming(true)} className="px-4 py-2.5 text-xs font-bold rounded-xl border border-[var(--status-err-border)] bg-[var(--bg-surface)] text-[var(--status-err-text)] hover:bg-[var(--status-err-bg)] min-h-[44px] inline-flex items-center gap-1 cursor-pointer">
              <Trash2 className="w-3.5 h-3.5" /> {t('privacy_delete_btn')}
            </button>
          ) : (
            <>
              <button type="button" onClick={async () => { await onDeleteAll(); onClose(); }} className="px-4 py-2.5 text-xs font-bold rounded-xl bg-[var(--status-err-border)] hover:bg-[var(--status-err-text)] text-white min-h-[44px] cursor-pointer">
                {t('privacy_delete_confirm')}
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="px-4 py-2.5 text-xs font-bold rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] min-h-[44px] cursor-pointer">
                {t('common_cancel')}
              </button>
            </>
          )}
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-xs font-bold text-white rounded-xl min-h-[44px] ml-auto cursor-pointer bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)]">
            {t('common_done')}
          </button>
        </div>
      </div>
    </div>
  );
};

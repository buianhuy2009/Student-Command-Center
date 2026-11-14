import React, { useEffect } from 'react';
import { ShieldCheck, Trash2, LogOut, ChevronDown } from 'lucide-react';
import { useT } from '../services/i18n';

const FEATURE_PERMISSIONS = [
  { titleKey: 'privacy_perm_basic_t', descKey: 'privacy_perm_basic_d' },
  { titleKey: 'privacy_perm_cal_t', descKey: 'privacy_perm_cal_d' },
  { titleKey: 'privacy_perm_drive_t', descKey: 'privacy_perm_drive_d' },
  { titleKey: 'privacy_perm_sheets_t', descKey: 'privacy_perm_sheets_d' },
  { titleKey: 'privacy_perm_cls_t', descKey: 'privacy_perm_cls_d' },
  { titleKey: 'privacy_perm_gmail_t', descKey: 'privacy_perm_gmail_d' },
  { titleKey: 'privacy_perm_canvas_t', descKey: 'privacy_perm_canvas_d' },
] as const;

const TECHNICAL_SCOPE_DETAILS = [
  { scope: 'classroom.courses.readonly', featureKey: 'privacy_scope_cls_courses' },
  { scope: 'classroom.coursework.me.readonly', featureKey: 'privacy_scope_cls_work' },
  { scope: 'classroom.announcements.readonly', featureKey: 'privacy_scope_cls_ann' },
  { scope: 'calendar.events', featureKey: 'privacy_scope_cal' },
  { scope: 'drive.file', featureKey: 'privacy_scope_drive' },
  { scope: 'gmail.readonly', featureKey: 'privacy_scope_gmail' },
] as const;

const AI_FLOWS = [
  { sourceKey: 'privacy_ai_gmail_src', sentKey: 'privacy_ai_gmail_sent', toKey: 'privacy_ai_gmail_to' },
  { sourceKey: 'privacy_ai_cls_src', sentKey: 'privacy_ai_cls_sent', toKey: 'privacy_ai_cls_to' },
  { sourceKey: 'privacy_ai_text_src', sentKey: 'privacy_ai_text_sent', toKey: 'privacy_ai_text_to' },
  { sourceKey: 'privacy_ai_tutor_src', sentKey: 'privacy_ai_tutor_sent', toKey: 'privacy_ai_tutor_to' },
] as const;

const Section: React.FC<{ title: string; defaultOpen?: boolean; children: React.ReactNode }> = ({ title, defaultOpen, children }) => (
  <details open={defaultOpen} className="group rounded-2xl border text-xs" style={{ borderColor: 'var(--line)' }}>
    <summary className="font-bold cursor-pointer min-h-[44px] px-3 flex items-center justify-between gap-2 list-none [&::-webkit-details-marker]:hidden">
      <span className="text-[13px]">{title}</span>
      <ChevronDown className="w-4 h-4 shrink-0 transition-transform group-open:rotate-180" />
    </summary>
    <div className="px-3 pb-3 space-y-2 leading-relaxed">{children}</div>
  </details>
);

/** Plain-language privacy: incremental per-feature permissions, AI transparency, storage, parent info, revoke + delete. */
export const PrivacyModal: React.FC<{ onClose: () => void; onRevoke: () => void; onDeleteAll: () => Promise<void> }> = ({ onClose, onRevoke, onDeleteAll }) => {
  const { t } = useT();
  const [confirming, setConfirming] = React.useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('privacy_dialog_aria')}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-3xl p-5 sm:p-6 space-y-4 max-h-[88vh] overflow-y-auto" style={{ backgroundColor: 'var(--surface)' }}>
        <h2 className="text-base font-extrabold flex items-center gap-2"><ShieldCheck className="w-5 h-5" /> {t('privacy_title')}</h2>
        <p className="text-xs opacity-75 leading-relaxed">
          {t('privacy_intro')}
        </p>

        <div className="space-y-2">
          <Section title={t('privacy_sec_perms')} defaultOpen>
            <ul className="space-y-2">
              {FEATURE_PERMISSIONS.map((p) => (
                <li key={p.titleKey} className="p-2.5 rounded-xl border" style={{ borderColor: 'var(--line)' }}>
                  <p className="font-bold text-xs">{t(p.titleKey)}</p>
                  <p className="mt-0.5 opacity-80">{t(p.descKey)}</p>
                </li>
              ))}
            </ul>
            <p className="font-semibold">
              {t('privacy_perm_note')}
            </p>
            <details className="rounded-xl border p-2.5 text-[11px]" style={{ borderColor: 'var(--line)' }}>
              <summary className="cursor-pointer font-semibold opacity-75">
                {t('privacy_tech_summary')}
              </summary>
              <ul className="mt-2 space-y-1 opacity-80">
                {TECHNICAL_SCOPE_DETAILS.map((item) => (
                  <li key={item.scope} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5">
                    <code className="font-mono font-bold break-all">{item.scope}</code>
                    <span>{t(item.featureKey)}</span>
                  </li>
                ))}
              </ul>
            </details>
          </Section>

          <Section title={t('privacy_sec_ai')}>
            <ul className="space-y-2">
              {AI_FLOWS.map((f) => (
                <li key={f.sourceKey} className="p-2.5 rounded-xl border space-y-1" style={{ borderColor: 'var(--line)' }}>
                  <p className="font-bold">{t(f.sourceKey)}</p>
                  <p><span className="opacity-60">{t('privacy_ai_sent_label')}</span>{t(f.sentKey)}</p>
                  <p><span className="opacity-60">{t('privacy_ai_to_label')}</span>{t(f.toKey)}</p>
                </li>
              ))}
            </ul>
            <p className="font-semibold">⛔ {t('privacy_ai_never')}</p>
            <p className="opacity-80">⚠️ {t('privacy_ai_caution')}</p>
          </Section>

          <Section title={t('privacy_sec_storage')}>
            <ul className="list-disc pl-4 space-y-1.5">
              <li>{t('privacy_store_1')}</li>
              <li>{t('privacy_store_2')}</li>
              <li>{t('privacy_store_3')}</li>
              <li>{t('privacy_store_4')}</li>
            </ul>
          </Section>

          <Section title={t('privacy_sec_tutor')}>
            <p>
              {t('privacy_tutor_desc')}
            </p>
          </Section>

          <Section title={t('privacy_sec_parents')}>
            <ul className="list-disc pl-4 space-y-1.5">
              <li>{t('privacy_parent_1')}</li>
              <li>
                {t('privacy_parent_2_prefix')}
                <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer" className="underline font-semibold break-all" style={{ color: 'var(--terracotta)' }}>myaccount.google.com/permissions</a>.
              </li>
              <li>{t('privacy_parent_3')}</li>
              <li>{t('privacy_parent_4')}</li>
            </ul>
          </Section>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onRevoke} className="px-4 py-2.5 text-xs font-bold rounded-xl border min-h-[44px] inline-flex items-center gap-1 cursor-pointer" style={{ borderColor: 'var(--line)' }}>
            <LogOut className="w-3.5 h-3.5" /> {t('privacy_disconnect_btn')}
          </button>
          {!confirming
            ? <button type="button" onClick={() => setConfirming(true)} className="px-4 py-2.5 text-xs font-bold rounded-xl border border-rose-300 text-rose-600 min-h-[44px] inline-flex items-center gap-1 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /> {t('privacy_delete_btn')}</button>
            : (
              <>
                <button type="button" onClick={async () => { await onDeleteAll(); onClose(); }} className="px-4 py-2.5 text-xs font-bold rounded-xl bg-rose-600 text-white min-h-[44px] cursor-pointer">{t('privacy_delete_confirm')}</button>
                <button type="button" onClick={() => setConfirming(false)} className="px-4 py-2.5 text-xs font-bold rounded-xl border min-h-[44px] cursor-pointer" style={{ borderColor: 'var(--line)' }}>{t('common_cancel')}</button>
              </>
            )}
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-xs font-bold text-white rounded-xl min-h-[44px] ml-auto cursor-pointer" style={{ backgroundColor: 'var(--terracotta)' }}>{t('common_done')}</button>
        </div>
      </div>
    </div>
  );
};

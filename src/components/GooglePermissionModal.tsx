import React, { useEffect } from 'react';
import { X, CheckCircle2, ShieldCheck, Ban, ArrowRight, Loader2, Cpu } from 'lucide-react';
import { AppLogo } from './AppLogo';
import { preloadGoogleOAuthReadiness, type GoogleFeature } from '../services/googleAuth';
import { useT } from '../services/i18n';

export interface GooglePermissionModalProps {
  isOpen: boolean;
  feature: GoogleFeature;
  userEmail?: string | null;
  isConnecting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onOpenPrivacy?: () => void;
}

interface FeatureCopy {
  logoId: string;
  titleKey: string;
  whyKey: string;
  canDoKeys: readonly string[];
  neverDoKeys: readonly string[];
  aiPillEn: string;
  aiPillVi: string;
}

const FEATURE_COPY: Record<GoogleFeature, FeatureCopy> = {
  calendar: {
    logoId: 'radar',
    titleKey: 'gperm_cal_title',
    whyKey: 'gperm_cal_why',
    canDoKeys: ['gperm_cal_can1', 'gperm_cal_can2'],
    neverDoKeys: ['gperm_cal_nev1', 'gperm_cal_nev2'],
    aiPillEn: 'Data sent to AI: No',
    aiPillVi: 'Dữ liệu gửi cho AI: Không',
  },
  gmail: {
    logoId: 'gmail',
    titleKey: 'gperm_gmail_title',
    whyKey: 'gperm_gmail_why',
    canDoKeys: ['gperm_gmail_can1', 'gperm_gmail_can2'],
    neverDoKeys: ['gperm_gmail_nev1', 'gperm_gmail_nev2'],
    aiPillEn: 'Data sent to AI: Yes (max 1,500 chars cleaned body)',
    aiPillVi: 'Dữ liệu gửi cho AI: Có (tối đa 1.500 ký tự sạch)',
  },
  drive: {
    logoId: 'drive',
    titleKey: 'gperm_drive_title',
    whyKey: 'gperm_drive_why',
    canDoKeys: ['gperm_drive_can1', 'gperm_drive_can2'],
    neverDoKeys: ['gperm_drive_nev1', 'gperm_drive_nev2'],
    aiPillEn: 'Data sent to AI: No',
    aiPillVi: 'Dữ liệu gửi cho AI: Không',
  },
  'drive-all': {
    logoId: 'drive',
    titleKey: 'gperm_drive_all_title',
    whyKey: 'gperm_drive_all_why',
    canDoKeys: ['gperm_drive_all_can1', 'gperm_drive_all_can2'],
    neverDoKeys: ['gperm_drive_all_nev1', 'gperm_drive_all_nev2'],
    aiPillEn: 'Data sent to AI: No (Opt-in: lists Drive filenames only)',
    aiPillVi: 'Dữ liệu gửi cho AI: Không (Tùy chọn: chỉ liệt kê tên file)',
  },
  sheets: {
    logoId: 'tracker',
    titleKey: 'gperm_sheets_title',
    whyKey: 'gperm_sheets_why',
    canDoKeys: ['gperm_sheets_can1', 'gperm_sheets_can2'],
    neverDoKeys: ['gperm_sheets_nev1', 'gperm_sheets_nev2'],
    aiPillEn: 'Data sent to AI: No',
    aiPillVi: 'Dữ liệu gửi cho AI: Không',
  },
  classroom: {
    logoId: 'classroom',
    titleKey: 'gperm_cls_title',
    whyKey: 'gperm_cls_why',
    canDoKeys: ['gperm_cls_can1', 'gperm_cls_can2'],
    neverDoKeys: ['gperm_cls_nev1', 'gperm_cls_nev2'],
    aiPillEn: 'Data sent to AI: Announcements only',
    aiPillVi: 'Dữ liệu gửi cho AI: Chỉ thông báo lớp học',
  },
} as const;

export const GooglePermissionModal: React.FC<GooglePermissionModalProps> = ({
  isOpen,
  feature,
  userEmail,
  isConnecting = false,
  onConfirm,
  onCancel,
  onOpenPrivacy,
}) => {
  const { t, lang } = useT();

  useEffect(() => {
    if (!isOpen) return;
    preloadGoogleOAuthReadiness();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const info = FEATURE_COPY[feature] || FEATURE_COPY.calendar;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="google-permission-modal-title"
      className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div className="relative w-full max-w-md bg-[var(--bg-raised)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 pb-4 border-b border-[var(--border-default)] flex items-start justify-between gap-3 bg-[var(--bg-surface)]">
          <div className="flex items-center gap-3 min-w-0">
            <AppLogo id={info.logoId} size="md" />
            <div className="min-w-0">
              <h2
                id="google-permission-modal-title"
                className="text-base sm:text-lg font-extrabold text-[var(--text-primary)] leading-snug"
              >
                {t(info.titleKey)}
              </h2>
              {userEmail && (
                <p className="text-[11px] font-medium text-[var(--text-secondary)] truncate mt-0.5">
                  {t('gperm_using_email', { email: userEmail })}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            aria-label={t('common_close')}
            className="p-1.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Why we ask */}
          <div className="p-3.5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-text)]">
              {t('gperm_why_heading')}
            </p>
            <p className="text-xs sm:text-[13px] text-[var(--text-primary)] leading-relaxed">
              {t(info.whyKey)}
            </p>
          </div>

          {/* What StudentOS will be able to do */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-900/60 space-y-2">
            <p className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{t('gperm_can_heading')}</span>
            </p>
            <ul className="space-y-1.5 text-[var(--text-primary)]">
              {info.canDoKeys.map((key) => (
                <li key={key} className="flex items-start gap-2 leading-relaxed">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0" />
                  <span>{t(key)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* What we never do */}
          <div className="p-3.5 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-default)] space-y-2">
            <p className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <Ban className="w-4 h-4 text-[var(--accent-text)] shrink-0" />
              <span>{t('gperm_never_heading')}</span>
            </p>
            <ul className="space-y-1.5 text-[var(--text-secondary)]">
              {info.neverDoKeys.map((key) => (
                <li key={key} className="flex items-start gap-2 leading-relaxed">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--accent-fill)] shrink-0" />
                  <span>{t(key)}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[11px] text-[var(--text-secondary)] flex items-start gap-1.5 leading-relaxed px-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <span>
              {t('gperm_control_note')}
            </span>
          </p>

          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--bg-subtle)] border border-[var(--border-default)] text-[var(--text-secondary)]">
              <Cpu className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" />
              <span>{lang === 'vi' ? info.aiPillVi : info.aiPillEn}</span>
            </span>
            {onOpenPrivacy && (
              <button
                type="button"
                onClick={onOpenPrivacy}
                className="text-[11px] font-semibold text-[var(--accent-text)] hover:underline cursor-pointer"
              >
                {lang === 'vi' ? 'Xem chi tiết Quyền riêng tư & AI' : 'View Privacy & AI details'}
              </button>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-[var(--border-default)] bg-[var(--bg-surface)] flex items-center justify-end gap-2.5">
          <button type="button" onClick={onCancel} className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors cursor-pointer min-h-[44px]">
            {t('gperm_not_now')}
          </button>
          <button type="button" onClick={onConfirm} disabled={isConnecting} className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white shadow-xs transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px] disabled:opacity-60">
            {isConnecting ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>{t('gperm_opening')}</span></>
            ) : (
              <><span>{t('gperm_allow')}</span><ArrowRight className="w-3.5 h-3.5" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

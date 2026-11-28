import React, { useEffect, useState } from 'react';
import { CheckCircle2, CircleDashed, ChevronDown, ExternalLink, Lock, ShieldAlert, Trash2 } from 'lucide-react';
import { getGrantedScopes, hasFeatureAccess, type GoogleFeature } from '../../services/googleAuth';
import { useT } from '../../services/i18n';

export interface PermissionManagerPanelProps {
  userUid?: string | null;
  userEmail?: string | null;
  onConnectFeature?: (feature: GoogleFeature) => void;
  onClearCanvasToken?: () => void;
}

const STANDARD_SCOPES = [
  { scope: 'classroom.courses.readonly', featureKey: 'privacy_scope_cls_courses', fallback: 'Google Classroom classes' },
  { scope: 'classroom.coursework.me.readonly', featureKey: 'privacy_scope_cls_work', fallback: 'Classroom assignments & due dates' },
  { scope: 'classroom.announcements.readonly', featureKey: 'privacy_scope_cls_ann', fallback: 'Classroom teacher announcements' },
  { scope: 'calendar.events', featureKey: 'privacy_scope_cal', fallback: 'Google Calendar events & study blocks' },
  { scope: 'drive.file', featureKey: 'privacy_scope_drive', fallback: 'App-created or picked Drive & Sheets files' },
  { scope: 'gmail.readonly', featureKey: 'privacy_scope_gmail', fallback: 'Gmail academic reading (Restricted / Optional)' },
] as const;

const tr = (t: (k: string) => string, key: string, en: string, vi: string, lang: string): string => {
  const val = t(key);
  return !val || val === key ? (lang === 'vi' ? vi : en) : val;
};

const hasLocalCanvasToken = (): boolean => {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  return Boolean(window.localStorage.getItem('canvas_token') || window.localStorage.getItem('scc_canvas_token') || window.localStorage.getItem('canvasToken'));
};

interface PermRow {
  id: string;
  title: string;
  desc: string;
  granted: boolean;
  aiSent: string;
  tags?: string[];
  feature?: GoogleFeature;
  connectLabel?: string;
  isCanvas?: boolean;
}

export const PermissionManagerPanel: React.FC<PermissionManagerPanelProps> = ({ userUid, userEmail, onConnectFeature, onClearCanvasToken }) => {
  const { t, lang } = useT();
  const [, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => setTick((n) => n + 1);
    window.addEventListener('scc-google-scopes-updated', refresh);
    window.addEventListener('scc-google-token-updated', refresh);
    return () => {
      window.removeEventListener('scc-google-scopes-updated', refresh);
      window.removeEventListener('scc-google-token-updated', refresh);
    };
  }, []);

  const grantedScopes = getGrantedScopes(userUid);
  const rows: PermRow[] = [
    { id: 'basic', title: t('privacy_perm_basic_t'), desc: t('privacy_perm_basic_d'), granted: Boolean(userUid || userEmail || grantedScopes.length > 0), aiSent: tr(t, 'privacy_ai_no', 'Sent to AI: No', 'Gửi cho AI: Không', lang) },
    { id: 'calendar', title: t('privacy_perm_cal_t'), desc: t('privacy_perm_cal_d'), granted: hasFeatureAccess('calendar', userUid), aiSent: tr(t, 'privacy_ai_no', 'Sent to AI: No', 'Gửi cho AI: Không', lang), feature: 'calendar' },
    { id: 'gmail', title: t('privacy_perm_gmail_t'), desc: t('privacy_perm_gmail_d'), granted: hasFeatureAccess('gmail', userUid), aiSent: tr(t, 'privacy_ai_yes_gmail', 'Sent to AI: Yes (max 1,500 chars cleaned body)', 'Gửi cho AI: Có (tối đa 1.500 ký tự sạch)', lang), tags: ['Restricted', 'Read-only', 'Optional'], feature: 'gmail' },
    { id: 'classroom', title: t('privacy_perm_cls_t'), desc: t('privacy_perm_cls_d'), granted: hasFeatureAccess('classroom', userUid), aiSent: tr(t, 'privacy_ai_yes_cls', 'Sent to AI: Yes (announcements only)', 'Gửi cho AI: Có (chỉ thông báo)', lang), feature: 'classroom' },
    { id: 'drive', title: tr(t, 'privacy_perm_drive_sheets_t', 'Google Drive & Sheets (app-created or picked files)', 'Google Drive & Sheets (file do ứng dụng tạo/chọn)', lang), desc: `${t('privacy_perm_drive_d')} ${t('privacy_perm_sheets_d')}`, granted: hasFeatureAccess('drive', userUid) || hasFeatureAccess('sheets', userUid), aiSent: tr(t, 'privacy_ai_no', 'Sent to AI: No', 'Gửi cho AI: Không', lang), feature: 'drive' },
    {
      id: 'drive-all',
      title: tr(t, 'privacy_perm_drive_all_t', 'Google Drive — All Files (drive.readonly)', 'Google Drive — Tất cả file (drive.readonly)', lang),
      desc: tr(t, 'privacy_perm_drive_all_d', 'Optional 7th Escalation Scope: off by default, never requested at sign-in or standard sync. Only requested if you explicitly click "Show all Drive files".', 'Quyền mở rộng tùy chọn thứ 7: tắt mặc định, không bao giờ hỏi khi đăng nhập hay đồng bộ thường. Chỉ hỏi khi bạn bấm "Hiện tất cả file Drive".', lang),
      granted: hasFeatureAccess('drive-all', userUid),
      aiSent: tr(t, 'privacy_ai_no', 'Sent to AI: No', 'Gửi cho AI: Không', lang),
      tags: [tr(t, 'privacy_tag_escalation', 'Optional 7th Escalation Scope', 'Quyền mở rộng thứ 7 (Tùy chọn)', lang)],
      feature: 'drive-all',
      connectLabel: tr(t, 'privacy_btn_show_all_drive', 'Show all Drive files', 'Hiện tất cả file Drive', lang),
    },
    { id: 'canvas', title: t('privacy_perm_canvas_t'), desc: tr(t, 'privacy_perm_canvas_local_d', 'Local token stored on device only; never sent to AI or our servers.', 'Mã truy cập chỉ lưu trên thiết bị; không bao giờ gửi cho AI hay máy chủ.', lang), granted: hasLocalCanvasToken(), aiSent: tr(t, 'privacy_ai_never_short', 'Sent to AI: Never', 'Gửi cho AI: Không bao giờ', lang), isCanvas: true },
  ];

  return (
    <div className="space-y-3 text-xs">
      <p className="font-semibold text-[var(--text-primary)]">
        {tr(
          t,
          'privacy_perm_note_clean',
          'At sign-in, we only ask for your basic name and email. Each Google feature asks for access only if and when you turn it on.',
          'Khi đăng nhập, chúng tôi chỉ xin tên và email cơ bản. Mỗi tính năng Google chỉ xin quyền khi bạn chủ động bật.',
          lang
        )}
      </p>

      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="p-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-bold text-[var(--text-primary)]">{row.title}</span>
                {row.tags?.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    {tag}
                  </span>
                ))}
              </div>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  row.granted
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                    : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-default)]'
                }`}
              >
                {row.granted ? <CheckCircle2 className="w-3 h-3" /> : <CircleDashed className="w-3 h-3" />}
                {row.granted
                  ? tr(t, 'privacy_status_granted', 'Granted', 'Đã cấp quyền', lang)
                  : tr(t, 'privacy_status_not_connected', 'Not connected', 'Chưa kết nối', lang)}
              </span>
            </div>

            <p className="text-[var(--text-secondary)] leading-relaxed">{row.desc}</p>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-muted)]">
                <Lock className="w-3 h-3 shrink-0" />
                {row.aiSent}
              </span>

              <div className="flex items-center gap-2">
                {row.feature && !row.granted && onConnectFeature && (
                  <button
                    type="button"
                    onClick={() => onConnectFeature(row.feature as GoogleFeature)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white cursor-pointer"
                  >
                    {row.connectLabel || tr(t, 'privacy_btn_connect', 'Connect', 'Kết nối', lang)}
                  </button>
                )}
                {row.feature && row.granted && (
                  <a
                    href="https://myaccount.google.com/permissions"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent-text)] hover:underline"
                  >
                    {tr(t, 'privacy_btn_manage_google', 'Manage on Google', 'Quản lý trên Google', lang)}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {row.isCanvas && onClearCanvasToken && (
                  <button
                    type="button"
                    onClick={onClearCanvasToken}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-[var(--border-default)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    {tr(t, 'privacy_btn_clear_canvas', 'Clear Canvas token', 'Xóa mã Canvas', lang)}
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <details className="group rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 text-[11px]">
        <summary className="cursor-pointer font-semibold text-[var(--text-secondary)] flex items-center justify-between list-none [&::-webkit-details-marker]:hidden">
          <span>{t('privacy_tech_summary')}</span>
          <ChevronDown className="w-4 h-4 shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <ul className="mt-2.5 space-y-1.5 text-[var(--text-secondary)]">
          {STANDARD_SCOPES.map((item) => (
            <li key={item.scope} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5">
              <code className="font-mono font-bold break-all text-[var(--text-primary)]">{item.scope}</code>
              <span>{tr(t, item.featureKey, item.fallback, t(item.featureKey), lang)}</span>
            </li>
          ))}
          <li className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 pt-1 border-t border-[var(--border-hairline)]">
            <code className="font-mono font-bold break-all text-amber-700 dark:text-amber-300 inline-flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 shrink-0" />
              drive.readonly
            </code>
            <span>
              {tr(
                t,
                'privacy_scope_drive_all',
                'Optional 7th Escalation Scope (only when clicking "Show all Drive files")',
                'Quyền mở rộng thứ 7 tùy chọn (chỉ khi bấm "Hiện tất cả file Drive")',
                lang
              )}
            </span>
          </li>
        </ul>
      </details>
    </div>
  );
};

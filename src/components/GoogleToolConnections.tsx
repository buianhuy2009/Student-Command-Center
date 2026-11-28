import React from 'react';
import { hasFeatureAccess, type GoogleFeature } from '../services/googleAuth';
import { useT } from '../services/i18n';

const GOOGLE_TOOLS = [
  { id: 'calendar', labelKey: 'settings_tool_cal_label', descKey: 'settings_tool_cal_desc' },
  { id: 'gmail', labelKey: 'settings_tool_gmail_label', descKey: 'settings_tool_gmail_desc' },
  { id: 'drive', labelKey: 'settings_tool_drive_label', descKey: 'settings_tool_drive_desc' },
  { id: 'sheets', labelKey: 'settings_tool_sheets_label', descKey: 'settings_tool_sheets_desc' },
  { id: 'classroom', labelKey: 'settings_tool_classroom_label', descKey: 'settings_tool_classroom_desc' },
] as const satisfies ReadonlyArray<{ id: GoogleFeature; labelKey: string; descKey: string }>;

interface GoogleToolConnectionsProps {
  uid?: string;
  onConnect: (feature: GoogleFeature) => void;
}

/** Per-tool Google connection list shown under Settings > Connected Apps. */
export const GoogleToolConnections: React.FC<GoogleToolConnectionsProps> = ({ uid, onConnect }) => {
  const { t } = useT();

  return (
    <div className="p-4 bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-default)] space-y-2">
      <div className="text-[11px] font-semibold text-[var(--text-secondary)]">
        {t('settings_google_tools_heading')}
      </div>
      {GOOGLE_TOOLS.map((tool) => {
        const connected = hasFeatureAccess(tool.id, uid);
        return (
          <div
            key={tool.id}
            data-google-tool={tool.id}
            className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)]"
          >
            <div className="min-w-0">
              <div className="text-xs font-bold text-[var(--text-primary)]">{t(tool.labelKey)}</div>
              <div className="text-[11px] text-[var(--text-muted)]">{t(tool.descKey)}</div>
            </div>
            {connected ? (
              <span className="shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[var(--status-ok-bg)] text-[var(--status-ok-text)] border border-[var(--status-ok-border)]">
                {t('settings_connected_badge')}
              </span>
            ) : (
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-default)]">
                  {t('ghub_not_connected')}
                </span>
                <button
                  type="button"
                  onClick={() => onConnect(tool.id)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white cursor-pointer transition-colors"
                >
                  {t('connect_google')}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

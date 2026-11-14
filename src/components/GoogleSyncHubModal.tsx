import React, { useEffect, useState } from "react";
import {
  X,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Clock,
  Sparkles,
  Link2,
  Unlink,
  Loader2,
} from "lucide-react";
import { AppLogo } from "./AppLogo";
import {
  getGrantedScopes,
  hasFeatureAccess,
  type GoogleFeature,
} from "../services/googleAuth";
import { useT } from "../services/i18n";

export interface GoogleSyncHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  hasGoogleToken: boolean;
  isSyncing: boolean;
  onSyncAll: () => Promise<void>;
  onConnectGoogle: () => Promise<void>;
  onDisconnectGoogle: () => void;
  onConnectFeature?: (feature: GoogleFeature) => Promise<void> | void;
  connectingFeature?: GoogleFeature | null;
  calendarEventsCount?: number;
  emailCount?: number;
  schoolFilesCount?: number;
  classroomCount?: number;
  sheetUrl?: string;
  onSyncSheet?: () => Promise<void>;
  isSyncingSheet?: boolean;
  onSyncClassroom?: () => Promise<void>;
  isSyncingClassroom?: boolean;
  onConnectGmail?: () => Promise<void>;
  isConnectingGmail?: boolean;
}

export const GoogleSyncHubModal: React.FC<GoogleSyncHubModalProps> = ({
  isOpen,
  onClose,
  user,
  hasGoogleToken,
  isSyncing,
  onSyncAll,
  onConnectGoogle,
  onDisconnectGoogle,
  onConnectFeature,
  connectingFeature = null,
  calendarEventsCount = 0,
  emailCount = 0,
  schoolFilesCount = 0,
  classroomCount = 0,
  sheetUrl,
  onSyncSheet,
  isSyncingSheet = false,
  onSyncClassroom,
  isSyncingClassroom = false,
  onConnectGmail,
  isConnectingGmail = false,
}) => {
  const { t } = useT();
  const [, setScopeTick] = useState(0);

  useEffect(() => {
    const bump = () => setScopeTick((n) => n + 1);
    window.addEventListener("scc-google-scopes-updated", bump);
    window.addEventListener("scc-google-token-updated", bump);
    return () => {
      window.removeEventListener("scc-google-scopes-updated", bump);
      window.removeEventListener("scc-google-token-updated", bump);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const grantedScopes = getGrantedScopes(user?.uid);
  const hasExplicitScopes = grantedScopes.length > 0;

  const checkFeatureConnected = (feature: GoogleFeature): boolean => {
    if (hasExplicitScopes) return hasFeatureAccess(feature, user?.uid);
    if (!hasGoogleToken) return false;
    if (feature === "gmail") return emailCount > 0;
    return true;
  };

  const handleConnect = async (feature: GoogleFeature) => {
    if (onConnectFeature) {
      await onConnectFeature(feature);
      return;
    }
    if (feature === "gmail" && onConnectGmail) {
      await onConnectGmail();
      return;
    }
    await onConnectGoogle();
  };

  const services: Array<{
    id: GoogleFeature;
    name: string;
    appId: string;
    description: string;
    connected: boolean;
    stat: string;
    action?: () => Promise<void>;
    isActionLoading: boolean;
    actionLabel: string;
    externalUrl?: string;
    externalLabel: string;
  }> = [
    {
      id: "calendar",
      name: "Google Calendar",
      appId: "radar",
      description: t("ghub_cal_desc"),
      connected: checkFeatureConnected("calendar"),
      stat: checkFeatureConnected("calendar")
        ? t("ghub_cal_stat", { count: calendarEventsCount })
        : t("ghub_not_connected"),
      isActionLoading: false,
      actionLabel: t("common_refresh"),
      externalUrl: "https://calendar.google.com",
      externalLabel: t("ghub_cal_open"),
    },
    {
      id: "gmail",
      name: "Gmail",
      appId: "gmail",
      description: t("ghub_gmail_desc"),
      connected: checkFeatureConnected("gmail"),
      stat: checkFeatureConnected("gmail")
        ? t("ghub_gmail_stat", { count: emailCount })
        : t("ghub_not_connected"),
      action: onConnectGmail,
      isActionLoading: isConnectingGmail,
      actionLabel: t("ghub_gmail_action"),
      externalUrl: "https://mail.google.com",
      externalLabel: t("ghub_gmail_open"),
    },
    {
      id: "drive",
      name: "Google Drive & Docs",
      appId: "drive",
      description: t("ghub_drive_desc"),
      connected: checkFeatureConnected("drive"),
      stat: checkFeatureConnected("drive")
        ? t("ghub_drive_stat", { count: schoolFilesCount })
        : t("ghub_not_connected"),
      isActionLoading: false,
      actionLabel: t("common_refresh"),
      externalUrl: "https://drive.google.com",
      externalLabel: t("ghub_drive_open"),
    },
    {
      id: "sheets",
      name: "Google Sheets",
      appId: "tracker",
      description: t("ghub_sheets_desc"),
      connected: checkFeatureConnected("sheets"),
      stat: checkFeatureConnected("sheets")
        ? sheetUrl
          ? t("ghub_sheets_ready")
          : t("ghub_sheets_create")
        : t("ghub_not_connected"),
      action: onSyncSheet,
      isActionLoading: isSyncingSheet,
      actionLabel: t("ghub_sheets_action"),
      externalUrl: sheetUrl,
      externalLabel: t("ghub_sheets_open"),
    },
    {
      id: "classroom",
      name: "Google Classroom",
      appId: "classroom",
      description: t("ghub_cls_desc"),
      connected: checkFeatureConnected("classroom"),
      stat: checkFeatureConnected("classroom")
        ? classroomCount > 0
          ? t("ghub_cls_stat", { count: classroomCount })
          : t("ghub_connected")
        : t("ghub_not_connected"),
      action: onSyncClassroom,
      isActionLoading: isSyncingClassroom,
      actionLabel: t("ghub_cls_action"),
      externalUrl: "https://classroom.google.com",
      externalLabel: t("ghub_cls_open"),
    },
  ];

  const connectedCount = services.filter((s) => s.connected).length;
  const anyConnected = connectedCount > 0 || hasGoogleToken;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="google-sync-hub-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-2xl bg-[#FAF9F5] dark:bg-[#141413] border border-[#DFDACB] dark:border-[#2C2B27] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 pb-4 border-b border-[#DFDACB] dark:border-[#2C2B27] flex items-center justify-between bg-white/60 dark:bg-[#1A1917]/60 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-white dark:bg-[#1F1E1B] border border-[#DFDACB] dark:border-[#2C2B27] flex items-center justify-center shadow-xs shrink-0">
              <AppLogo id="drive" size="sm" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="google-sync-hub-title"
                  className="text-lg font-bold text-[#141413] dark:text-[#FAF9F5]"
                >
                  {t("ghub_title")}
                </h2>
                {connectedCount > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {t("ghub_connected_count", { count: connectedCount })}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#EFECE2] text-[#5C5A54] dark:bg-[#252422] dark:text-[#B5B2A8] border border-[#DFDACB] dark:border-[#2C2B27]">
                    {t("ghub_choose_connect")}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#6B6860] dark:text-[#B5B2A8] mt-0.5 truncate">
                {user?.email
                  ? t("ghub_signed_in_as", { email: user.email })
                  : t("ghub_subtitle_anon")}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t("common_close")}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[#6B6860] hover:text-[#141413] dark:text-[#B5B2A8] dark:hover:text-[#FAF9F5] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="px-6 py-3 bg-[#D97757]/10 dark:bg-[#D97757]/15 border-b border-[#D97757]/20 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#141413] dark:text-[#FAF9F5]">
            <Sparkles className="w-4 h-4 text-[#D97757] shrink-0" />
            <span>
              {t("ghub_banner")}
            </span>
          </div>

          {anyConnected && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onSyncAll}
                disabled={isSyncing}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#D97757] hover:bg-[#C86646] text-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                {isSyncing
                  ? t("ghub_refreshing")
                  : t("ghub_refresh_connected")}
              </button>
              <button
                type="button"
                onClick={onDisconnectGoogle}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer flex items-center gap-1"
                title={t("ghub_disconnect_aria")}
                aria-label={t("ghub_disconnect_aria")}
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>{t("ghub_disconnect")}</span>
              </button>
            </div>
          )}
        </div>

        {/* Per-Feature Connection Cards */}
        <div className="p-6 overflow-y-auto space-y-3">
          {services.map((svc) => {
            const isThisConnecting = connectingFeature === svc.id;
            return (
              <div
                key={svc.id}
                className="p-4 rounded-2xl bg-white dark:bg-[#1A1917] border border-[#DFDACB] dark:border-[#2C2B27] flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all hover:border-[#D97757]/40 hover:shadow-xs"
              >
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <AppLogo id={svc.appId} size="md" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-[#141413] dark:text-[#FAF9F5]">
                        {svc.name}
                      </h3>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          svc.connected
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {svc.stat}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B6860] dark:text-[#B5B2A8] mt-0.5 leading-relaxed">
                      {svc.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {svc.connected ? (
                    svc.action && (
                      <button
                        type="button"
                        onClick={svc.action}
                        disabled={svc.isActionLoading}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#FAF9F5] dark:bg-[#262523] hover:bg-[#DFDACB]/50 dark:hover:bg-[#383632] text-[#141413] dark:text-[#FAF9F5] border border-[#DFDACB] dark:border-[#2C2B27] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 min-h-[36px]"
                      >
                        <RefreshCw
                          className={`w-3 h-3 ${svc.isActionLoading ? "animate-spin text-[#D97757]" : ""}`}
                        />
                        {svc.isActionLoading
                          ? t("ghub_updating")
                          : svc.actionLabel}
                      </button>
                    )
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleConnect(svc.id)}
                      disabled={isThisConnecting}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#D97757] hover:bg-[#C86646] text-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60 min-h-[36px]"
                    >
                      {isThisConnecting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Link2 className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {isThisConnecting
                          ? t("ghub_connecting")
                          : t("ghub_connect")}
                      </span>
                    </button>
                  )}

                  {svc.externalUrl && (
                    <a
                      href={svc.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[#6B6860] hover:text-[#141413] dark:text-[#B5B2A8] dark:hover:text-[#FAF9F5] hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center gap-1 cursor-pointer min-h-[36px]"
                      title={svc.externalLabel}
                      aria-label={svc.externalLabel}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#DFDACB] dark:border-[#2C2B27] bg-[#FAF9F5]/80 dark:bg-[#141413]/80 flex items-center justify-between gap-3 text-xs text-[#6B6860] dark:text-[#B5B2A8]">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-[#D97757] shrink-0" />
            <span>
              {t("ghub_footer_note")}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-[#1A1917] border border-[#DFDACB] dark:border-[#2C2B27] hover:border-[#D97757] text-[#141413] dark:text-[#FAF9F5] transition-all cursor-pointer shrink-0"
          >
            {t("common_close")}
          </button>
        </div>
      </div>
    </div>
  );
};

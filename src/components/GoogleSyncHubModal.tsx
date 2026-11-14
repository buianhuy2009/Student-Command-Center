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
import { useLang } from "../services/i18n";

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
  const [lang] = useLang();
  const isVi = lang === "vi";
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
      description: isVi
        ? "Hiện lịch học cùng hạn nộp bài và thêm giờ tự học khi bạn chọn."
        : "Shows your classes next to deadlines and adds study blocks you choose.",
      connected: checkFeatureConnected("calendar"),
      stat: checkFeatureConnected("calendar")
        ? isVi
          ? `${calendarEventsCount} sự kiện`
          : `${calendarEventsCount} events`
        : isVi
        ? "Chưa kết nối"
        : "Not connected",
      isActionLoading: false,
      actionLabel: isVi ? "Làm mới" : "Refresh",
      externalUrl: "https://calendar.google.com",
      externalLabel: isVi ? "Mở Calendar" : "Open Calendar",
    },
    {
      id: "gmail",
      name: "Gmail",
      appId: "gmail",
      description: isVi
        ? "Tìm bài tập, ngày thi và thông báo từ thầy cô trong hộp thư (chỉ đọc)."
        : "Spots homework, exam dates, and teacher announcements in your inbox (read-only).",
      connected: checkFeatureConnected("gmail"),
      stat: checkFeatureConnected("gmail")
        ? isVi
          ? `${emailCount} email đã quét`
          : `${emailCount} emails found`
        : isVi
        ? "Chưa kết nối"
        : "Not connected",
      action: onConnectGmail,
      isActionLoading: isConnectingGmail,
      actionLabel: isVi ? "Quét lại Gmail" : "Refresh Gmail",
      externalUrl: "https://mail.google.com",
      externalLabel: isVi ? "Mở Gmail" : "Open Gmail",
    },
    {
      id: "drive",
      name: "Google Drive & Docs",
      appId: "drive",
      description: isVi
        ? "Tạo tài liệu học và mở các tệp bạn tạo hoặc tự chọn trong StudentOS."
        : "Creates study docs and opens only the files you make or pick in StudentOS.",
      connected: checkFeatureConnected("drive"),
      stat: checkFeatureConnected("drive")
        ? isVi
          ? `${schoolFilesCount} tệp`
          : `${schoolFilesCount} files`
        : isVi
        ? "Chưa kết nối"
        : "Not connected",
      isActionLoading: false,
      actionLabel: isVi ? "Làm mới" : "Refresh",
      externalUrl: "https://drive.google.com",
      externalLabel: isVi ? "Mở Drive" : "Open Drive",
    },
    {
      id: "sheets",
      name: "Google Sheets",
      appId: "tracker",
      description: isVi
        ? "Lưu bảng theo dõi bài tập, hạn nộp và trạng thái học tập của riêng bạn."
        : "Keeps your personal assignment checklist saved in a Google spreadsheet.",
      connected: checkFeatureConnected("sheets"),
      stat: checkFeatureConnected("sheets")
        ? sheetUrl
          ? isVi
            ? "Đã liên kết bảng tính"
            : "Sheet ready"
          : isVi
          ? "Sẵn sàng tạo bảng"
          : "Ready to create"
        : isVi
        ? "Chưa kết nối"
        : "Not connected",
      action: onSyncSheet,
      isActionLoading: isSyncingSheet,
      actionLabel: isVi ? "Cập nhật Sheet" : "Update Sheet",
      externalUrl: sheetUrl,
      externalLabel: isVi ? "Mở Sheet" : "Open Sheet",
    },
    {
      id: "classroom",
      name: "Google Classroom",
      appId: "classroom",
      description: isVi
        ? "Mang tên lớp học, bài tập đang mở và thông báo của thầy cô về một nơi."
        : "Brings your enrolled classes, homework, and teacher posts into one list.",
      connected: checkFeatureConnected("classroom"),
      stat: checkFeatureConnected("classroom")
        ? classroomCount > 0
          ? isVi
            ? `${classroomCount} bài tập`
            : `${classroomCount} assignments`
          : isVi
          ? "Đã kết nối"
          : "Connected"
        : isVi
        ? "Chưa kết nối"
        : "Not connected",
      action: onSyncClassroom,
      isActionLoading: isSyncingClassroom,
      actionLabel: isVi ? "Cập nhật Classroom" : "Update Classroom",
      externalUrl: "https://classroom.google.com",
      externalLabel: isVi ? "Mở Classroom" : "Open Classroom",
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
                  {isVi ? "Kết nối Google của bạn" : "Your Google Connections"}
                </h2>
                {connectedCount > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {isVi ? `Đã bật ${connectedCount}/5` : `${connectedCount} of 5 connected`}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#EFECE2] text-[#5C5A54] dark:bg-[#252422] dark:text-[#B5B2A8] border border-[#DFDACB] dark:border-[#2C2B27]">
                    {isVi ? "Chưa bật công cụ nào" : "Choose what to connect"}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#6B6860] dark:text-[#B5B2A8] mt-0.5 truncate">
                {user?.email
                  ? isVi
                    ? `Đang đăng nhập: ${user.email}`
                    : `Signed in as ${user.email}`
                  : isVi
                  ? "Mỗi ứng dụng Google kết nối riêng khi bạn cần"
                  : "Each Google app connects separately only when you need it"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={isVi ? "Đóng" : "Close"}
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
              {isVi
                ? "Chỉ bật những công cụ Google bạn thật sự muốn dùng — từng cái một."
                : "Connect only the Google tools you want to use — one at a time."}
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
                  ? isVi
                    ? "Đang làm mới..."
                    : "Refreshing..."
                  : isVi
                  ? "Làm mới các mục đã bật"
                  : "Refresh Connected"}
              </button>
              <button
                type="button"
                onClick={onDisconnectGoogle}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer flex items-center gap-1"
                title={isVi ? "Ngắt kết nối Google" : "Disconnect Google apps"}
                aria-label={isVi ? "Ngắt kết nối Google" : "Disconnect Google apps"}
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>{isVi ? "Ngắt hết" : "Disconnect"}</span>
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
                          ? isVi
                            ? "Đang cập nhật..."
                            : "Updating..."
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
                          ? isVi
                            ? "Đang kết nối..."
                            : "Connecting..."
                          : isVi
                          ? "Kết nối"
                          : "Connect"}
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
              {isVi
                ? "Các mục bạn đã bật sẽ tự làm mới nhẹ nhàng trong lúc bạn học."
                : "Your connected apps stay updated quietly while you study."}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-[#1A1917] border border-[#DFDACB] dark:border-[#2C2B27] hover:border-[#D97757] text-[#141413] dark:text-[#FAF9F5] transition-all cursor-pointer shrink-0"
          >
            {isVi ? "Đóng" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
};

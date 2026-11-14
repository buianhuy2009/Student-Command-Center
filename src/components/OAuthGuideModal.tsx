import React, { useEffect, useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  RefreshCw,
  Wrench,
  ArrowLeftRight,
  HelpCircle,
  ShieldCheck,
  Wifi,
} from 'lucide-react';
import type { SignInDiagnosis } from '../services/firebase';
import { useLang } from '../services/i18n';

export interface OAuthGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetryWorkspaceSignIn: () => void;
  onBasicSignIn: () => void;
  isLoggingIn?: boolean;
  /** @deprecated Legacy prop kept for backward compatibility; never displayed to students. */
  projectId?: string;
  /** @deprecated Legacy prop kept for backward compatibility; never displayed to students. */
  userEmail?: string;
  diagnosis?: SignInDiagnosis | null;
  onRunDiagnostics?: () => { label: string; ok: boolean; hint?: string }[];
  onRedirectSignIn?: () => void;
}

export const OAuthGuideModal: React.FC<OAuthGuideModalProps> = ({
  isOpen,
  onClose,
  onRetryWorkspaceSignIn,
  onBasicSignIn,
  isLoggingIn = false,
  diagnosis = null,
  onRunDiagnostics,
  onRedirectSignIn,
}) => {
  const [lang] = useLang();
  const isVi = lang === 'vi';
  const [envChecks, setEnvChecks] = useState<{ label: string; ok: boolean; hint?: string }[] | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const tips = isVi
    ? [
        {
          icon: AlertTriangle,
          title: 'Cho phép cửa sổ bật lên (popups)',
          body: 'Kiểm tra biểu tượng chặn cửa sổ bật lên trên thanh địa chỉ trình duyệt, chọn Cho phép cho trang này rồi thử đăng nhập lại.',
        },
        {
          icon: Wifi,
          title: 'Kiểm tra mạng hoặc trình chặn quảng cáo',
          body: 'Một số tiện ích chặn quảng cáo hoặc mạng Wi-Fi trường học có thể chặn cửa sổ Google. Hãy thử tạm tắt trình chặn cho trang này.',
        },
        {
          icon: ShieldCheck,
          title: 'Thử Gmail cá nhân hoặc đăng nhập trên cùng trang',
          body: 'Một số tài khoản Google trường học hạn chế ứng dụng bên ngoài. Bạn có thể dùng Gmail cá nhân hoặc nút đăng nhập chuyển trang bên dưới.',
        },
      ]
    : [
        {
          icon: AlertTriangle,
          title: 'Allow popups for this site',
          body: 'Look for a blocked-popup icon in your browser’s address bar, allow popups for this page, and try signing in again.',
        },
        {
          icon: Wifi,
          title: 'Check your Wi-Fi or ad-blocker',
          body: 'Strict privacy extensions or school Wi-Fi filters can block Google’s sign-in window. Try pausing them for this site or switching networks.',
        },
        {
          icon: ShieldCheck,
          title: 'Use a personal Gmail or full-page sign-in',
          body: 'Some school Google accounts restrict outside study apps. You can try a personal Gmail account, or use full-page sign-in below without popups.',
        },
      ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="oauth-guide-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-[#1A1917] border border-[#DFDACB] dark:border-[#2C2B27] rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 max-h-[92vh] flex flex-col overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-4 border-b border-[#DFDACB] dark:border-[#2C2B27] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#D97757]/15 text-[#D97757] flex items-center justify-center shrink-0">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="oauth-guide-modal-title"
                className="text-base sm:text-lg font-bold text-[#141413] dark:text-[#FAF9F5] tracking-tight"
              >
                {isVi ? 'Gặp trục trặc khi đăng nhập Google?' : 'Trouble signing in with Google?'}
              </h3>
              <p className="text-xs text-[#6B6860] dark:text-[#B5B2A8] mt-0.5">
                {isVi
                  ? 'Bài tập và ghi chú đã lưu trên máy của bạn vẫn an toàn.'
                  : 'Your saved schoolwork is safe on this device. Try these quick fixes.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isVi ? 'Đóng' : 'Close'}
            className="p-1.5 text-[#6B6860] hover:text-[#141413] dark:text-[#B5B2A8] dark:hover:text-[#FAF9F5] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Specific diagnosis when available */}
        {diagnosis && (
          <div className="mt-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3.5 space-y-1.5" role="alert">
            <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{diagnosis.title}</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">{diagnosis.detail}</p>
            <p className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
              <strong>{isVi ? 'Cách thử: ' : 'Next step: '}</strong>
              {diagnosis.fix}
            </p>
          </div>
        )}

        {/* Friendly student troubleshooting steps */}
        <div className="mt-4 space-y-2.5">
          {tips.map((tip, index) => {
            const Icon = tip.icon;
            return (
              <div
                key={index}
                className="p-3.5 bg-[#FAF9F5] dark:bg-[#252422]/60 rounded-xl border border-[#DFDACB] dark:border-[#2C2B27] flex items-start gap-3"
              >
                <div className="w-7 h-7 rounded-lg bg-[#D97757]/15 text-[#D97757] flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#141413] dark:text-[#FAF9F5]">{tip.title}</p>
                  <p className="text-[11px] text-[#6B6860] dark:text-[#B5B2A8] mt-0.5 leading-relaxed">{tip.body}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="mt-5 pt-4 border-t border-[#DFDACB] dark:border-[#2C2B27] flex flex-col gap-2 shrink-0">
          <button
            type="button"
            onClick={onRetryWorkspaceSignIn}
            disabled={isLoggingIn}
            className="w-full py-2.5 px-4 bg-[#D97757] hover:bg-[#C86646] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoggingIn ? 'animate-spin' : ''}`} />
            <span>
              {isLoggingIn
                ? isVi
                  ? 'Đang kết nối...'
                  : 'Connecting...'
                : isVi
                ? 'Thử đăng nhập lại'
                : 'Try signing in again'}
            </span>
          </button>

          {onRedirectSignIn && (
            <button
              type="button"
              onClick={onRedirectSignIn}
              disabled={isLoggingIn}
              className="w-full py-2.5 px-4 bg-white dark:bg-[#1A1917] hover:bg-[#D97757]/10 text-[#D97757] text-xs font-bold rounded-xl border border-[#D97757]/40 transition-colors flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>
                {isVi
                  ? 'Đăng nhập ngay trên trang này (không cần popup)'
                  : 'Sign in on this page instead (no popup needed)'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={onBasicSignIn}
            disabled={isLoggingIn}
            className="w-full py-2 px-4 bg-[#FAF9F5] dark:bg-[#252422] hover:bg-[#EFECE2] dark:hover:bg-[#2C2B27] text-[#141413] dark:text-[#FAF9F5] text-xs font-semibold rounded-xl border border-[#DFDACB] dark:border-[#2C2B27] transition-colors flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
          >
            <UserCheck className="w-3.5 h-3.5 text-[#D97757]" />
            <span>
              {isVi
                ? 'Đăng nhập cơ bản bằng tên & email Google'
                : 'Sign in with basic Google account'}
            </span>
          </button>

          {onRunDiagnostics && (
            <div className="rounded-xl border border-[#DFDACB] dark:border-[#2C2B27] overflow-hidden">
              <button
                type="button"
                onClick={() => setEnvChecks(onRunDiagnostics())}
                className="w-full py-2 px-4 text-xs font-semibold text-[#6B6860] dark:text-[#B5B2A8] hover:bg-[#FAF9F5] dark:hover:bg-[#252422] flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>{isVi ? 'Kiểm tra trình duyệt' : 'Check browser settings'}</span>
              </button>
              {envChecks && (
                <ul className="px-4 pb-3 space-y-1.5">
                  {envChecks.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px]">
                      {c.ok ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                      )}
                      <span>
                        <span className="font-semibold text-[#141413] dark:text-[#FAF9F5]">{c.label}</span>
                        {c.hint && <span className="block text-[#6B6860] dark:text-[#B5B2A8]">{c.hint}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

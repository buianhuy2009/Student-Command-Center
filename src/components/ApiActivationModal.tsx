import React, { useEffect } from 'react';
import {
  AlertTriangle,
  X,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { ApiEnablementInfo } from '../types';
import { useLang } from '../services/i18n';

interface ApiActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  info: ApiEnablementInfo | null;
  onRetry?: () => void;
  isRetrying?: boolean;
}

function getFriendlyFeatureName(info: ApiEnablementInfo | null, isVi: boolean): string {
  const raw = `${info?.serviceId || ''} ${info?.serviceName || ''}`.toLowerCase();
  if (raw.includes('calendar')) return 'Google Calendar';
  if (raw.includes('gmail') || raw.includes('mail')) return 'Gmail';
  if (raw.includes('sheet')) return 'Google Sheets';
  if (raw.includes('doc')) return 'Google Docs';
  if (raw.includes('classroom')) return 'Google Classroom';
  if (raw.includes('drive')) return 'Google Drive';
  return isVi ? 'Tính năng Google này' : 'This Google feature';
}

export const ApiActivationModal: React.FC<ApiActivationModalProps> = ({
  isOpen,
  onClose,
  info,
  onRetry,
  isRetrying = false,
}) => {
  const [lang] = useLang();
  const isVi = lang === 'vi';

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const featureName = getFriendlyFeatureName(info, isVi);

  const steps = isVi
    ? [
        'Thử lại sau một lát — đôi khi kết nối với Google chỉ bị gián đoạn tạm thời.',
        'Kiểm tra xem trình duyệt có đang chặn cửa sổ bật lên (popup) không, rồi thử kết nối lại.',
        'Bạn vẫn có thể ghi chú, thêm bài tập và sắp lịch học ngay trên máy — mọi dữ liệu của bạn đều an toàn.',
      ]
    : [
        'Try again in a moment — temporary connection hiccups with Google usually clear right up.',
        'Allow popups for this site and try signing in again if the permission window did not open.',
        'You can keep adding assignments, notes, and study blocks locally right away — your saved schoolwork is safe.',
      ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="api-activation-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="api-activation-modal"
        className="bg-white dark:bg-[#1A1917] border border-[#DFDACB] dark:border-[#2C2B27] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="p-5 border-b border-[#DFDACB] dark:border-[#2C2B27] flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="api-activation-modal-title"
                className="text-base font-bold text-[#141413] dark:text-[#FAF9F5]"
              >
                {isVi
                  ? `${featureName} hiện chưa sẵn sàng`
                  : `${featureName} isn’t active right now`}
              </h3>
              <p className="text-xs text-[#6B6860] dark:text-[#B5B2A8] mt-0.5">
                {isVi
                  ? 'Bài tập và ghi chú đã lưu của bạn vẫn an toàn.'
                  : 'Your saved schoolwork is safe on this device.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={isVi ? 'Đóng' : 'Close'}
            className="p-1.5 text-[#8C897F] hover:text-[#141413] dark:hover:text-[#FAF9F5] rounded-lg hover:bg-[#FAF9F5] dark:hover:bg-[#252422] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          <div className="p-3.5 bg-[#FAF9F5] dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] rounded-xl text-[#5C5A54] dark:text-[#B5B2A8] space-y-1.5">
            <div className="font-bold text-[#141413] dark:text-[#FAF9F5] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#D97757]" />
              <span>{isVi ? 'Chuyện gì đã xảy ra?' : 'What happened?'}</span>
            </div>
            <p className="leading-relaxed">
              {isVi
                ? 'Tính năng Google này chưa được bật hoặc đang tạm gián đoạn. Đây không phải lỗi tài khoản của bạn.'
                : 'This Google feature isn’t active right now. It’s not a problem with your account, and none of your saved work was lost.'}
            </p>
          </div>

          <div className="space-y-2">
            <p className="font-bold text-[#141413] dark:text-[#FAF9F5]">
              {isVi ? 'Bạn có thể thử:' : 'What you can do'}
            </p>
            <ul className="space-y-2 text-[#5C5A54] dark:text-[#B5B2A8]">
              {steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2 leading-relaxed">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#FAF9F5] dark:bg-[#1F1E1B] border-t border-[#DFDACB] dark:border-[#2C2B27] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#6B6860] dark:text-[#B5B2A8] hover:bg-[#EFECE2] dark:hover:bg-[#252422] rounded-xl transition-colors cursor-pointer min-h-[40px]"
          >
            {isVi ? 'Đóng' : 'Close'}
          </button>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={isRetrying}
              className="px-4 py-2 bg-[#D97757] hover:bg-[#C86646] disabled:opacity-50 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs min-h-[40px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>{isVi ? 'Thử lại' : 'Try again'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

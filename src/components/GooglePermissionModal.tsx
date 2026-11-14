import React, { useEffect } from 'react';
import { X, CheckCircle2, ShieldCheck, Ban, ArrowRight, Loader2 } from 'lucide-react';
import { AppLogo } from './AppLogo';
import type { GoogleFeature } from '../services/googleAuth';
import { useLang } from '../services/i18n';

export interface GooglePermissionModalProps {
  isOpen: boolean;
  feature: GoogleFeature;
  userEmail?: string | null;
  isConnecting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

interface BilingualText {
  en: string;
  vi: string;
}

interface FeatureCopy {
  logoId: string;
  title: BilingualText;
  whyWeAsk: BilingualText;
  canDo: BilingualText[];
  neverDo: BilingualText[];
}

const FEATURE_COPY: Record<GoogleFeature, FeatureCopy> = {
  calendar: {
    logoId: 'radar',
    title: {
      en: 'Connect Google Calendar',
      vi: 'Kết nối Google Calendar',
    },
    whyWeAsk: {
      en: 'So StudentOS can show your classes alongside deadlines and add study blocks when you choose.',
      vi: 'Để StudentOS hiện lịch học cạnh hạn nộp bài và thêm buổi tự học vào lịch khi bạn chọn.',
    },
    canDo: [
      {
        en: 'Show your upcoming classes and calendar events in your daily schedule',
        vi: 'Hiển thị các buổi học và sự kiện sắp tới trên lịch học hằng ngày',
      },
      {
        en: 'Add new study sessions to your calendar when you tap Save',
        vi: 'Thêm khung giờ tự học mới vào lịch khi bạn bấm Lưu',
      },
    ],
    neverDo: [
      {
        en: 'Never delete or change your existing events unless you ask',
        vi: 'Không tự ý xóa hay sửa các sự kiện đã có của bạn',
      },
      {
        en: 'Never share your calendar with anyone else',
        vi: 'Không chia sẻ lịch của bạn với bất kỳ ai khác',
      },
    ],
  },
  gmail: {
    logoId: 'gmail',
    title: {
      en: 'Connect Gmail',
      vi: 'Kết nối Gmail',
    },
    whyWeAsk: {
      en: 'So StudentOS can spot homework, exam dates, and teacher announcements hidden in your inbox.',
      vi: 'Để StudentOS tìm giúp bài tập, ngày thi và thông báo từ thầy cô trong hộp thư của bạn.',
    },
    canDo: [
      {
        en: 'Read school-related emails to highlight assignment names and due dates',
        vi: 'Đọc các email học tập để rút ra tên bài tập và hạn nộp',
      },
      {
        en: 'Show short email summaries inside your Gmail tab',
        vi: 'Hiển thị tóm tắt ngắn gọn ngay trong mục Gmail',
      },
    ],
    neverDo: [
      {
        en: 'Never send, reply to, or delete any email for you',
        vi: 'Không bao giờ gửi, trả lời hay xóa bất kỳ email nào thay bạn',
      },
      {
        en: 'Never sell your emails or use them to show ads',
        vi: 'Không bán dữ liệu email hay dùng để hiển thị quảng cáo',
      },
    ],
  },
  drive: {
    logoId: 'drive',
    title: {
      en: 'Connect Google Drive & Docs',
      vi: 'Kết nối Google Drive & Docs',
    },
    whyWeAsk: {
      en: 'So StudentOS can create study docs for you and open only the files you make or pick here.',
      vi: 'Để StudentOS tạo tài liệu học giúp bạn và chỉ mở những tệp bạn tạo hoặc chọn ở đây.',
    },
    canDo: [
      {
        en: 'Create new study docs and assignment starters when you ask',
        vi: 'Tạo tài liệu học hoặc bài mẫu mới khi bạn yêu cầu',
      },
      {
        en: 'Open and update only the files made or picked inside StudentOS',
        vi: 'Chỉ mở và cập nhật các tệp do StudentOS tạo hoặc bạn tự chọn',
      },
    ],
    neverDo: [
      {
        en: 'Never see, open, or touch any of your other Drive files or photos',
        vi: 'Không xem, mở hay chạm vào các tệp Drive hoặc ảnh khác của bạn',
      },
      {
        en: 'Never share your documents unless you click Share',
        vi: 'Không chia sẻ tài liệu nếu bạn không tự bấm Chia sẻ',
      },
    ],
  },
  sheets: {
    logoId: 'tracker',
    title: {
      en: 'Connect Google Sheets',
      vi: 'Kết nối Google Sheets',
    },
    whyWeAsk: {
      en: 'So StudentOS can save your personal assignment list in a spreadsheet inside your Google Drive.',
      vi: 'Để StudentOS lưu danh sách bài tập của bạn vào một bảng tính riêng trên Google Drive.',
    },
    canDo: [
      {
        en: 'Create your own StudentOS Assignment Tracker spreadsheet',
        vi: 'Tạo bảng tính theo dõi bài tập riêng cho bạn',
      },
      {
        en: 'Update rows inside that spreadsheet when you add or finish tasks',
        vi: 'Cập nhật các dòng trong chính bảng tính đó khi bạn thêm hoặc hoàn thành bài',
      },
    ],
    neverDo: [
      {
        en: 'Never view or edit any of your other Google Sheets or Drive files',
        vi: 'Không xem hay sửa bất kỳ bảng tính hoặc tệp Drive nào khác của bạn',
      },
      {
        en: 'Never share your spreadsheet with anyone else',
        vi: 'Không chia sẻ bảng bài tập của bạn với bất kỳ ai',
      },
    ],
  },
  classroom: {
    logoId: 'classroom',
    title: {
      en: 'Connect Google Classroom',
      vi: 'Kết nối Google Classroom',
    },
    whyWeAsk: {
      en: 'So StudentOS can bring your classes, homework, and teacher announcements into one checklist.',
      vi: 'Để StudentOS gom các lớp học, bài tập và thông báo của thầy cô về một danh sách gọn gàng.',
    },
    canDo: [
      {
        en: 'See the names of your enrolled classes',
        vi: 'Xem tên các lớp học bạn đang tham gia',
      },
      {
        en: 'Read your assignments, due dates, and teacher announcements',
        vi: 'Đọc bài tập, hạn nộp và thông báo từ giáo viên',
      },
    ],
    neverDo: [
      {
        en: 'Never see your grades, edit teacher posts, or turn in work for you',
        vi: 'Không xem điểm số, không sửa bài đăng và không nộp bài thay bạn',
      },
      {
        en: 'Never post comments or messages to your classes',
        vi: 'Không đăng bình luận hay tin nhắn nào lên lớp học của bạn',
      },
    ],
  },
};

export const GooglePermissionModal: React.FC<GooglePermissionModalProps> = ({
  isOpen,
  feature,
  userEmail,
  isConnecting = false,
  onConfirm,
  onCancel,
}) => {
  const [lang] = useLang();
  const isVi = lang === 'vi';
  const pick = (b: BilingualText) => (isVi ? b.vi : b.en);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isConnecting) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isConnecting, onCancel]);

  if (!isOpen) return null;

  const info = FEATURE_COPY[feature] || FEATURE_COPY.calendar;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="google-permission-modal-title"
      className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isConnecting) {
          onCancel();
        }
      }}
    >
      <div className="relative w-full max-w-md bg-[#FAF9F5] dark:bg-[#141413] border border-[#DFDACB] dark:border-[#2C2B27] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 pb-4 border-b border-[#DFDACB] dark:border-[#2C2B27] flex items-start justify-between gap-3 bg-white/70 dark:bg-[#1A1917]/70">
          <div className="flex items-center gap-3 min-w-0">
            <AppLogo id={info.logoId} size="md" />
            <div className="min-w-0">
              <h2
                id="google-permission-modal-title"
                className="text-base sm:text-lg font-extrabold text-[#141413] dark:text-[#FAF9F5] leading-snug"
              >
                {pick(info.title)}
              </h2>
              {userEmail && (
                <p className="text-[11px] font-medium text-[#6B6860] dark:text-[#B5B2A8] truncate mt-0.5">
                  {isVi ? `Tài khoản: ${userEmail}` : `Using ${userEmail}`}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={isConnecting}
            aria-label={isVi ? 'Đóng' : 'Close'}
            className="p-1.5 rounded-xl text-[#6B6860] hover:text-[#141413] dark:text-[#B5B2A8] dark:hover:text-[#FAF9F5] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Why we ask */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1A1917] border border-[#DFDACB] dark:border-[#2C2B27] space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#D97757]">
              {isVi ? 'Vì sao cần kết nối này?' : 'Why we ask'}
            </p>
            <p className="text-xs sm:text-[13px] text-[#141413] dark:text-[#FAF9F5] leading-relaxed">
              {pick(info.whyWeAsk)}
            </p>
          </div>

          {/* What StudentOS will be able to do */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-900/60 space-y-2">
            <p className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{isVi ? 'StudentOS sẽ có thể:' : 'What StudentOS will be able to do'}</span>
            </p>
            <ul className="space-y-1.5 text-[#141413] dark:text-[#E6E4DC]">
              {info.canDo.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 leading-relaxed">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0" />
                  <span>{pick(item)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* What we never do */}
          <div className="p-3.5 rounded-2xl bg-[#FAF9F5] dark:bg-[#1A1917] border border-[#DFDACB] dark:border-[#2C2B27] space-y-2">
            <p className="font-bold text-[#141413] dark:text-[#FAF9F5] flex items-center gap-1.5">
              <Ban className="w-4 h-4 text-[#D97757] shrink-0" />
              <span>{isVi ? 'Những điều chúng tôi KHÔNG BAO GIỜ làm:' : 'What we never do'}</span>
            </p>
            <ul className="space-y-1.5 text-[#5C5A54] dark:text-[#B5B2A8]">
              {info.neverDo.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 leading-relaxed">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#D97757] shrink-0" />
                  <span>{pick(item)}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[11px] text-[#6B6860] dark:text-[#B5B2A8] flex items-start gap-1.5 leading-relaxed px-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <span>
              {isVi
                ? 'Bạn luôn nắm quyền kiểm soát — có thể tắt kết nối này bất cứ lúc nào trong Cài đặt hoặc Tài khoản Google.'
                : 'You stay in control — you can turn this off anytime in Settings or your Google Account.'}
            </span>
          </p>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-[#DFDACB] dark:border-[#2C2B27] bg-white/70 dark:bg-[#1A1917]/70 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isConnecting}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#5C5A54] dark:text-[#B5B2A8] hover:bg-[#EFECE2] dark:hover:bg-[#252422] transition-colors cursor-pointer min-h-[44px] disabled:opacity-50"
          >
            {isVi ? 'Để sau' : 'Not now'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConnecting}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#D97757] hover:bg-[#C86646] text-white shadow-xs transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px] disabled:opacity-60"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{isVi ? 'Đang mở Google...' : 'Opening Google...'}</span>
              </>
            ) : (
              <>
                <span>{isVi ? 'Cho phép & Tiếp tục' : 'Allow & Continue'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

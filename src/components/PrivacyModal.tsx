import React, { useEffect } from 'react';
import { ShieldCheck, Trash2, LogOut, ChevronDown } from 'lucide-react';
import { useLang } from '../services/i18n';

interface BilingualItem {
  title: [string, string];
  vi: string;
  en: string;
}

const FEATURE_PERMISSIONS: BilingualItem[] = [
  {
    title: ['Đăng nhập Google cơ bản', 'Basic Google sign-in'],
    vi: 'Khi mới vào ứng dụng, chúng tôi chỉ xem tên và địa chỉ email của bạn để tạo không gian học tập.',
    en: 'When you first sign in, we only ask for your name and email address.',
  },
  {
    title: ['Google Calendar (chỉ khi bạn bật)', 'Google Calendar (only when you turn it on)'],
    vi: 'Xem lịch học để tránh trùng giờ, và thêm buổi tự học mới vào Google Calendar khi bạn bấm Lưu. Không tự ý xóa sự kiện của bạn.',
    en: 'Shows your classes alongside deadlines and adds new study sessions when you tap Save. Never deletes your existing events.',
  },
  {
    title: ['Google Drive & Docs (chỉ khi bạn bật)', 'Google Drive & Docs (only when you turn it on)'],
    vi: 'Chỉ mở và lưu những tài liệu do StudentOS tạo hoặc tệp bạn tự tay chọn. Không xem được các tệp hay ảnh khác trong Drive.',
    en: 'Creates study docs and opens only the files StudentOS made or files you choose yourself. Never sees anything else in your Drive.',
  },
  {
    title: ['Google Sheets (chỉ khi bạn bật)', 'Google Sheets (only when you turn it on)'],
    vi: 'Tạo và cập nhật bảng theo dõi bài tập của riêng bạn. Không đọc hay sửa các bảng tính khác.',
    en: 'Creates and updates only your personal assignment spreadsheet. Never opens or edits your other sheets.',
  },
  {
    title: ['Google Classroom (chỉ khi bạn bật)', 'Google Classroom (only when you turn it on)'],
    vi: 'Xem tên các lớp học, bài tập, hạn nộp và thông báo của thầy cô. Không xem điểm số và không nộp bài thay bạn.',
    en: 'See your class names, assignments, due dates, and teacher announcements. Never sees grades or turns in work for you.',
  },
  {
    title: ['Gmail (chỉ khi bạn bật)', 'Gmail (only when you turn it on)'],
    vi: 'Chỉ đọc các email học tập để tìm bài tập và ngày thi. Không bao giờ gửi, trả lời hay xóa email thay bạn.',
    en: 'Reads school emails to spot homework and exam dates. Never sends, replies to, or deletes any email.',
  },
  {
    title: ['Canvas (tùy chọn)', 'Canvas (optional)'],
    vi: 'Chỉ khi bạn dán liên kết hoặc mã truy cập Canvas. Mã nằm trên thiết bị của bạn và chỉ dùng để tải bài tập.',
    en: 'Only if you paste a Canvas link or access key. Your key stays on your device and is only used to read your coursework.',
  },
];

const TECHNICAL_SCOPE_DETAILS: { scope: string; feature: [string, string] }[] = [
  { scope: 'classroom.courses.readonly', feature: ['Lớp học Google Classroom', 'Google Classroom classes'] },
  { scope: 'classroom.coursework.me.readonly', feature: ['Bài tập & hạn nộp Classroom', 'Classroom assignments & due dates'] },
  { scope: 'classroom.announcements.readonly', feature: ['Thông báo giáo viên Classroom', 'Classroom teacher announcements'] },
  { scope: 'calendar.events', feature: ['Lịch & buổi tự học Google Calendar', 'Google Calendar events & study blocks'] },
  { scope: 'drive.file', feature: ['Tệp & bảng tính do ứng dụng tạo/chọn', 'App-created or picked Drive & Sheets files'] },
  { scope: 'gmail.readonly', feature: ['Đọc email học tập trong Gmail', 'Gmail academic reading'] },
];

const AI_FLOWS: { source: [string, string]; sent: [string, string]; to: [string, string] }[] = [
  {
    source: ['Gmail', 'Gmail'],
    sent: [
      'Tên + địa chỉ người gửi, tiêu đề, ngày gửi và tối đa 1.500 ký tự đầu nội dung (đã bỏ phần trích dẫn cũ và chữ ký). Thư trong Quảng cáo / Mạng xã hội KHÔNG được gửi cho AI trừ khi bạn bấm "Cho AI đọc thư này".',
      'Sender name + address, subject, date, and the first 1,500 characters of the message (old quoted replies and signatures are removed). Mail under Promotions / Social is NOT sent to AI unless you tap "Let AI read this email".',
    ],
    to: ['Google Gemini (qua máy chủ StudentOS); nếu Gemini bận thì Groq (Llama)', 'Google Gemini (through StudentOS); if Gemini is unavailable, Groq (Llama)'],
  },
  {
    source: ['Thông báo Classroom', 'Classroom announcements'],
    sent: ['Tên lớp + nội dung thông báo.', 'Class name + announcement text.'],
    to: ['Google Gemini; nếu bận thì Groq (Llama)', 'Google Gemini; if unavailable, Groq (Llama)'],
  },
  {
    source: ['Câu bạn nhập (thêm bài tập, đổi lịch)', 'Text you type (add homework, change schedule)'],
    sent: ['Nội dung câu bạn nhập + danh sách buổi học.', 'The sentence you typed + your class sessions.'],
    to: ['Google Gemini; nếu bận thì Groq (Llama)', 'Google Gemini; if unavailable, Groq (Llama)'],
  },
  {
    source: ['Gia sư AI', 'AI tutor'],
    sent: ['Tin nhắn bạn gửi cho gia sư.', 'The messages you send to the tutor.'],
    to: ['Google Gemini; nếu lỗi thì Groq', 'Google Gemini; if unavailable, Groq'],
  },
];

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
  const [lang] = useLang();
  const L = (vi: string, en: string) => (lang === 'vi' ? vi : en);
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
      aria-label={L('Quyền riêng tư và quyền truy cập', 'Privacy and permissions')}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-3xl p-5 sm:p-6 space-y-4 max-h-[88vh] overflow-y-auto" style={{ backgroundColor: 'var(--surface)' }}>
        <h2 className="text-base font-extrabold flex items-center gap-2"><ShieldCheck className="w-5 h-5" /> {L('Dữ liệu của bạn, nói đơn giản', 'Your data, in plain words')}</h2>
        <p className="text-xs opacity-75 leading-relaxed">
          {L(
            'StudentOS chỉ xin từng quyền khi bạn thật sự mở tính năng đó — không bao giờ xin tất cả lúc mới đăng nhập. Không bán dữ liệu, không quảng cáo.',
            'StudentOS only asks for one permission at a time when you open a feature — never all at once at sign-in. We never sell your data and show no ads.',
          )}
        </p>

        <div className="space-y-2">
          <Section title={L('Ứng dụng xin những quyền nào — và vì sao', 'Which permissions we ask for, and why')} defaultOpen>
            <ul className="space-y-2">
              {FEATURE_PERMISSIONS.map((p) => (
                <li key={p.title[1]} className="p-2.5 rounded-xl border" style={{ borderColor: 'var(--line)' }}>
                  <p className="font-bold text-xs">{L(p.title[0], p.title[1])}</p>
                  <p className="mt-0.5 opacity-80">{L(p.vi, p.en)}</p>
                </li>
              ))}
            </ul>
            <p className="font-semibold">
              {L(
                '✅ Khi mới đăng nhập, ứng dụng chỉ xin tên và email cơ bản. Từng tính năng Google chỉ xin quyền khi bạn chọn dùng.',
                '✅ At sign-in, we only ask for your basic name and email. Each Google feature asks for access only if and when you turn it on.',
              )}
            </p>
            <details className="rounded-xl border p-2.5 text-[11px]" style={{ borderColor: 'var(--line)' }}>
              <summary className="cursor-pointer font-semibold opacity-75">
                {L('Chi tiết kỹ thuật (tên quyền Google chính thức)', 'Technical details (official Google permission IDs)')}
              </summary>
              <ul className="mt-2 space-y-1 opacity-80">
                {TECHNICAL_SCOPE_DETAILS.map((item) => (
                  <li key={item.scope} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5">
                    <code className="font-mono font-bold break-all">{item.scope}</code>
                    <span>{L(item.feature[0], item.feature[1])}</span>
                  </li>
                ))}
              </ul>
            </details>
          </Section>

          <Section title={L('Dữ liệu nào được gửi cho AI', 'What data is sent to AI')}>
            <ul className="space-y-2">
              {AI_FLOWS.map((f) => (
                <li key={f.source[1]} className="p-2.5 rounded-xl border space-y-1" style={{ borderColor: 'var(--line)' }}>
                  <p className="font-bold">{L(f.source[0], f.source[1])}</p>
                  <p><span className="opacity-60">{L('Gửi: ', 'Sent: ')}</span>{L(f.sent[0], f.sent[1])}</p>
                  <p><span className="opacity-60">{L('Cho: ', 'To: ')}</span>{L(f.to[0], f.to[1])}</p>
                </li>
              ))}
            </ul>
            <p className="font-semibold">⛔ {L('KHÔNG BAO GIỜ gửi: mật khẩu, mã Canvas, điểm số, danh bạ.', 'NEVER sent: passwords, Canvas keys, grades, contacts.')}</p>
            <p className="opacity-80">⚠️ {L('AI có thể nhầm lẫn. Mọi bài tập AI tìm thấy đều chờ bạn xác nhận trước khi lưu.', 'AI can make mistakes. Every assignment AI finds waits for your confirmation before saving.')}</p>
          </Section>

          <Section title={L('Dữ liệu được lưu ở đâu', 'Where your data is stored')}>
            <ul className="list-disc pl-4 space-y-1.5">
              <li>{L('Thư đã tải, lịch học và lịch sử lịch: lưu ngay trên thiết bị của bạn.', 'Downloaded mail, class timetable, and calendar history: stored right on your device.')}</li>
              <li>{L('Bài tập: lưu trên thiết bị của bạn và trong Google Sheet riêng của chính bạn (nếu bạn bật).', 'Assignments: stored on your device and in your own Google Sheet (if you connect it).')}</li>
              <li>{L('Để giữ kết nối mượt khi bạn dùng thiết bị khác, khóa đăng nhập riêng được bảo vệ trong tài khoản của bạn. Chỉ tài khoản của bạn mới đọc được.', 'So you stay connected across devices without re-approving every hour, your private sign-in pass is protected under your account. Only your account can read it.')}</li>
              <li>{L('Không bán dữ liệu, không quảng cáo.', 'We never sell data and show no ads.')}</li>
            </ul>
          </Section>

          <Section title={L('Gia sư AI chỉ gợi ý, không làm bài hộ', 'The AI tutor gives hints, not finished answers')}>
            <p>
              {L(
                'Gia sư AI hỏi bạn đã làm đến đâu, rồi chỉ đưa một gợi ý hoặc bước đầu tiên. Gia sư giải thích khái niệm, cho ví dụ tương tự và kiểm tra các bước bạn làm — không đưa đáp án cuối hay bài văn làm sẵn để bạn thật sự hiểu bài.',
                'The AI tutor asks how far you got, then gives just one hint or first step. It explains ideas, shows similar examples, and checks your work — without handing over final answers or finished essays so you really learn.',
              )}
            </p>
          </Section>

          <Section title={L('Dành cho phụ huynh', 'For parents')}>
            <ul className="list-disc pl-4 space-y-1.5">
              <li>{L('StudentOS giúp con theo dõi bài tập, hạn nộp và lịch học từ Google Classroom, Gmail và Canvas.', 'StudentOS helps your child track homework, deadlines, and their timetable from Google Classroom, Gmail, and Canvas.')}</li>
              <li>
                {L('Tắt quyền bất cứ lúc nào tại ', 'You can remove access anytime at ')}
                <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer" className="underline font-semibold break-all" style={{ color: 'var(--terracotta)' }}>myaccount.google.com/permissions</a>.
              </li>
              <li>{L('Nút "Xóa toàn bộ dữ liệu của tôi" bên dưới xóa mọi dữ liệu lưu trên máy này.', 'The "Delete all my data" button below erases everything stored on this device.')}</li>
              <li>{L('Có câu hỏi hoặc muốn xóa dữ liệu trên máy chủ? Hãy liên hệ nhóm StudentOS qua trang liên hệ của ứng dụng.', 'Questions, or want server-side data removed? Reach the StudentOS team through the app’s contact page.')}</li>
            </ul>
          </Section>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onRevoke} className="px-4 py-2.5 text-xs font-bold rounded-xl border min-h-[44px] inline-flex items-center gap-1 cursor-pointer" style={{ borderColor: 'var(--line)' }}>
            <LogOut className="w-3.5 h-3.5" /> {L('Ngắt kết nối Google', 'Disconnect Google')}
          </button>
          {!confirming
            ? <button type="button" onClick={() => setConfirming(true)} className="px-4 py-2.5 text-xs font-bold rounded-xl border border-rose-300 text-rose-600 min-h-[44px] inline-flex items-center gap-1 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /> {L('Xóa toàn bộ dữ liệu của tôi…', 'Delete all my data…')}</button>
            : (
              <>
                <button type="button" onClick={async () => { await onDeleteAll(); onClose(); }} className="px-4 py-2.5 text-xs font-bold rounded-xl bg-rose-600 text-white min-h-[44px] cursor-pointer">{L('Chắc chắn — xóa hết dữ liệu trên máy', 'Yes, erase all data on this device')}</button>
                <button type="button" onClick={() => setConfirming(false)} className="px-4 py-2.5 text-xs font-bold rounded-xl border min-h-[44px] cursor-pointer" style={{ borderColor: 'var(--line)' }}>{L('Hủy', 'Cancel')}</button>
              </>
            )}
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-xs font-bold text-white rounded-xl min-h-[44px] ml-auto cursor-pointer" style={{ backgroundColor: 'var(--terracotta)' }}>{L('Xong', 'Done')}</button>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { ShieldCheck, Trash2, LogOut, ChevronDown } from 'lucide-react';
import { getLang, useLang } from '../services/i18n';

const L = (vi: string, en: string) => (getLang() === 'vi' ? vi : en);

const PERMISSIONS: { scope: string; vi: string; en: string }[] = [
  { scope: 'classroom.courses.readonly', vi: 'Xem tên các lớp trên Google Classroom. Không xem điểm, không nộp bài.', en: 'See the names of your Google Classroom classes. No grades, no turning in work.' },
  { scope: 'classroom.coursework.me.readonly', vi: 'Đọc bài tập và hạn nộp của chính em.', en: 'Read your own assignments and due dates.' },
  { scope: 'classroom.announcements.readonly', vi: 'Đọc thông báo của thầy cô (thầy cô hay giao bài trong thông báo).', en: 'Read your teachers\' announcements (teachers often post homework there).' },
  { scope: 'calendar.events', vi: 'Đọc lịch học để không xếp trùng, và thêm buổi học vào Google Calendar khi em bấm. Không xoá sự kiện của em.', en: 'Read your timetable so plans do not clash, and add study sessions to Google Calendar when you tap. Never deletes your events.' },
  { scope: 'drive.file', vi: 'Chỉ những file do StudentOS tạo (bảng theo dõi bài tập, tài liệu) hoặc file em tự chọn. Không xem được các file khác trong Drive.', en: 'Only files StudentOS created (assignment tracker, documents) or files you pick yourself. It cannot see anything else in your Drive.' },
  { scope: 'gmail.readonly', vi: 'CHỈ khi em bật "Quét Gmail": đọc thư để tìm bài tập và hạn nộp. Không gửi, không xoá, không đánh dấu thư.', en: 'ONLY when you turn on "Scan Gmail": reads mail to find homework and due dates. Never sends, deletes or marks mail.' },
];

const AI_FLOWS: { source: [string, string]; sent: [string, string]; to: [string, string] }[] = [
  {
    source: ['Gmail', 'Gmail'],
    sent: [
      'Tên + địa chỉ người gửi, tiêu đề, ngày gửi, tối đa 1.500 ký tự đầu nội dung (đã cắt phần trích dẫn thư cũ và chữ ký). Thư Gmail đã xếp vào Quảng cáo / Mạng xã hội KHÔNG được gửi cho AI, trừ khi em bấm "Cho AI đọc thư này".',
      'Sender name + address, subject, date, and the first 1,500 characters of the body (old quoted replies and signatures are cut). Mail Gmail filed under Promotions / Social is NOT sent to the AI unless you tap "Let AI read this email".',
    ],
    to: ['Google Gemini (qua máy chủ của StudentOS)', 'Google Gemini (through the StudentOS server)'],
  },
  {
    source: ['Thông báo Classroom', 'Classroom announcements'],
    sent: ['Tên lớp + nội dung thông báo.', 'Class name + announcement text.'],
    to: ['Google Gemini', 'Google Gemini'],
  },
  {
    source: ['Câu em gõ (thêm bài tập, đổi lịch)', 'Sentences you type (add homework, change schedule)'],
    sent: ['Nội dung câu em gõ + danh sách buổi học.', 'The sentence you typed + your list of class sessions.'],
    to: ['Google Gemini; nếu Gemini lỗi thì Groq (Llama)', 'Google Gemini; if Gemini fails, Groq (Llama)'],
  },
  {
    source: ['Gia sư AI', 'AI tutor'],
    sent: ['Tin nhắn em gửi cho gia sư.', 'The messages you send to the tutor.'],
    to: ['Google Gemini; nếu lỗi thì Groq', 'Google Gemini; if it fails, Groq'],
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

/** Plain-language privacy: which permissions, what goes to the AI, where data lives, parent info, revoke + delete. */
export const PrivacyModal: React.FC<{ onClose: () => void; onRevoke: () => void; onDeleteAll: () => Promise<void> }> = ({ onClose, onRevoke, onDeleteAll }) => {
  useLang();
  const [confirming, setConfirming] = React.useState(false);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={L('Quyền riêng tư và quyền truy cập', 'Privacy and permissions')}>
      <div className="w-full max-w-lg rounded-3xl p-5 sm:p-6 space-y-4 max-h-[88vh] overflow-y-auto" style={{ backgroundColor: 'var(--surface)' }}>
        <h2 className="text-base font-extrabold flex items-center gap-2"><ShieldCheck className="w-5 h-5" /> {L('Dữ liệu của em, nói đơn giản', 'Your data, in plain words')}</h2>
        <p className="text-xs opacity-70 leading-relaxed">
          {L(
            'StudentOS chỉ xin quyền thật sự cần. Dưới đây là quyền nào, dữ liệu nào được gửi cho AI, và dữ liệu nằm ở đâu. Không bán dữ liệu, không quảng cáo.',
            'StudentOS only asks for the permissions it truly needs. Here is which permissions, which data goes to the AI, and where your data lives. We never sell data and show no ads.',
          )}
        </p>

        <div className="space-y-2">
          <Section title={L('Ứng dụng xin những quyền nào — và vì sao', 'Which permissions we ask for, and why')} defaultOpen>
            <ul className="space-y-2">
              {PERMISSIONS.map((p) => (
                <li key={p.scope} className="p-2.5 rounded-xl border" style={{ borderColor: 'var(--line)' }}>
                  <code className="font-mono text-[11px] font-bold break-all">{p.scope}</code>
                  <p className="mt-0.5 opacity-80">{L(p.vi, p.en)}</p>
                </li>
              ))}
              <li className="p-2.5 rounded-xl border" style={{ borderColor: 'var(--line)' }}>
                <code className="font-mono text-[11px] font-bold">Canvas</code>
                <p className="mt-0.5 opacity-80">{L('Chỉ khi em dán mã truy cập Canvas. Mã nằm trên máy em và chỉ dùng để đọc bài tập.', 'Only if you paste a Canvas access token. The token stays on your device and is only used to read assignments.')}</p>
              </li>
            </ul>
            <p className="font-semibold">✅ {L('Đã bỏ 7 quyền không cần thiết (danh bạ lớp, toàn bộ Drive, toàn bộ Docs/Sheets, soạn thư Gmail…).', 'We removed 7 permissions we do not need (class rosters, all of Drive, all of Docs/Sheets, composing Gmail…).')}</p>
          </Section>

          <Section title={L('Dữ liệu nào được gửi cho AI', 'What data is sent to the AI')}>
            <ul className="space-y-2">
              {AI_FLOWS.map((f) => (
                <li key={f.source[1]} className="p-2.5 rounded-xl border space-y-1" style={{ borderColor: 'var(--line)' }}>
                  <p className="font-bold">{L(f.source[0], f.source[1])}</p>
                  <p><span className="opacity-60">{L('Gửi: ', 'Sent: ')}</span>{L(f.sent[0], f.sent[1])}</p>
                  <p><span className="opacity-60">{L('Cho: ', 'To: ')}</span>{L(f.to[0], f.to[1])}</p>
                </li>
              ))}
            </ul>
            <p className="font-semibold">⛔ {L('KHÔNG BAO GIỜ gửi: mật khẩu, mã Canvas, điểm số, danh bạ.', 'NEVER sent: passwords, Canvas token, grades, contacts.')}</p>
            <p className="opacity-80">⚠️ {L('AI có thể sai. Mọi bài tập AI tìm thấy đều chờ em xác nhận trước khi lưu.', 'AI can be wrong. Every assignment the AI finds waits for your OK before it is saved.')}</p>
          </Section>

          <Section title={L('Dữ liệu được lưu ở đâu', 'Where your data is stored')}>
            <ul className="list-disc pl-4 space-y-1.5">
              <li>{L('Thư đã tải, lịch học và lịch sử lịch: lưu trên máy em (bộ nhớ trình duyệt).', 'Downloaded mail, class timetable and calendar history: stored on your device (browser storage).')}</li>
              <li>{L('Bài tập: lưu trên máy em và trong Google Sheet của chính em.', 'Assignments: stored on your device and in your own Google Sheet.')}</li>
              <li>{L('Để đăng nhập lại trên máy khác, khoá truy cập Google (refresh token) được lưu trong tài khoản Firebase của em. Chỉ tài khoản của em đọc được.', 'So you can sign in again on another device, your Google access key (refresh token) is kept in your own Firebase account. Only your account can read it.')}</li>
              <li>{L('Không bán dữ liệu, không quảng cáo.', 'We do not sell data and show no ads.')}</li>
            </ul>
          </Section>

          <Section title={L('Gia sư AI chỉ gợi ý, không làm bài hộ', 'The AI tutor gives hints, it does not do your homework')}>
            <p>
              {L(
                'Gia sư AI hỏi em đã làm đến đâu, rồi chỉ đưa một gợi ý hoặc bước đầu tiên. Gia sư giải thích khái niệm, cho ví dụ tương tự với số khác và kiểm tra các bước em làm — nhưng không đưa đáp án cuối hay bài văn hoàn chỉnh. Như vậy em thật sự hiểu bài.',
                'The AI tutor asks how far you got, then gives just one hint or the first step. It explains ideas, shows a similar example with different numbers and checks your own steps, but it will not hand over the final answer or a finished essay. That way you really learn it.',
              )}
            </p>
          </Section>

          <Section title={L('Dành cho phụ huynh', 'For parents')}>
            <ul className="list-disc pl-4 space-y-1.5">
              <li>{L('StudentOS giúp con theo dõi bài tập, hạn nộp và lịch học từ Google Classroom, Gmail và Canvas.', 'StudentOS helps your child track homework, deadlines and the timetable from Google Classroom, Gmail and Canvas.')}</li>
              <li>
                {L('Thu hồi quyền bất cứ lúc nào tại ', 'You can take back access at any time at ')}
                <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer" className="underline font-semibold break-all" style={{ color: 'var(--terracotta)' }}>myaccount.google.com/permissions</a>.
              </li>
              <li>{L('Nút "Xoá toàn bộ dữ liệu của tôi" bên dưới xoá mọi dữ liệu lưu trên máy này.', 'The "Delete all my data" button below erases everything stored on this device.')}</li>
              <li>{L('Có câu hỏi hoặc muốn xoá dữ liệu trên máy chủ? Hãy liên hệ nhóm StudentOS qua trang liên hệ của ứng dụng.', 'Questions, or want server-side data removed? Contact the StudentOS team through the app\'s contact page.')}</li>
            </ul>
          </Section>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={onRevoke} className="px-4 py-2.5 text-xs font-bold rounded-xl border min-h-[44px] inline-flex items-center gap-1" style={{ borderColor: 'var(--line)' }}>
            <LogOut className="w-3.5 h-3.5" /> {L('Thu hồi quyền Google', 'Revoke Google access')}
          </button>
          {!confirming
            ? <button onClick={() => setConfirming(true)} className="px-4 py-2.5 text-xs font-bold rounded-xl border border-rose-300 text-rose-600 min-h-[44px] inline-flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> {L('Xoá toàn bộ dữ liệu của tôi…', 'Delete all my data…')}</button>
            : (
              <>
                <button onClick={async () => { await onDeleteAll(); onClose(); }} className="px-4 py-2.5 text-xs font-bold rounded-xl bg-rose-600 text-white min-h-[44px]">{L('Chắc chắn — xoá hết dữ liệu trên máy', 'Yes, erase all data on this device')}</button>
                <button onClick={() => setConfirming(false)} className="px-4 py-2.5 text-xs font-bold rounded-xl border min-h-[44px]" style={{ borderColor: 'var(--line)' }}>{L('Huỷ', 'Cancel')}</button>
              </>
            )}
          <button onClick={onClose} className="px-4 py-2.5 text-xs font-bold text-white rounded-xl min-h-[44px] ml-auto" style={{ backgroundColor: 'var(--terracotta)' }}>{L('Xong', 'Done')}</button>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Ban, Cpu, Lock, Sparkles } from 'lucide-react';
import { getPrivacyPrefs, subscribePrivacyPrefs, updatePrivacyPrefs, type StudentPrivacyPrefs } from '../../services/privacyPrefs';
import { useT } from '../../services/i18n';

const tr = (t: (k: string) => string, key: string, en: string, vi: string, lang: string): string => {
  const val = t(key);
  return !val || val === key ? (lang === 'vi' ? vi : en) : val;
};

export const AiDataDisclosurePanel: React.FC = () => {
  const { t, lang } = useT();
  const [prefs, setPrefs] = useState<StudentPrivacyPrefs>(() => getPrivacyPrefs());

  useEffect(() => subscribePrivacyPrefs(setPrefs), []);

  const flows = [
    {
      id: 'gmail',
      source: tr(t, 'privacy_ai_gmail_src', 'Gmail Scanner', 'Quét Gmail', lang),
      sent: tr(
        t,
        'privacy_ai_gmail_sent_v2',
        'Sender, subject, date, and up to 1,500 chars of cleaned body (signatures & quoted replies stripped).',
        'Người gửi, tiêu đề, ngày và tối đa 1.500 ký tự nội dung sạch (đã bỏ chữ ký & trích dẫn cũ).',
        lang
      ),
      to: 'Google Gemini (gemini-flash-latest) / optional Groq (Llama 3.3)',
    },
    {
      id: 'classroom',
      source: tr(t, 'privacy_ai_cls_src', 'Classroom Announcements', 'Thông báo Classroom', lang),
      sent: tr(t, 'privacy_ai_cls_sent', 'Class name + announcement text.', 'Tên môn học + nội dung thông báo.', lang),
      to: 'Google Gemini / optional Groq (Llama 3.3)',
    },
    {
      id: 'planner',
      source: tr(t, 'privacy_ai_planner_src', 'AI Planner & Quick Add', 'Lập kế hoạch AI & Thêm nhanh', lang),
      sent: tr(t, 'privacy_ai_text_sent', 'The sentence you typed + your class sessions.', 'Câu bạn gõ + các buổi học của bạn.', lang),
      to: 'Google Gemini / optional Groq (Llama 3.3)',
    },
    {
      id: 'tutor',
      source: tr(t, 'privacy_ai_tutor_src', 'AI Tutor', 'Gia sư AI', lang),
      sent: tr(
        t,
        'privacy_ai_tutor_sent_v2',
        'Your messages + optional images + optional assignment/schedule/alert summary (rawEmail and senderEmail stripped).',
        'Tin nhắn của bạn + ảnh tùy chọn + tóm tắt bài tập/lịch học tùy chọn (đã xóa rawEmail và senderEmail).',
        lang
      ),
      to: 'Google Gemini / optional Groq (Llama 3.3)',
    },
    {
      id: 'notes',
      source: tr(t, 'privacy_ai_notes_src', 'Note Scanner / Lecture Studio', 'Quét ghi chú / Lecture Studio', lang),
      sent: tr(t, 'privacy_ai_notes_sent', 'Study notes or lecture transcripts you submit for summarization.', 'Ghi chú học tập hoặc bản ghi bài giảng bạn gửi để tóm tắt.', lang),
      to: 'Google Gemini / optional Groq (Llama 3.3)',
    },
  ];

  return (
    <div className="space-y-3 text-xs">
      <ul className="space-y-2">
        {flows.map((f) => (
          <li key={f.id} className="p-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-[var(--text-primary)]">
              <Cpu className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" />
              <span>{f.source}</span>
            </p>
            <p className="text-[var(--text-secondary)]">
              <span className="font-semibold text-[var(--text-primary)]">{t('privacy_ai_sent_label')}</span>
              {f.sent}
            </p>
            <p className="text-[var(--text-secondary)]">
              <span className="font-semibold text-[var(--text-primary)]">{t('privacy_ai_to_label')}</span>
              {f.to}
            </p>
          </li>
        ))}
      </ul>

      <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-200 flex items-start gap-2">
        <Ban className="w-4 h-4 shrink-0 mt-0.5" />
        <p className="font-semibold leading-relaxed">
          {tr(
            t,
            'privacy_ai_never_v2',
            'NEVER sent to AI: passwords, OAuth credentials, Canvas API keys, school grades, class rosters, or unrelated Drive files.',
            'KHÔNG BAO GIỜ gửi cho AI: mật khẩu, khóa OAuth, mã Canvas API, điểm số, danh bạ lớp học hoặc file Drive không liên quan.',
            lang
          )}
        </p>
      </div>

      <div className="p-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] space-y-2.5">
        <p className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[var(--accent-text)]" />
          <span>{tr(t, 'privacy_ai_controls_heading', 'AI & Tutor Privacy Controls', 'Kiểm soát quyền riêng tư AI & Gia sư', lang)}</span>
        </p>

        <label className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] cursor-pointer">
          <span className="text-[var(--text-primary)] font-medium leading-snug">
            {tr(
              t,
              'privacy_pref_tutor_context',
              'Send assignment & schedule summary context to AI Tutor',
              'Gửi tóm tắt bài tập & lịch học cho Gia sư AI',
              lang
            )}
          </span>
          <input
            type="checkbox"
            checked={prefs.shareAcademicContextWithTutor}
            onChange={(e) => updatePrivacyPrefs({ shareAcademicContextWithTutor: e.target.checked })}
            className="w-4 h-4 accent-[var(--accent-fill)] cursor-pointer shrink-0"
          />
        </label>

        <label className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] cursor-pointer">
          <span className="text-[var(--text-primary)] font-medium leading-snug">
            {tr(
              t,
              'privacy_pref_groq_fallback',
              'Allow Groq (Llama) fallback when Google Gemini is busy',
              'Cho phép dùng Groq (Llama) dự phòng khi Google Gemini bận',
              lang
            )}
          </span>
          <input
            type="checkbox"
            checked={prefs.allowGroqFallback}
            onChange={(e) => updatePrivacyPrefs({ allowGroqFallback: e.target.checked })}
            className="w-4 h-4 accent-[var(--accent-fill)] cursor-pointer shrink-0"
          />
        </label>

        <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]">
          <div className="space-y-0.5">
            <p className="font-semibold text-[var(--text-primary)]">
              {tr(t, 'privacy_pref_socratic_title', 'Socratic Hint-Only Tutor', 'Gia sư gợi ý theo phương pháp Socratic', lang)}
            </p>
            <p className="text-[11px] text-[var(--text-secondary)]">{t('privacy_tutor_desc')}</p>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shrink-0">
            <Lock className="w-3 h-3" />
            {tr(t, 'privacy_badge_enforced', 'Always Enforced', 'Luon bat', lang)}
          </span>
        </div>
      </div>

      <p className="text-[var(--text-secondary)] flex items-start gap-1.5 leading-relaxed">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <span>{t('privacy_ai_caution')}</span>
      </p>
    </div>
  );
};

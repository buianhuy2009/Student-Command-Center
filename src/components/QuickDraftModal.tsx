import React, { useState, useEffect } from 'react';
import {
  Send,
  X,
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  Mail,
  ExternalLink,
  Save,
  Globe,
  Link,
  Paperclip,
  Trash2,
  Plus,
} from 'lucide-react';
import { QuickDraftRequest, QuickDraftResponse, EmailMessage, EmailAlert, SchoolFile } from '../types';
import { useT } from '../services/i18n';

const INTENT_CHIPS = [
  { id: 'clarification', labelKey: 'draft_intent_clarification' },
  { id: 'extension', labelKey: 'draft_intent_extension' },
  { id: 'feedback', labelKey: 'draft_intent_feedback' },
  { id: 'meeting', labelKey: 'draft_intent_meeting' },
  { id: 'absence', labelKey: 'draft_intent_absence' },
] as const;

interface QuickDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: EmailMessage | null;
  initialAlert?: EmailAlert | null;
  onGenerateDraft: (req: QuickDraftRequest) => Promise<QuickDraftResponse>;
  onSaveToGmailDrafts?: (to: string, subject: string, body: string) => Promise<void>;
  isSavingDraft?: boolean;
  recentFiles?: SchoolFile[];
}

export const QuickDraftModal: React.FC<QuickDraftModalProps> = ({
  isOpen,
  onClose,
  initialEmail,
  initialAlert,
  onGenerateDraft,
  onSaveToGmailDrafts,
  isSavingDraft = false,
  recentFiles = [],
}) => {
  const [teacherName, setTeacherName] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [context, setContext] = useState('');
  const [emailLanguage, setEmailLanguage] = useState<'en' | 'vi'>('en');
  const [intent, setIntent] = useState<'clarification' | 'extension' | 'feedback' | 'meeting' | 'absence'>(
    'clarification'
  );
  const [tone, setTone] = useState<'polite_respectful' | 'formal' | 'brief'>('polite_respectful');
  const { t } = useT();

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSubject, setGeneratedSubject] = useState('');
  const [generatedBody, setGeneratedBody] = useState('');
  const [copied, setCopied] = useState(false);

  // Auto Gmail Drafter attachments & links states
  const [selectedFiles, setSelectedFiles] = useState<SchoolFile[]>([]);
  const [customLinks, setCustomLinks] = useState<string[]>([]);
  const [newLinkText, setNewLinkText] = useState('');
  const [fileSearchQuery, setFileSearchQuery] = useState('');

  // Pre-fill if email or alert provided
  useEffect(() => {
    if (initialAlert) {
      setTeacherName(initialAlert.sender || '');
      setTeacherEmail(initialAlert.rawEmail?.senderEmail || '');
      setSubject(initialAlert.detectedAssignment?.subject || initialAlert.subject || '');
      setContext(initialAlert.oneLineSummary || initialAlert.rawEmail?.snippet || '');
      if (initialAlert.language === 'vi') {
        setEmailLanguage('vi');
      } else {
        setEmailLanguage('en');
      }
      if (initialAlert.category === 'ASSIGNMENT') setIntent('clarification');
    } else if (initialEmail) {
      setTeacherName(initialEmail.sender || '');
      setTeacherEmail(initialEmail.senderEmail || '');
      setSubject(initialEmail.subject || '');
      setContext(initialEmail.snippet || '');
      const isVi = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(
        `${initialEmail.subject} ${initialEmail.snippet}`
      );
      if (isVi) setEmailLanguage('vi');
    }
  }, [initialEmail, initialAlert]);

  if (!isOpen) return null;

  const draftWordCount = generatedBody.trim() ? generatedBody.trim().split(/\s+/).length : 0;
  const draftCharCount = generatedBody.length;
  const draftReadMins = draftWordCount > 0 ? Math.max(1, Math.ceil(draftWordCount / 200)) : 0;

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsGenerating(true);
    try {
      const res = await onGenerateDraft({
        teacherName: teacherName.trim() || t(emailLanguage === 'vi' ? 'draft_default_teacher_vi' : 'draft_default_teacher_en'),
        teacherEmail: teacherEmail.trim(),
        subject: subject.trim() || t(emailLanguage === 'vi' ? 'draft_default_subject_vi' : 'draft_default_subject_en'),
        context: context.trim(),
        topic: context.trim() || subject.trim(),
        course: subject.trim(),
        intent,
        draftType: intent,
        tone: tone === 'polite_respectful' ? 'Polite & Respectful' : tone === 'formal' ? 'Formal Academic' : 'Brief',
        language: emailLanguage,
        attachments: selectedFiles.map((f) => ({ name: f.name, url: f.webViewLink })),
        links: customLinks,
      });

      setGeneratedSubject(res.subject);
      setGeneratedBody(res.body);
    } catch (err) {
      console.error('Draft generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    const fullText = `Subject: ${generatedSubject}\n\n${generatedBody}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveDraft = async () => {
    if (!onSaveToGmailDrafts) return;
    await onSaveToGmailDrafts(teacherEmail, generatedSubject, generatedBody);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      id="quick-draft-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[var(--bg-raised)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-2xl max-w-2xl w-full p-6 shadow-2xl animate-in zoom-in-95 my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-default)]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                {t('draft_title')}
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                {t('draft_sub')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Email Output Language Switch */}
            <div
              className="flex items-center bg-[var(--bg-surface)] rounded-lg p-0.5 border border-[var(--border-default)]"
              role="group"
              aria-label={t('draft_lang_label')}
            >
              <button
                type="button"
                onClick={() => setEmailLanguage('en')}
                className={`px-2 py-0.5 text-[11px] font-bold rounded ${
                  emailLanguage === 'en'
                    ? 'bg-[var(--bg-raised)] text-[var(--text-primary)] shadow-2xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {t('draft_lang_en')}
              </button>
              <button
                type="button"
                onClick={() => setEmailLanguage('vi')}
                className={`px-2 py-0.5 text-[11px] font-bold rounded ${
                  emailLanguage === 'vi'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {t('draft_lang_vi')}
              </button>
            </div>

            <button
              onClick={onClose}
              aria-label={t('close')}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {/* Intent chips */}
          <div>
            <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
              {t('draft_purpose_label')}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {INTENT_CHIPS.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setIntent(chip.id)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                    intent === chip.id
                      ? 'bg-[var(--accent-fill)] text-white shadow-xs font-semibold'
                      : 'bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  {t(chip.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Form fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                {t('draft_teacher_label')}
              </label>
              <input
                type="text"
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                placeholder={t('draft_teacher_ph')}
                className="w-full px-3 py-2 text-xs bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl focus:outline-none focus:border-[var(--accent-fill)] text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                {t('draft_course_label')}
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t('draft_course_ph')}
                className="w-full px-3 py-2 text-xs bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl focus:outline-none focus:border-[var(--accent-fill)] text-[var(--text-primary)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
              {t('draft_context_label')}
            </label>
            <textarea
              rows={2}
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder={t('draft_context_ph')}
              className="w-full px-3 py-2 text-xs bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl focus:outline-none focus:border-[var(--accent-fill)] text-[var(--text-primary)]"
            />
          </div>

          {/* File attachments & Custom reference links */}
          <div className="space-y-3 p-3.5 bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-default)]">
            <h4 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5 text-[var(--accent-text)]" />
              <span>{t('draft_attachments_title')}</span>
            </h4>

            {/* Selected items badges */}
            {(selectedFiles.length > 0 || customLinks.length > 0) && (
              <div className="flex flex-wrap gap-1.5 pb-2 border-b border-[var(--border-default)]">
                {selectedFiles.map((file) => (
                  <span
                    key={file.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800"
                  >
                    <Paperclip className="w-3 h-3 text-blue-500" />
                    <span className="truncate max-w-[120px]">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedFiles(selectedFiles.filter((f) => f.id !== file.id))}
                      aria-label={t('draft_remove_item_aria', { name: file.name })}
                      className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-200 font-bold ml-1 cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))}

                {customLinks.map((link, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-lg border border-emerald-200 dark:border-emerald-800"
                  >
                    <Link className="w-3 h-3 text-emerald-500" />
                    <span className="truncate max-w-[120px]" title={link}>
                      {link.replace(/^https?:\/\//i, '')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCustomLinks(customLinks.filter((_, i) => i !== idx))}
                      aria-label={t('draft_remove_item_aria', { name: link })}
                      className="text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-200 font-bold ml-1 cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Google Drive Selection */}
              <div>
                <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
                  {t('draft_attach_drive')}
                </label>
                {recentFiles.length === 0 ? (
                  <span className="text-[10px] text-[var(--text-secondary)] block py-1.5">
                    {t('draft_no_drive_files')}
                  </span>
                ) : (
                  <div className="flex gap-1.5">
                    <select
                      value=""
                      aria-label={t('draft_attach_drive')}
                      onChange={(e) => {
                        const fileId = e.target.value;
                        if (!fileId) return;
                        const fileObj = recentFiles.find((f) => f.id === fileId);
                        if (fileObj && !selectedFiles.some((f) => f.id === fileId)) {
                          setSelectedFiles([...selectedFiles, fileObj]);
                        }
                        e.target.value = "";
                      }}
                      className="flex-1 px-2.5 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] cursor-pointer outline-none focus:ring-1 focus:ring-[var(--accent-fill)]/20 truncate"
                    >
                      <option value="">
                        {t('draft_choose_drive_file')}
                      </option>
                      {recentFiles.map((file) => (
                        <option key={file.id} value={file.id}>
                          {file.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Add Custom URL Link */}
              <div>
                <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
                  {t('draft_add_link_label')}
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="url"
                    value={newLinkText}
                    onChange={(e) => setNewLinkText(e.target.value)}
                    placeholder="https://..."
                    aria-label={t('draft_add_link_label')}
                    className="flex-1 px-2.5 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent-fill)]/20 outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newLinkText.trim() && !customLinks.includes(newLinkText.trim())) {
                          setCustomLinks([...customLinks, newLinkText.trim()]);
                          setNewLinkText('');
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    aria-label={t('draft_add_link_aria')}
                    onClick={() => {
                      if (newLinkText.trim() && !customLinks.includes(newLinkText.trim())) {
                        setCustomLinks([...customLinks, newLinkText.trim()]);
                        setNewLinkText('');
                      }
                    }}
                    className="px-2.5 py-1.5 bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-bold transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Tone Selector & Generate Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-secondary)] font-medium">{t('draft_tone_label')}</span>
              <select
                value={tone}
                aria-label={t('draft_tone_label')}
                onChange={(e) => setTone(e.target.value as any)}
                className="px-2.5 py-1 text-xs bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg text-[var(--text-primary)] font-medium"
              >
                <option value="polite_respectful">{t('draft_tone_polite')}</option>
                <option value="formal">{t('draft_tone_formal')}</option>
                <option value="brief">{t('draft_tone_brief')}</option>
              </select>
            </div>

            <button
              type="button"
              id="btn-generate-draft-submit"
              onClick={() => handleGenerate()}
              disabled={isGenerating || !teacherName.trim()}
              className="px-4 py-2 text-xs font-bold bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white rounded-xl shadow-xs inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{t('draft_drafting')}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t('draft_generate_btn')}</span>
                </>
              )}
            </button>
          </div>

          {/* Generated Result Output */}
          {generatedBody && (
            <div className="mt-4 p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                  <span>{t('draft_ready_title')}</span>
                </span>
                <span className="text-[10px] text-[var(--text-secondary)]">
                  {t('draft_ready_hint')}
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-0.5">
                  {t('draft_subject_label')}
                </label>
                <input
                  type="text"
                  value={generatedSubject}
                  onChange={(e) => setGeneratedSubject(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-medium bg-[var(--bg-raised)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-lg text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-0.5">
                  {t('draft_body_label')}
                </label>
                <textarea
                  rows={7}
                  value={generatedBody}
                  onChange={(e) => setGeneratedBody(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[var(--bg-raised)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-lg text-[var(--text-primary)] leading-relaxed font-sans"
                />
                <div className="flex items-center justify-end pt-1">
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    {t('draft_stats', { words: draftWordCount, chars: draftCharCount })}
                    {draftWordCount > 0 ? ` • ${t('draft_read_mins', { mins: draftReadMins })}` : ''}
                  </span>
                </div>
              </div>

              {/* Action buttons on generated draft */}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[var(--border-default)]">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 py-1.5 text-xs font-semibold bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] border border-[var(--border-default)] text-[var(--text-primary)] rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{t('common_copied')}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>{t('draft_copy_all')}</span>
                    </>
                  )}
                </button>

                {onSaveToGmailDrafts && (
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={isSavingDraft}
                    className="px-3 py-1.5 text-xs font-semibold bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-lg inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSavingDraft ? t('draft_saving_draft') : t('draft_save_gmail')}</span>
                  </button>
                )}

                <a
                  href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
                    teacherEmail
                  )}&su=${encodeURIComponent(generatedSubject)}&body=${encodeURIComponent(
                    generatedBody
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 text-xs font-semibold bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-lg inline-flex items-center gap-1.5 transition-colors"
                >
                  <span>{t('draft_open_gmail')}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

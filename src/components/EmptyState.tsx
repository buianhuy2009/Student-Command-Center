import React from 'react';
import { Calendar, CheckSquare, HardDrive, Inbox, Mail, BookOpen, CreditCard, Sparkles, Lightbulb } from 'lucide-react';
import { useT } from '../services/i18n';

export interface EmptyStateAction { label: string; onClick: () => void; primary?: boolean; }

export const EmptyState: React.FC<{
  icon?: any; title: string; description: string;
  actionLabel?: string; onAction?: () => void;
  actions?: EmptyStateAction[];
  illustration?: React.ReactNode;
  tip?: string;
}> = ({ icon: Icon = Inbox, title, description, actionLabel, onAction, actions, illustration, tip }) => {
  const resolved: EmptyStateAction[] = actions ?? (actionLabel && onAction ? [{ label: actionLabel, onClick: onAction, primary: true }] : []);
  return (
    <div className="w-full mx-auto py-10 sm:py-12 flex flex-col items-center justify-center text-center px-5 animate-in fade-in duration-200 text-[var(--text-primary)]">
      {illustration ?? (
        <div className="w-14 h-14 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-default)] flex items-center justify-center shadow-card transition-transform hover:scale-105">
          <Icon className="w-6 h-6 text-[var(--accent-text)]" aria-hidden="true" />
        </div>
      )}
      <h4 className="mt-4 text-base font-bold tracking-tight text-balance text-[var(--text-primary)]">{title}</h4>
      <p className="mt-1.5 text-xs max-w-sm leading-relaxed text-pretty text-[var(--text-secondary)]">{description}</p>
      {resolved.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
          {resolved.map((a, i) => (
            <button
              key={i}
              onClick={a.onClick}
              type="button"
              className={a.primary
                ? 'mt-1 px-4 py-2 text-white rounded-xl text-xs font-bold shadow-xs transition-colors bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 min-h-[44px] cursor-pointer'
                : 'mt-1 px-4 py-2 rounded-xl text-xs font-bold bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 min-h-[44px] cursor-pointer'}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
      {tip && (
        <p className="mt-3 text-[11px] max-w-xs leading-relaxed inline-flex items-start justify-center gap-1.5 text-center text-[var(--text-muted)]">
          <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-px text-[var(--accent-text)]" aria-hidden="true" />
          <span>{tip}</span>
        </p>
      )}
    </div>
  );
};

export const EmptyTodayEvents = (props: { onConnect?: () => void }) => {
  const { t } = useT();
  return (
    <EmptyState icon={Calendar} title={t('empty_events_t')} description={t('empty_events_d')}
      actions={props.onConnect ? [{ label: t('empty_events_connect'), onClick: props.onConnect, primary: true }] : [{ label: t('empty_events_plan'), onClick: () => {}, primary: true }]}
      tip={t('empty_events_tip')} />
  );
};

export const EmptyAssignments = (props: { onImportCanvas?: () => void; onParseSyllabus?: () => void; onCreate?: () => void } = {}) => {
  const { t } = useT();
  return (
    <EmptyState icon={CheckSquare} title={t('all_caught_up')} description={t('empty_assign_d')}
      actions={[
        ...(props.onImportCanvas ? [{ label: t('empty_assign_canvas'), onClick: props.onImportCanvas, primary: true }] : []),
        ...(props.onParseSyllabus ? [{ label: t('empty_assign_syllabus'), onClick: props.onParseSyllabus }] : []),
        ...(props.onCreate ? [{ label: t('empty_assign_create'), onClick: props.onCreate }] : []),
      ]}
      tip={t('empty_assign_tip')} />
  );
};

export const EmptyFiles = (props: { onConnect?: () => void } = {}) => {
  const { t } = useT();
  return (
    <EmptyState icon={HardDrive} title={t('empty_files_t')} description={t('empty_files_d')}
      actions={props.onConnect ? [{ label: t('drive_connect'), onClick: props.onConnect, primary: true }] : []} />
  );
};

export const EmptyEmails = (props: { onConnect?: () => void } = {}) => {
  const { t } = useT();
  return (
    <EmptyState icon={Mail} title={t('empty_emails_t')} description={t('empty_emails_d')}
      actions={props.onConnect ? [{ label: t('gmail_connect'), onClick: props.onConnect, primary: true }] : []} />
  );
};

export const EmptyFlashcards = (props: { onGenerate?: () => void; onImport?: () => void } = {}) => {
  const { t } = useT();
  return (
    <EmptyState icon={BookOpen} title={t('empty_cards_t')} description={t('empty_cards_d')}
      actions={[
        ...(props.onGenerate ? [{ label: t('empty_cards_gen'), onClick: props.onGenerate, primary: true }] : []),
        ...(props.onImport ? [{ label: t('empty_cards_import'), onClick: props.onImport }] : []),
      ]}
      tip={t('empty_cards_tip')} />
  );
};

export const EmptyScholarships = (props: { onBrowse?: () => void } = {}) => {
  const { t } = useT();
  return (
    <EmptyState icon={CreditCard} title={t('empty_schol_t')} description={t('empty_schol_d')}
      actions={props.onBrowse ? [{ label: t('empty_schol_add'), onClick: props.onBrowse, primary: true }] : []} />
  );
};

export const EmptySearch = () => {
  const { t } = useT();
  return (
    <EmptyState icon={Sparkles} title={t('keys_no_matches')} description={t('empty_search_d')}
      actions={[]} tip={t('empty_search_tip')} />
  );
};

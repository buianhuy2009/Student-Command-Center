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
    <div className="w-full mx-auto py-16 flex flex-col items-center justify-center text-center px-6 animate-in fade-in duration-200" style={{ color: 'var(--ink)' }}>
      {illustration ?? (
        <div className="w-16 h-16 rounded-2xl surface-token border border-token flex items-center justify-center shadow-xs transition-transform hover:scale-105" style={{ backgroundColor: 'var(--linen)', borderColor: 'var(--line)' }}>
          <Icon className="w-7 h-7 opacity-80" style={{ color: 'var(--terracotta)' }} aria-hidden="true" />
        </div>
      )}
      <h4 className="mt-4 text-base font-bold tracking-tight text-balance text-[#141413] dark:text-[#FAF9F5]">{title}</h4>
      <p className="mt-1 text-xs max-w-sm leading-relaxed text-pretty text-[#6B6860] dark:text-[#B5B2A8]" style={{ color: 'var(--stone)' }}>{description}</p>
      {resolved.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
          {resolved.map((a, i) => (
            <button
              key={i}
              onClick={a.onClick}
              type="button"
              className={a.primary
                ? 'mt-1 px-4 py-2 text-white rounded-xl text-xs font-bold shadow-xs transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 min-h-[44px] bg-[#D97757] hover:bg-[#C86A4B]'
                : 'mt-1 px-4 py-2 rounded-xl text-xs font-bold border border-[#E8E6E0] dark:border-[#2A2925] transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 min-h-[44px]'}
              style={a.primary ? { backgroundColor: '#D97757' } : { borderColor: 'var(--line)', color: 'var(--ink)' }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
      {tip && <p className="mt-3 text-[11px] max-w-xs leading-relaxed inline-flex items-start justify-center gap-1.5 text-center" style={{ color: 'var(--stone)' }}><Lightbulb className="w-3.5 h-3.5 shrink-0 mt-px opacity-70" aria-hidden="true" /><span className="opacity-80">{tip}</span></p>}
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

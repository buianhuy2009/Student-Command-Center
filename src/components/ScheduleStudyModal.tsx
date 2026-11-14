import React, { useState, useEffect } from 'react';
import {
  Clock,
  X,
  Check,
  RefreshCw,
} from 'lucide-react';
import { Assignment, CalendarEvent } from '../types';
import { useT } from '../services/i18n';

interface ScheduleStudyModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment?: Assignment | null;
  initialEvent?: Partial<CalendarEvent> | null;
  onSchedule: (eventData: {
    title: string;
    description: string;
    startDateTime: string;
    endDateTime: string;
    location?: string;
  }) => Promise<void>;
  isScheduling: boolean;
}

export const ScheduleStudyModal: React.FC<ScheduleStudyModalProps> = ({
  isOpen,
  onClose,
  assignment,
  initialEvent,
  onSchedule,
  isScheduling,
}) => {
  const { t } = useT();
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [sessionTime, setSessionTime] = useState('16:00');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [location, setLocation] = useState(() => t('sched_default_location'));
  const [sessionNotes, setSessionNotes] = useState('');

  const durationPresets = [25, 45, 60, 90] as const;

  useEffect(() => {
    const today = new Date();
    const defaultDate = today.toISOString().split('T')[0];
    setSessionDate(defaultDate);
    setLocation(t('sched_default_location'));

    if (assignment) {
      setSessionTitle(
        t('sched_default_session_title', {
          name: assignment.assignmentName,
          subject: assignment.subject,
        })
      );
      setSessionNotes(
        t('sched_default_notes', {
          name: assignment.assignmentName,
          priority: assignment.priority,
          dueDate: assignment.dueDate,
          notes: assignment.notes || '',
        })
      );
      if (assignment.dueDate) {
        const dueObj = new Date(assignment.dueDate + 'T00:00:00');
        const dayBefore = new Date(dueObj.getTime() - 86400000);
        if (dayBefore > today) {
          setSessionDate(dayBefore.toISOString().split('T')[0]);
        }
      }
    } else if (initialEvent) {
      setSessionTitle(initialEvent.summary || t('sched_default_block_title'));
      setSessionNotes(initialEvent.description || '');
      if (initialEvent.start?.dateTime) {
        const d = new Date(initialEvent.start.dateTime);
        setSessionDate(d.toISOString().split('T')[0]);
        setSessionTime(d.toTimeString().slice(0, 5));
      }
    } else {
      setSessionTitle(t('sched_default_45m_title'));
      setSessionNotes(t('sched_default_45m_notes'));
    }
  }, [assignment, initialEvent, isOpen, t]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionTitle.trim() || !sessionDate || !sessionTime) return;

    const [hours, minutes] = sessionTime.split(':').map(Number);
    const startObj = new Date(sessionDate);
    startObj.setHours(hours, minutes, 0, 0);

    const endObj = new Date(startObj.getTime() + durationMinutes * 60 * 1000);

    await onSchedule({
      title: sessionTitle.trim(),
      description: sessionNotes.trim(),
      startDateTime: startObj.toISOString(),
      endDateTime: endObj.toISOString(),
      location: location.trim() || undefined,
    });

    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      id="schedule-study-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[var(--bg-raised)] border border-[var(--border-default)] text-[var(--text-primary)] rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-default)]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)] flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                {t('sched_title')}
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                {t('sched_sub')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label={t('close')}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
              {t('sched_label_title')}
            </label>
            <input
              type="text"
              required
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl focus:outline-none focus:border-[var(--accent-fill)] text-[var(--text-primary)] font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                {t('sched_label_date')}
              </label>
              <input
                type="date"
                required
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                {t('sched_label_time')}
              </label>
              <input
                type="time"
                required
                value={sessionTime}
                onChange={(e) => setSessionTime(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                {t('sched_label_duration')}
              </label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] font-medium"
              >
                <option value={30}>{t('sched_dur_30')}</option>
                <option value={45}>{t('sched_dur_45')}</option>
                <option value={60}>{t('sched_dur_60')}</option>
                <option value={90}>{t('sched_dur_90')}</option>
              </select>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {durationPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDurationMinutes(preset)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-colors ${
                      durationMinutes === preset
                        ? 'bg-[var(--accent-fill)] text-white border-[var(--accent-fill)] shadow-xs'
                        : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-default)] hover:border-[var(--accent-border)] hover:text-[var(--accent-text)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                {t('sched_label_location')}
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={t('sched_location_ph')}
                className="w-full px-3 py-2 text-sm bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
              {t('sched_label_notes')}
            </label>
            <textarea
              rows={3}
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              placeholder={t('sched_notes_ph')}
              className="w-full px-3 py-2 text-xs bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl focus:outline-none focus:border-[var(--accent-fill)] text-[var(--text-primary)]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-default)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-xl"
            >
              {t('cancel')}
            </button>
            <button
              id="btn-confirm-schedule-calendar"
              type="submit"
              disabled={isScheduling || !sessionTitle.trim()}
              className="px-4 py-2 text-xs font-bold bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-colors"
            >
              {isScheduling ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{t('sched_adding')}</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{t('sched_submit')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

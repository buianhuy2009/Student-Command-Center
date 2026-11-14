import React, { useState } from 'react';
import {
  Sun,
  Target,
  Clock,
  X,
  ArrowRight,
  CloudRain,
  Frown,
  Meh,
  Smile,
  Flame,
} from 'lucide-react';
import { useT } from '../services/i18n';

interface MorningCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  onSaveIntention: (intention: string, targetHours: number, mood?: string) => void;
}

const MOOD_OPTIONS = [
  { value: 'struggling', labelKey: 'checkin_mood_struggling', Icon: CloudRain },
  { value: 'low', labelKey: 'checkin_mood_low', Icon: Frown },
  { value: 'okay', labelKey: 'checkin_mood_okay', Icon: Meh },
  { value: 'good', labelKey: 'checkin_mood_good', Icon: Smile },
  { value: 'fired-up', labelKey: 'checkin_mood_fired_up', Icon: Flame },
] as const;

export const MorningCheckInModal: React.FC<MorningCheckInModalProps> = ({
  isOpen,
  onClose,
  userName: _userName,
  onSaveIntention,
}) => {
  const { t } = useT();
  const [intention, setIntention] = useState('');
  const [targetHours, setTargetHours] = useState(3);
  const [mood, setMood] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!intention.trim()) return;
    onSaveIntention(intention.trim(), targetHours, mood ?? undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in select-none">
      <div className="bg-[var(--bg-raised)] text-[var(--text-primary)] w-full max-w-md rounded-3xl border border-[var(--border-default)] shadow-2xl p-6 space-y-5 flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-default)]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--status-warn-bg)] border border-[var(--status-warn-border)] text-[var(--status-warn-text)] flex items-center justify-center">
              <Sun className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[var(--text-primary)]">{t('checkin_title')}</h3>
              <p className="text-[10px] text-[var(--text-muted)]">{t('checkin_sub')}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label={t('close')}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-[var(--accent-text)]" />
              <span>{t('checkin_goal_label')}</span>
            </label>
            <input
              type="text"
              required
              value={intention}
              onChange={(e) => setIntention(e.target.value)}
              placeholder={t('checkin_goal_ph')}
              className="w-full px-3.5 py-2.5 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-fill)]"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[var(--accent-text)]" />
              <span>{t('checkin_hours_label')}</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((hours) => (
                <button
                  key={hours}
                  type="button"
                  onClick={() => setTargetHours(hours)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    targetHours === hours
                      ? 'bg-[var(--accent-fill)] text-white border-[var(--accent-fill)] shadow-xs'
                      : 'bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--accent-border)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  {hours === 1 ? t('checkin_hour_one', { hours }) : t('checkin_hour_other', { hours })}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5 flex items-center gap-1.5">
              <Smile className="w-3.5 h-3.5 text-[var(--accent-text)]" />
              <span>{t('checkin_mood_label')}</span>
            </label>
            <div className="grid grid-cols-5 gap-2">
              {MOOD_OPTIONS.map(({ value, labelKey, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMood(value)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center gap-1 ${
                    mood === value
                      ? 'bg-[var(--accent-fill)] text-white border-[var(--accent-fill)] shadow-xs'
                      : 'bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--accent-border)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[10px] leading-none">{t(labelKey)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={!intention.trim()}
              className="w-full py-2.5 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{t('checkin_submit')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

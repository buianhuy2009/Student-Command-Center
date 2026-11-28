import React, { useState } from 'react';
import { useT, type TranslationKey } from '../services/i18n';

export const MAX_GENERATED_CARDS = 50;

const PRESETS: readonly { value: number; labelKey: TranslationKey }[] = [
  { value: 5, labelKey: 'flashcards_count_5' },
  { value: 8, labelKey: 'flashcards_count_8' },
  { value: 12, labelKey: 'flashcards_count_12' },
  { value: 15, labelKey: 'flashcards_count_15' },
];

/** A whole number from 1 to the limit, or null. */
export function parseCardCount(raw: string): number | null {
  const n = Number(raw.trim());
  return Number.isInteger(n) && n >= 1 && n <= MAX_GENERATED_CARDS ? n : null;
}

interface FlashcardCountFieldProps {
  /** Last valid count. */
  count: number;
  /** What is in the custom box, which may be unfinished or out of range. */
  input: string;
  onChange: (count: number, input: string) => void;
}

const FIELD_CLASS =
  'w-full px-3 py-2 text-xs bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-fill)] text-[var(--text-primary)]';

export const FlashcardCountField: React.FC<FlashcardCountFieldProps> = ({ count, input, onChange }) => {
  const { t } = useT();
  const [isCustom, setIsCustom] = useState(() => !PRESETS.some((preset) => preset.value === count));

  return (
    <div>
      <label htmlFor="flashcard-count" className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
        {t('flashcards_count_label')}
      </label>
      <div className="flex gap-2">
        <select
          id="flashcard-count"
          value={isCustom ? 'custom' : count}
          onChange={(e) => {
            if (e.target.value === 'custom') {
              setIsCustom(true);
              onChange(count, String(count));
            } else {
              setIsCustom(false);
              onChange(Number(e.target.value), e.target.value);
            }
          }}
          className={FIELD_CLASS}
        >
          {PRESETS.map((preset) => (
            <option key={preset.value} value={preset.value}>
              {t(preset.labelKey)}
            </option>
          ))}
          <option value="custom">{t('flashcards_count_custom')}</option>
        </select>
        {isCustom && (
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_GENERATED_CARDS}
            step={1}
            value={input}
            onChange={(e) => onChange(parseCardCount(e.target.value) ?? count, e.target.value)}
            aria-label={t('flashcards_count_custom_aria', { max: MAX_GENERATED_CARDS })}
            className={`${FIELD_CLASS} !w-24`}
          />
        )}
      </div>
      {isCustom && (
        <p className={`mt-1 text-[11px] ${parseCardCount(input) === null ? 'text-[var(--status-err-text)]' : 'text-[var(--text-muted)]'}`}>
          {t('flashcards_count_custom_hint', { max: MAX_GENERATED_CARDS })}
        </p>
      )}
    </div>
  );
};

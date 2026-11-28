import React, { useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { testGeminiApiKeyDetailed } from '../services/gemini';
import { useT } from '../services/i18n';

const PROVIDERS = {
  gemini: {
    nameKey: 'ai_key_gemini_name',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    okKey: 'ai_key_gemini_verified',
    failKey: 'ai_key_gemini_failed',
    testingKey: 'ai_key_gemini_testing',
    test: testGeminiApiKeyDetailed,
  },
} as const;

interface AiKeyConnectionProps {
  provider: keyof typeof PROVIDERS;
  /** The key currently typed in the field, saved or not. */
  value: string;
  /** The key input itself. */
  children: React.ReactNode;
}

type TestState =
  | { status: 'idle' }
  | { status: 'testing'; key: string }
  | { status: 'ok'; key: string }
  | { status: 'failed'; key: string; error?: string };

/** One AI provider on the Connections tab: where to get a free key, and whether it works. */
export const AiKeyConnection: React.FC<AiKeyConnectionProps> = ({ provider, value, children }) => {
  const { t } = useT();
  const [result, setResult] = useState<TestState>({ status: 'idle' });
  const config = PROVIDERS[provider];
  const name = t(config.nameKey);
  // A result only describes the key it was run against.
  const current: TestState = result.status !== 'idle' && result.key === value ? result : { status: 'idle' };

  // Testing never saves: the Save button stays the only writer of stored keys.
  const handleTest = async () => {
    const key = value;
    setResult({ status: 'testing', key });
    const outcome = await config.test(key);
    setResult(outcome.ok ? { status: 'ok', key } : { status: 'failed', key, error: outcome.error });
  };

  return (
    <div className="space-y-1.5 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-[var(--text-secondary)]">{name}</span>
        <a
          href={config.keyUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`${t('settings_gemini_get_free')} (${name})`}
          className="text-[11px] text-[var(--accent-text)] hover:underline font-semibold inline-flex items-center gap-1"
        >
          <span>{t('settings_gemini_get_free')}</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      {children}
      <button
        type="button"
        onClick={handleTest}
        disabled={current.status === 'testing' || !value.trim()}
        aria-label={`${t('settings_gemini_test_btn')} (${name})`}
        className="px-3 py-1 bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-fill)] text-[var(--text-primary)] rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw className={`w-3 h-3 ${current.status === 'testing' ? 'animate-spin' : ''}`} />
        <span>{t('settings_gemini_test_btn')}</span>
      </button>
      <p
        role="status"
        className={`text-[11px] break-words ${
          current.status === 'ok'
            ? 'text-[var(--status-ok-text)]'
            : current.status === 'failed'
              ? 'text-[var(--status-err-text)]'
              : 'text-[var(--text-muted)]'
        }`}
      >
        {current.status === 'testing' && t(config.testingKey)}
        {current.status === 'ok' && t(config.okKey)}
        {current.status === 'failed' && (current.error || t(config.failKey))}
      </p>
    </div>
  );
};

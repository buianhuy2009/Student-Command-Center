import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  ExternalLink,
  RefreshCw,
  Globe,
  Copy,
  Check,
} from 'lucide-react';
import { fetchWikipediaSummary, WikipediaSummary } from '../services/publicApis';
import { useT } from '../services/i18n';

interface WikipediaLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

export const WikipediaLookupModal: React.FC<WikipediaLookupModalProps> = ({
  isOpen,
  onClose,
  initialQuery = '',
}) => {
  const { t } = useT();
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [summary, setSummary] = useState<WikipediaSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialQuery) {
        setSearchTerm(initialQuery);
        handleLookup(initialQuery);
      } else {
        setSearchTerm('');
        setSummary(null);
        setError(null);
      }
    }
  }, [isOpen, initialQuery]);

  const handleLookup = async (term: string) => {
    if (!term.trim()) return;
    setIsLoading(true);
    setError(null);
    setCopied(false);
    try {
      const data = await fetchWikipediaSummary(term);
      if (data) {
        setSummary(data);
      } else {
        setError(t('wiki_not_found', { term }));
      }
    } catch {
      setError(t('wiki_error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLookup(searchTerm);
  };

  const handleCopySummary = async () => {
    if (!summary) return;
    const text = [summary.displayTitle, summary.description, summary.extract]
      .filter(Boolean)
      .join('\n\n');
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error('clipboard unavailable');
      }
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        return;
      }
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in select-none">
      <div className="bg-[var(--bg-raised)] text-[var(--text-primary)] w-full max-w-lg rounded-3xl border border-[var(--border-default)] shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header & Search */}
        <div className="p-5 border-b border-[var(--border-default)] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-default)] flex items-center justify-center text-[var(--text-primary)]">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-[var(--text-primary)]">{t('wiki_title')}</h3>
                <p className="text-[10px] text-[var(--text-muted)]">{t('wiki_sub')}</p>
              </div>
            </div>

            <button
              onClick={onClose}
              aria-label={t('close')}
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('wiki_ph')}
                className="w-full pl-8 pr-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-fill)]"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !searchTerm.trim()}
              className="px-3.5 py-2 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              {t('wiki_lookup_btn')}
            </button>
          </form>
        </div>

        {/* Content Body */}
        <div className="p-5 max-h-96 overflow-y-auto space-y-4">
          {isLoading ? (
            <div className="py-12 text-center text-[var(--text-muted)] text-xs space-y-2">
              <RefreshCw className="w-6 h-6 text-[var(--accent-text)] animate-spin mx-auto opacity-70" />
              <p>{t('wiki_loading')}</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-[var(--status-warn-bg)] border border-[var(--status-warn-border)] rounded-2xl text-xs text-[var(--status-warn-text)]">
              {error}
            </div>
          ) : summary ? (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-start gap-4">
                {summary.thumbnailUrl && (
                  <img
                    src={summary.thumbnailUrl}
                    alt={summary.title}
                    className="w-20 h-20 object-cover rounded-2xl border border-[var(--border-default)] shrink-0"
                  />
                )}
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-bold text-[var(--text-primary)] leading-snug flex-1 min-w-0">
                      {summary.displayTitle}
                    </h4>
                    <button
                      onClick={handleCopySummary}
                      className="px-2.5 py-1 bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-border)] text-[var(--text-primary)] rounded-xl text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? t('common_copied') : t('common_copy')}</span>
                    </button>
                  </div>
                  {summary.description && (
                    <p className="text-xs text-[var(--accent-text)] font-medium">
                      {summary.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="p-3.5 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] text-xs text-[var(--text-secondary)] leading-relaxed">
                {summary.extract}
              </div>

              <div className="flex justify-end">
                <a
                  href={summary.pageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-border)] text-[var(--text-primary)] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <span>{t('wiki_read_full')}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-[var(--text-muted)] text-xs space-y-1">
              <Globe className="w-8 h-8 mx-auto opacity-30" />
              <p>{t('wiki_empty_hint')}</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

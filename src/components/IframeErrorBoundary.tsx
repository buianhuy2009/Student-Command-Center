import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ExternalLink,
  RefreshCw,
  Maximize2,
  Minimize2,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { useT } from '../services/i18n';

interface IframeErrorBoundaryProps {
  title: string;
  src: string;
  className?: string;
  allow?: string;
  sandbox?: string;
  allowFullscreen?: boolean;
  hideHeader?: boolean;
}

export const IframeErrorBoundary: React.FC<IframeErrorBoundaryProps> = ({
  title,
  src,
  className = '',
  // Embedded tools (Desmos, GeoGebra, Canva…) get no camera, mic, location, payment or USB access.
  allow = 'clipboard-read; clipboard-write; fullscreen',
  sandbox = 'allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts',
  allowFullscreen = true,
  hideHeader = false,
}) => {
  const { t } = useT();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsLoading(true);
    setHasError(false);

    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 12000);

    return () => clearTimeout(timer);
  }, [src, reloadKey]);

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isFullscreen]);

  const toggleFullscreen = useCallback(async () => {
    const next = !isFullscreen;
    setIsFullscreen(next);
    try {
      if (next && rootRef.current?.requestFullscreen) {
        await rootRef.current.requestFullscreen();
      } else if (!next && document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // CSS fixed inset-0 fallback still applies cleanly
    }
  }, [isFullscreen]);

  const handleReload = () => {
    setReloadKey((prev) => prev + 1);
    setIsLoading(true);
    setHasError(false);
  };

  return (
    <div
      ref={rootRef}
      className={`relative flex flex-col bg-[var(--bg-raised)] text-[var(--text-primary)] overflow-hidden transition-all ${
        isFullscreen
          ? 'fixed inset-0 z-[80] w-screen h-dvh rounded-none border-0 shadow-none'
          : `rounded-2xl border border-[var(--border-default)] shadow-xs flex-1 min-h-0 w-full h-full ${className}`
      }`}
    >
      {/* Top Utility Header Bar */}
      {!hideHeader && (
      <div className="h-10 px-4 bg-[var(--bg-surface)] border-b border-[var(--border-default)] flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-[var(--text-primary)] truncate">
            {title}
          </span>
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-[var(--text-muted)] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-default)]">
            <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
            {t('iframe_protected')}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleReload}
            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--accent-text)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors cursor-pointer"
            title={t('iframe_reload_title')}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[var(--accent-text)]' : ''}`} />
          </button>

          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--accent-text)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors flex items-center gap-1"
            title={t('iframe_open_tab_title')}
          >
            <span>{t('iframe_open_tab')}</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--accent-text)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors cursor-pointer"
            title={isFullscreen ? t('desm_exit') : t('iframe_fullscreen')}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      )}

      {/* Frame Container */}
      <div className="relative flex-1 w-full h-full min-h-0 bg-[var(--bg-canvas)] overflow-hidden">
        {/* Loading Spinner */}
        {isLoading && (
          <div className="absolute inset-0 bg-[var(--bg-canvas)]/90 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-10">
            <RefreshCw className="w-6 h-6 text-[var(--accent-text)] animate-spin" />
            <p className="text-xs text-[var(--text-muted)] font-medium">{t('iframe_connecting', { title })}</p>
          </div>
        )}

        {/* Error Fallback */}
        {hasError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[var(--bg-raised)]">
            <AlertCircle className="w-10 h-10 text-[var(--status-warn-border)] mb-2" />
            <h4 className="text-sm font-bold text-[var(--text-primary)]">
              {t('iframe_blocked_title')}
            </h4>
            <p className="text-xs text-[var(--text-muted)] max-w-sm mt-1">
              {t('iframe_blocked_desc')}
            </p>
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              className="mt-4 px-4 py-2 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <span>{t('iframe_open_external', { title })}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        ) : (
          <iframe
            key={reloadKey}
            src={src}
            title={title}
            allow={allow}
            sandbox={sandbox}
            allowFullScreen={allowFullscreen}
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
            className="w-full h-full border-0 absolute inset-0"
          />
        )}
      </div>
    </div>
  );
};

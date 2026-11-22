import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Focus, Maximize2, Minimize2, RefreshCw, PenTool, Trash2 } from 'lucide-react';
import { useT } from '../../services/i18n';
import '@excalidraw/excalidraw/index.css';

// Heavy canvas chunk loads on demand so the main bundle stays lean.
const Excalidraw = React.lazy(() =>
  import('@excalidraw/excalidraw').then((m) => ({ default: m.Excalidraw })),
);

type ExcalidrawProps = React.ComponentProps<typeof Excalidraw>;
// The package root does not re-export its prop types, so derive them from
// the component instead of importing type paths (which the exports map hides).
type ExcalidrawApi = NonNullable<Parameters<NonNullable<ExcalidrawProps['excalidrawAPI']>>[0]>;

const STORAGE_KEY = 'scc_excalidraw_scene_v1';
const MAX_BYTES = 2 * 1024 * 1024; // ~2MB cap for the autosaved scene
const SAVE_DELAY_MS = 1000;

function loadSavedScene(): ExcalidrawProps['initialData'] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return undefined;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return undefined;
    }
    return parsed as ExcalidrawProps['initialData'];
  } catch {
    return undefined;
  }
}

export const ExcalidrawWorkspace: React.FC = () => {
  const { t } = useT();
  const [reloadKey, setReloadKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const url = 'https://excalidraw.com';
  const apiRef = useRef<ExcalidrawApi | null>(null);
  const saveTimer = useRef<number | null>(null);

  // Restore once per mount so Reload (re-mount) picks up the latest save.
  const initialData = useMemo(() => loadSavedScene(), [reloadKey]);

  useEffect(() => {
    return () => {
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
    };
  }, []);

  const scheduleSave: NonNullable<ExcalidrawProps['onChange']> = (elements, appState) => {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
    }
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      try {
        const payload = JSON.stringify({ elements, appState });
        if (payload.length > MAX_BYTES) {
          return; // Drop oversized scenes instead of blowing quota.
        }
        try {
          localStorage.setItem(STORAGE_KEY, payload);
        } catch {
          try {
            localStorage.removeItem(STORAGE_KEY);
          } catch {
            // Storage unavailable — canvas still works in memory.
          }
        }
      } catch {
        // Scene not serializable — skip this save.
      }
    }, SAVE_DELAY_MS);
  };

  const handleClear = () => {
    if (!window.confirm(t('exca_clear_confirm'))) {
      return;
    }
    apiRef.current?.updateScene({ elements: [] });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore — canvas is already cleared in memory.
    }
  };

  const handleResetView = () => {
    apiRef.current?.scrollToContent();
  };

  return (
    <div className={`flex flex-col h-full w-full select-none ${isFullscreen ? 'fixed inset-0 z-50 bg-[var(--bg-canvas)] p-4' : ''}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border-default)] shrink-0 text-xs select-none">
        <div className="flex items-center gap-2">
          <PenTool className="w-4 h-4 text-[var(--accent-text)]" />
          <span className="font-bold text-[var(--text-primary)]">{t('exca_title')}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)] font-semibold">
            {t('exca_badge')}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="p-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-border)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors cursor-pointer"
            title={t('exca_reload')}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleResetView}
            className="p-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-border)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors cursor-pointer"
            title={t('exca_reset_view')}
          >
            <Focus className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleClear}
            className="p-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--status-err-border)] hover:bg-[var(--status-err-bg)] text-[var(--text-secondary)] transition-colors cursor-pointer"
            title={t('exca_clear_canvas')}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-border)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors cursor-pointer"
            title={isFullscreen ? t('desm_exit') : t('desm_expand')}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-border)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] font-bold flex items-center gap-1 transition-colors"
          >
            <span>{t('exca_open')}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Local Canvas */}
      <div key={reloadKey} className="flex-1 w-full min-h-[380px] sm:min-h-[520px] rounded-2xl overflow-hidden border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-xs">
        <div className="w-full h-full min-h-[380px] sm:min-h-[520px] excalidraw-wrapper">
          <Suspense
            fallback={
              <div className="w-full h-full min-h-[380px] sm:min-h-[520px] flex items-center justify-center gap-2 text-xs text-[var(--text-muted)] font-medium bg-[var(--bg-surface)]">
                <RefreshCw className="w-4 h-4 animate-spin text-[var(--accent-fill)]" />
                <span>{t('exca_loading')}</span>
              </div>
            }
          >
            <Excalidraw
              initialData={initialData}
              onChange={scheduleSave}
              excalidrawAPI={(api) => {
                apiRef.current = api;
              }}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
};

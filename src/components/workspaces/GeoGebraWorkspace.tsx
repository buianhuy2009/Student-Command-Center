import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, BarChart3, Box, Calculator, ExternalLink, Loader2, Maximize2, Minimize2, RefreshCw, Shapes, Sigma } from 'lucide-react';
import { t, useT } from '../../services/i18n';

type GeoTab = 'graphing' | 'geometry' | '3d' | 'cas' | 'probability';

/** Minimal typing for the official GeoGebra embed API (deployggb.js). No new deps. */
interface GGBAppletParams {
  appName: string;
  width?: number;
  height?: number;
  showToolBar?: boolean;
  showAlgebraInput?: boolean;
  showMenuBar?: boolean;
  enableFileFeatures?: boolean;
  appletOnLoad?: (api: unknown) => void;
  [key: string]: unknown;
}
interface GGBAppletInstance {
  inject: (containerId: string) => void;
}
interface GGBAppletConstructor {
  new (params: GGBAppletParams, noPreview?: boolean): GGBAppletInstance;
}
declare global {
  interface Window {
    GGBApplet?: GGBAppletConstructor;
  }
}

const DEPLOY_GGB_SRC = 'https://www.geogebra.org/apps/deployggb.js';
/** Last-resort iframe when the applet library itself cannot load. */
const FALLBACK_IFRAME_SRC = 'https://www.geogebra.org/calculator';
const APPLET_CONTAINER_ID = 'ggb-applet-container';
const APPLET_INIT_TIMEOUT_MS = 25000;
const IFRAME_LOAD_TIMEOUT_MS = 20000;

/**
 * Per-tab GGBApplet appName. `cas` is a standalone GeoGebra app; the
 * Probability Calculator has no dedicated appName so it uses `suite`,
 * which hosts the Probability perspective alongside the other tools.
 */
const GGB_APP_NAMES: Record<GeoTab, string> = {
  graphing: 'graphing',
  geometry: 'geometry',
  '3d': '3d',
  cas: 'cas',
  probability: 'suite',
};

const GEO_URLS: Record<GeoTab, string> = {
  graphing: 'https://www.geogebra.org/graphing',
  geometry: 'https://www.geogebra.org/geometry',
  '3d': 'https://www.geogebra.org/3d',
  cas: 'https://www.geogebra.org/cas',
  probability: 'https://www.geogebra.org/probability',
};

/** Loads deployggb.js exactly once; resets on failure so Retry can try again. */
let deployGgbPromise: Promise<void> | null = null;
function loadDeployGgb(): Promise<void> {
  if (typeof window !== 'undefined' && window.GGBApplet) return Promise.resolve();
  if (deployGgbPromise) return deployGgbPromise;
  deployGgbPromise = new Promise<void>((resolve, reject) => {
    const doc = window.document;
    let script = doc.querySelector<HTMLScriptElement>(`script[src="${DEPLOY_GGB_SRC}"]`);
    if (script && script.dataset.ggbFailed === '1') {
      script.remove();
      script = null;
    }
    if (!script) {
      const el = doc.createElement('script');
      el.src = DEPLOY_GGB_SRC;
      el.async = true;
      doc.head.appendChild(el);
      script = el;
    }
    if (window.GGBApplet) {
      resolve();
      return;
    }
    const target = script;
    const onLoad = () => {
      target.removeEventListener('load', onLoad);
      target.removeEventListener('error', onError);
      if (window.GGBApplet) resolve();
      else reject(new Error(t('geo_applet_unavailable')));
    };
    const onError = () => {
      target.removeEventListener('load', onLoad);
      target.removeEventListener('error', onError);
      target.dataset.ggbFailed = '1';
      reject(new Error(t('geo_applet_failed')));
    };
    target.addEventListener('load', onLoad);
    target.addEventListener('error', onError);
  });
  deployGgbPromise.then(undefined, () => {
    deployGgbPromise = null;
  });
  return deployGgbPromise;
}

type EmbedPhase = 'applet-loading' | 'applet-ready' | 'iframe' | 'error';

export const GeoGebraWorkspace: React.FC = () => {
  const { t } = useT();
  const [reloadKey, setReloadKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<GeoTab>('graphing');
  const [phase, setPhase] = useState<EmbedPhase>('applet-loading');
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const embedBoxRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const ggbApiRef = useRef<any>(null);
  const iframeLoadedRef = useRef(false);
  const url = GEO_URLS[activeTab];
  const GEO_LABELS: Record<GeoTab, string> = {
    graphing: t('geo_graphing'),
    geometry: t('geo_geometry'),
    '3d': '3D',
    cas: 'CAS',
    probability: t('geo_probability'),
  };

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) setIsFullscreen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false);
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
      if (next && wrapperRef.current?.requestFullscreen) {
        await wrapperRef.current.requestFullscreen();
      } else if (!next && document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {}
  }, [isFullscreen]);

  // Keep GeoGebra applet stretched to 100% of container width & height on resize/fullscreen
  useEffect(() => {
    const box = embedBoxRef.current;
    if (!box || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = Math.round(entry.contentRect.width);
      const h = Math.round(entry.contentRect.height);
      if (w > 100 && h > 100 && typeof ggbApiRef.current?.setSize === 'function') {
        try {
          ggbApiRef.current.setSize(w, h);
        } catch {}
      }
    });
    ro.observe(box);
    return () => ro.disconnect();
  }, [phase, isFullscreen]);

  const handleTabChange = (tab: GeoTab) => {
    setActiveTab(tab);
    setIframeLoaded(false);
    iframeLoadedRef.current = false;
    setPhase('applet-loading');
  };

  const handleRetry = () => {
    setIframeLoaded(false);
    iframeLoadedRef.current = false;
    setPhase('applet-loading');
    setReloadKey((k) => k + 1);
  };

  // Official embed: inject a GGBApplet for the active tab. Re-runs on tab
  // switch / reload. Any failure falls back to the calculator iframe.
  useEffect(() => {
    let cancelled = false;
    setPhase('applet-loading');
    setIframeLoaded(false);
    iframeLoadedRef.current = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) setPhase((prev) => (prev === 'applet-loading' ? 'iframe' : prev));
    }, APPLET_INIT_TIMEOUT_MS);
    loadDeployGgb().then(
      () => {
        if (cancelled) return;
        const GGB = window.GGBApplet;
        const host = containerRef.current;
        if (!GGB || !host) {
          window.clearTimeout(timer);
          setPhase('iframe');
          return;
        }
        host.innerHTML = '';
        ggbApiRef.current = null;
        const width = embedBoxRef.current?.clientWidth || host.clientWidth || 960;
        const height = embedBoxRef.current?.clientHeight || host.clientHeight || 640;
        try {
          const applet = new GGB(
            {
              appName: GGB_APP_NAMES[activeTab],
              width,
              height,
              showToolBar: true,
              showAlgebraInput: true,
              showMenuBar: true,
              enableFileFeatures: true,
              appletOnLoad: (api: any) => {
                if (!cancelled) {
                  ggbApiRef.current = api;
                  window.clearTimeout(timer);
                  setPhase('applet-ready');
                  const box = embedBoxRef.current;
                  if (box && typeof api?.setSize === 'function') {
                    try {
                      api.setSize(box.clientWidth, box.clientHeight);
                    } catch {}
                  }
                }
              },
            },
            true,
          );
          applet.inject(APPLET_CONTAINER_ID);
        } catch {
          if (!cancelled) {
            window.clearTimeout(timer);
            setPhase('iframe');
          }
        }
      },
      () => {
        if (!cancelled) {
          window.clearTimeout(timer);
          setPhase('iframe');
        }
      },
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeTab, reloadKey]);

  // Iframe fallback must also resolve: prolonged stall becomes the error card.
  useEffect(() => {
    if (phase !== 'iframe') return;
    const timer = window.setTimeout(() => {
      if (!iframeLoadedRef.current) setPhase('error');
    }, IFRAME_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [phase, activeTab, reloadKey]);

  const handleIframeLoad = () => {
    iframeLoadedRef.current = true;
    setIframeLoaded(true);
  };

  return (
    <div
      ref={wrapperRef}
      className={`flex flex-col flex-1 h-full w-full min-h-0 select-none ${
        isFullscreen ? 'fixed inset-0 z-[80] w-screen h-dvh bg-[var(--bg-canvas)] p-3 sm:p-4' : ''
      }`}
    >
      {/* Single Compact Top Bar: Tabs + Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-[var(--border-default)] shrink-0 text-xs select-none">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="font-bold text-[var(--text-primary)] whitespace-nowrap">
            GeoGebra · {GEO_LABELS[activeTab]}
          </span>
          <div className="flex items-center gap-1 p-1 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border-default)] overflow-x-auto">
            {([
              { id: 'graphing' as GeoTab, label: t('geo_graphing'), icon: Calculator },
              { id: 'geometry' as GeoTab, label: t('geo_geometry'), icon: Shapes },
              { id: '3d' as GeoTab, label: '3D', icon: Box },
              { id: 'cas' as GeoTab, label: 'CAS', icon: Sigma },
              { id: 'probability' as GeoTab, label: t('geo_probability'), icon: BarChart3 },
            ]).map(tab => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} type="button" onClick={() => handleTabChange(tab.id)} className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${activeTab === tab.id ? 'bg-[var(--accent-fill)] text-white shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'}`}>
                  <Icon className="w-3.5 h-3.5" /><span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRetry}
            className="p-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-border)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors cursor-pointer"
            title={t('geo_reload')}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-border)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors cursor-pointer"
            title={isFullscreen ? t('desm_exit') : t('desm_expand')}
            aria-label={isFullscreen ? t('desm_exit') : t('desm_expand')}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-border)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] font-bold flex items-center gap-1 transition-colors"
          >
            <span>{t('geo_open_tab')}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Full-Bleed Embed */}
      <div ref={embedBoxRef} key={`${activeTab}-${reloadKey}`} className="flex-1 w-full h-full min-h-0 rounded-2xl overflow-hidden border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-xs">
        {(phase === 'applet-loading' || phase === 'applet-ready') && (
          <div className="relative w-full h-full min-h-0">
            {phase === 'applet-loading' && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[var(--bg-surface)]">
                <Loader2 className="w-6 h-6 text-[var(--accent-fill)] animate-spin" />
                <p className="text-xs text-[var(--text-muted)] font-medium">{t('geo_loading', { tool: GEO_LABELS[activeTab] })}</p>
              </div>
            )}
            <div id={APPLET_CONTAINER_ID} ref={containerRef} className="w-full h-full" />
          </div>
        )}

        {phase === 'iframe' && (
          <div className="relative w-full h-full min-h-0">
            {!iframeLoaded && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[var(--bg-surface)]">
                <Loader2 className="w-6 h-6 text-[var(--accent-fill)] animate-spin" />
                <p className="text-xs text-[var(--text-muted)] font-medium">{t('geo_loading', { tool: GEO_LABELS[activeTab] })}</p>
              </div>
            )}
            <iframe
              src={url || FALLBACK_IFRAME_SRC}
              title={t('geo_iframe_title')}
              onLoad={handleIframeLoad}
              onError={() => setPhase('error')}
              className="w-full h-full border-0"
              allowFullScreen
            />
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-col items-center justify-center p-6 text-center w-full h-full bg-[var(--bg-subtle)]">
            <AlertCircle className="w-10 h-10 text-[var(--status-warn-text)] mb-2" />
            <h4 className="text-sm font-bold text-[var(--text-primary)]">
              {t('geo_load_error_title')}
            </h4>
            <p className="text-xs text-[var(--text-muted)] max-w-sm mt-1">
              {t('geo_load_error_sub')}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-[var(--accent-fill)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{t('geo_reload')}</span>
              </button>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-border)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <span>{t('geo_open_tab')}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

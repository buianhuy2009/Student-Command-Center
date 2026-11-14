import React, { useState } from 'react';
import { ExternalLink, Maximize2, Minimize2, RefreshCw } from 'lucide-react';
import { IframeErrorBoundary } from '../IframeErrorBoundary';
import { useT } from '../../services/i18n';

interface DesmosWorkspaceProps {
  mode?: 'graphing' | 'scientific' | 'geometry' | '3d';
}

export const DesmosWorkspace: React.FC<DesmosWorkspaceProps> = ({ mode = 'graphing' }) => {
  const { t } = useT();
  const [reloadKey, setReloadKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const url =
    mode === 'scientific'
      ? 'https://www.desmos.com/scientific'
      : mode === 'geometry'
      ? 'https://www.desmos.com/geometry'
      : mode === '3d'
      ? 'https://www.desmos.com/3d'
      : 'https://www.desmos.com/calculator';

  const title =
    mode === 'scientific'
      ? t('desm_title_scientific')
      : mode === 'geometry'
      ? t('desm_title_geometry')
      : mode === '3d'
      ? t('desm_title_3d')
      : t('desm_title_graphing');

  return (
    <div className={`flex flex-col h-full w-full select-none ${isFullscreen ? 'fixed inset-0 z-50 bg-[var(--bg-canvas)] p-4' : ''}`}>
      {/* Sleek Minimal Toolbar */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border-default)] shrink-0 text-xs select-none">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[var(--text-primary)]">{title}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--status-ok-bg)] text-[var(--status-ok-text)] border border-[var(--status-ok-border)] font-semibold">
            {t('desm_live')}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="p-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-border)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors cursor-pointer"
            title={t('desm_reload')}
          >
            <RefreshCw className="w-3.5 h-3.5" />
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
            <span>{t('desm_open_tab')}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Full-Bleed Embed Canvas */}
      <div key={reloadKey} className="flex-1 w-full min-h-[550px] rounded-2xl overflow-hidden border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-xs">
        <IframeErrorBoundary
          title={title}
          src={url}
          className="w-full h-full border-0 min-h-[550px]"
        />
      </div>
    </div>
  );
};

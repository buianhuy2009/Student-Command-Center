import React, { useState, useEffect } from 'react';
import {
  ExternalLink,
  RefreshCw,
  Maximize2,
  Minimize2,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';

interface IframeErrorBoundaryProps {
  title: string;
  src: string;
  className?: string;
  allow?: string;
  sandbox?: string;
  allowFullscreen?: boolean;
}

export const IframeErrorBoundary: React.FC<IframeErrorBoundaryProps> = ({
  title,
  src,
  className = '',
  // Embedded tools (Desmos, GeoGebra, Canva…) get no camera, mic, location, payment or USB access.
  allow = 'clipboard-read; clipboard-write; fullscreen',
  sandbox = 'allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts',
  allowFullscreen = true,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setIsLoading(true);
    setHasError(false);

    // Fallback timer: if iframe does not fire onLoad after 12s, check if user needs external link
    const timer = setTimeout(() => {
      // If still loading after 12 seconds, display helper fallback
      if (isLoading) {
        setIsLoading(false);
      }
    }, 12000);

    return () => clearTimeout(timer);
  }, [src, reloadKey]);

  const handleReload = () => {
    setReloadKey((prev) => prev + 1);
    setIsLoading(true);
    setHasError(false);
  };

  return (
    <div
      className={`relative flex flex-col bg-white dark:bg-[#1A1917] rounded-2xl border border-[#DFDACB] dark:border-[#2C2B27] shadow-xs overflow-hidden transition-all ${
        isFullscreen ? 'fixed inset-4 z-50 shadow-2xl' : className
      }`}
    >
      {/* Top Utility Header Bar */}
      <div className="h-10 px-4 bg-[#FAF9F5] dark:bg-[#1F1E1B] border-b border-[#DFDACB] dark:border-[#2C2B27] flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-[#141413] dark:text-[#FAF9F5] truncate">
            {title}
          </span>
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-[#8C897F] font-mono px-1.5 py-0.5 rounded bg-white dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27]">
            <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
            Sandbox Active
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleReload}
            className="p-1.5 text-[#5C5A54] dark:text-[#B5B2A8] hover:text-[#D97757] hover:bg-[#EFECE2] dark:hover:bg-[#2C2A26] rounded-lg transition-colors cursor-pointer"
            title="Reload Frame"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#D97757]' : ''}`} />
          </button>

          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="px-2.5 py-1 text-[11px] font-semibold text-[#5C5A54] dark:text-[#B5B2A8] hover:text-[#D97757] hover:bg-[#EFECE2] dark:hover:bg-[#2C2A26] rounded-lg transition-colors flex items-center gap-1"
            title="Open in New Tab"
          >
            <span>Open in Tab</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 text-[#5C5A54] dark:text-[#B5B2A8] hover:text-[#D97757] hover:bg-[#EFECE2] dark:hover:bg-[#2C2A26] rounded-lg transition-colors cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Frame Container */}
      <div className="relative flex-1 w-full h-full min-h-[450px] bg-slate-50 dark:bg-[#141413] overflow-hidden">
        {/* Loading Spinner */}
        {isLoading && (
          <div className="absolute inset-0 bg-[#FAF9F5]/90 dark:bg-[#141413]/90 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-10">
            <RefreshCw className="w-6 h-6 text-[#D97757] animate-spin" />
            <p className="text-xs text-[#8C897F] font-medium">Connecting to {title}...</p>
          </div>
        )}

        {/* Error Fallback */}
        {hasError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#FAF9F5] dark:bg-[#1F1E1B]">
            <AlertCircle className="w-10 h-10 text-amber-500 mb-2" />
            <h4 className="text-sm font-bold text-[#141413] dark:text-[#FAF9F5]">
              Unable to Display Embedded View
            </h4>
            <p className="text-xs text-[#8C897F] max-w-sm mt-1">
              Your browser or school firewall restricts embedding this service via iframe.
            </p>
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              className="mt-4 px-4 py-2 bg-[#D97757] hover:bg-[#C86646] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <span>Open {title} in New Tab</span>
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

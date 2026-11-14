import React from 'react';
import { Sidebar } from '../components/Sidebar';
import { Navbar } from '../components/Navbar';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useT } from '../services/i18n';

export interface ShellProps {
  sidebarProps: React.ComponentProps<typeof Sidebar>;
  navbarProps: React.ComponentProps<typeof Navbar> & { hidden?: boolean };
  isZen: boolean;
  mobileNavOpen?: boolean;
  onMobileNavChange?: (open: boolean) => void;
  topBanner?: React.ReactNode;
  subBanner?: React.ReactNode;
  fullScreenView?: React.ReactNode;
  children: React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({
  sidebarProps,
  navbarProps,
  isZen,
  mobileNavOpen = false,
  onMobileNavChange,
  topBanner,
  subBanner,
  fullScreenView,
  children,
}) => {
  const { t } = useT();
  const { hidden, ...navRest } = navbarProps;

  return (
    <div className="h-screen max-h-screen overflow-hidden bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col font-sans selection:bg-[var(--accent-fill)] selection:text-white">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] bg-[var(--accent-fill)] text-white px-3 py-1.5 rounded-lg text-xs font-bold border border-[var(--border-strong)]"
      >
        {t('shell_skip_to_content')}
      </a>

      {topBanner}

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Persistent Desktop Navigation Rail — never hidden on dashboard */}
        {!isZen && (
          <div className="hidden md:flex shrink-0">
            <Sidebar {...sidebarProps} />
          </div>
        )}

        {/* Mobile Drawer Overlay */}
        {!isZen && mobileNavOpen && (
          <div
            className="md:hidden fixed inset-0 z-40 flex"
            onTouchStart={(e) => {
              (e.currentTarget as any)._sx = e.touches[0].clientX;
            }}
            onTouchEnd={(e) => {
              const sx = (e.currentTarget as any)._sx || 0;
              const dx = e.changedTouches[0].clientX - sx;
              if (dx < -60 || dx > 60) onMobileNavChange?.(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onMobileNavChange?.(false);
            }}
          >
            <div className="w-60 shrink-0 bg-[var(--bg-subtle)] border-r border-[var(--border-default)] overflow-y-auto">
              <Sidebar
                {...sidebarProps}
                isExpanded={true}
                onToggleExpand={() => onMobileNavChange?.(false)}
                onSelectTab={(tab) => {
                  sidebarProps.onSelectTab(tab);
                  onMobileNavChange?.(false);
                }}
              />
            </div>
            <button
              type="button"
              className="flex-1 bg-black/45 backdrop-blur-xs cursor-pointer"
              onClick={() => onMobileNavChange?.(false)}
              aria-label={t('app_close_nav_aria')}
            />
          </div>
        )}

        {/* Right Main Column */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[var(--bg-canvas)]">
          {!hidden && !isZen && (
            <ErrorBoundary
              fallback={
                <header className="h-12 bg-[var(--bg-surface)] border-b border-[var(--border-default)] px-4 sm:px-6 flex items-center justify-between z-20 text-xs font-semibold text-[var(--text-muted)]">
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('scc-navigate', { detail: 'dashboard' }))}
                    className="hover:text-[var(--accent-text)] cursor-pointer"
                  >
                    {t('app_nav_fallback')}
                  </button>
                </header>
              }
            >
              <Navbar
                {...navRest}
                mobileNavOpen={mobileNavOpen}
                onToggleMobileNav={onMobileNavChange ? () => onMobileNavChange(!mobileNavOpen) : undefined}
              />
            </ErrorBoundary>
          )}

          {subBanner}

          {fullScreenView ? (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {fullScreenView}
            </div>
          ) : (
            <main
              id="main-content"
              className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 min-h-0"
              aria-label={t('shell_content_aria')}
            >
              <ErrorBoundary
                fallback={
                  <div className="p-6 rounded-xl border border-[var(--status-err-border)] bg-[var(--status-err-bg)] text-[var(--status-err-text)] text-sm">
                    {t('shell_workspace_error')}
                  </div>
                }
              >
                {children}
              </ErrorBoundary>
            </main>
          )}
        </div>
      </div>
    </div>
  );
};

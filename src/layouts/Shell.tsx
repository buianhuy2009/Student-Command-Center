import React from 'react';
import { Sidebar } from '../components/Sidebar';
import { Navbar } from '../components/Navbar';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useT } from '../services/i18n';

interface ShellProps {
  sidebarProps: React.ComponentProps<typeof Sidebar>;
  navbarProps: React.ComponentProps<typeof Navbar> & { hidden?: boolean };
  isZen: boolean;
  children: React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({ sidebarProps, navbarProps, isZen, children }) => {
  const { t } = useT();
  const { hidden, ...navRest } = navbarProps as any;
  return (
    <div className="h-screen max-h-screen overflow-hidden bg-[#F5F4ED] dark:bg-[#141413] text-[#141413] dark:text-[#F5F4ED] flex flex-col font-sans selection:bg-[#C96442] selection:text-white">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-[#C96442] text-white px-3 py-1.5 rounded-xl text-xs font-bold z-[100]">{t('shell_skip_to_content')}</a>
      <div className="flex-1 flex overflow-hidden h-full" role="main">
        {!isZen && <div className="hidden md:flex shrink-0" role="navigation" aria-label={t('side_primary_nav')}><Sidebar {...sidebarProps} /></div>}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#E8E6DC] dark:bg-[#141413]">
          {!hidden && !isZen && <header aria-label={t('shell_toolbar_aria')}><Navbar {...navRest} /></header>}
          <main id="main-content" className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 min-h-0" aria-label={t('shell_content_aria')}>
            <ErrorBoundary fallback={<div className="p-6 rounded-2xl border border-rose-200 bg-rose-50 text-sm">{t('shell_workspace_error')}</div>}>
              {children}
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </div>
  );
};

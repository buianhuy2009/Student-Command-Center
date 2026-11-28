// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AccountSettingsModal, defaultShortcutSettings } from './AccountSettingsModal';
import { setLang } from '../services/i18n';

describe('account settings navigation', () => {
  it('has no Models & AI Keys tab and keeps Connections and Connected Apps', () => {
    setLang('en');
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(
      <AccountSettingsModal
        isOpen
        onClose={() => {}}
        user={null}
        onGoogleSignIn={() => {}}
        onLogout={() => {}}
        isLoggingIn={false}
        darkMode={false}
        setDarkMode={() => {}}
        onRefreshAll={() => {}}
        isRefreshing={false}
        sheetUrl={null}
        shortcutSettings={defaultShortcutSettings}
        setShortcutSettings={() => {}}
        reducedMotion={false}
        setReducedMotion={() => {}}
        highContrast={false}
        setHighContrast={() => {}}
      />,
    );
    const tabs = Array.from(host.querySelectorAll('nav button')).map((b) => b.textContent);
    expect(tabs).toContain('Connections');
    expect(tabs).toContain('Connected Apps');
    expect(tabs).not.toContain('Models & AI Keys');
  });
});

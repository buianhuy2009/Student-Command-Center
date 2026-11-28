// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GoogleToolConnections } from './GoogleToolConnections';
import { setLang } from '../services/i18n';

vi.mock('../services/googleAuth', () => ({
  hasFeatureAccess: (feature: string) => feature === 'gmail',
}));

const render = () => {
  const host = document.createElement('div');
  host.innerHTML = renderToStaticMarkup(<GoogleToolConnections onConnect={() => {}} />);
  return (tool: string) => host.querySelector(`[data-google-tool="${tool}"]`);
};

describe('google tool connections', () => {
  it('shows Not connected and a Connect Google button for each tool that is not connected', () => {
    setLang('en');
    const row = render();
    for (const tool of ['calendar', 'drive', 'sheets', 'classroom']) {
      expect(row(tool)?.textContent).toContain('Not connected');
      expect(row(tool)?.querySelector('button')?.textContent).toBe('Connect Google');
    }
  });

  it('shows Connected with no button for a connected tool', () => {
    setLang('en');
    const row = render();
    expect(row('gmail')?.textContent).toContain('Connected');
    expect(row('gmail')?.textContent).not.toContain('Not connected');
    expect(row('gmail')?.querySelector('button')).toBeNull();
  });
});

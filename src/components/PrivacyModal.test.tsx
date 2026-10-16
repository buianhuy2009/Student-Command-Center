// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PrivacyModal } from './PrivacyModal';
import { setLang } from '../services/i18n';
import { CORE_WORKSPACE_SCOPES, WORKSPACE_SCOPES } from '../services/firebase';

describe('privacy page', () => {
  it('explains every scope the app actually requests, in Vietnamese', () => {
    setLang('vi');
    const html = renderToStaticMarkup(<PrivacyModal onClose={() => {}} onRevoke={() => {}} onDeleteAll={async () => {}} />);
    for (const scope of WORKSPACE_SCOPES) expect(html).toContain(scope.split('/auth/')[1]);
    expect(WORKSPACE_SCOPES.length).toBe(6);
    expect(CORE_WORKSPACE_SCOPES.some((s) => s.includes('gmail'))).toBe(false);
    expect(html).toContain('Dành cho phụ huynh');
    expect(html).toContain('Gemini');
  });
});

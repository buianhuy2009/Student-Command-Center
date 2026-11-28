// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { PrivacyModal } from './PrivacyModal';
import { setLang } from '../services/i18n';
import { CORE_WORKSPACE_SCOPES, WORKSPACE_SCOPES, setStoredGoogleToken } from '../services/firebase';
import { recordGrantedScopes } from '../services/googleAuth';
import { getPrivacyPrefs, updatePrivacyPrefs } from '../services/privacyPrefs';

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

describe('privacy page', () => {
  beforeEach(() => {
    window.localStorage.clear();
    updatePrivacyPrefs({ shareAcademicContextWithTutor: true });
  });

  it('explains every scope the app actually requests, in Vietnamese', () => {
    setLang('vi');
    const html = renderToStaticMarkup(<PrivacyModal onClose={() => {}} onRevoke={() => {}} onDeleteAll={async () => {}} />);
    for (const scope of WORKSPACE_SCOPES) expect(html).toContain(scope.split('/auth/')[1]);
    expect(WORKSPACE_SCOPES.length).toBe(6);
    expect(CORE_WORKSPACE_SCOPES.some((s) => s.includes('gmail'))).toBe(false);
    expect(html).toContain('Dành cho phụ huynh');
    expect(html).toContain('Gemini');
    expect(html).toContain('Đăng nhập Google cơ bản');
    expect(html).not.toContain('refresh token');
    expect(html).not.toContain('Firebase');
    expect(EMOJI_RE.test(html)).toBe(false);
  });

  it('uses plain language in English, discloses drive.readonly opt-in, and renders zero emojis', () => {
    setLang('en');
    const html = renderToStaticMarkup(<PrivacyModal onClose={() => {}} onRevoke={() => {}} onDeleteAll={async () => {}} />);
    expect(html).toContain('Basic Google sign-in');
    expect(html).toContain('Technical details');
    expect(html).toContain('drive.readonly');
    expect(html).toContain('Optional 7th Escalation Scope');
    expect(html).toContain('Always Enforced');
    expect(html).not.toContain('refresh token');
    expect(html).not.toContain('Firebase');
    expect(EMOJI_RE.test(html)).toBe(false);
  });

  it('shows live Granted and Not connected status badges and updates on scope events', () => {
    setLang('en');
    setStoredGoogleToken('test-access-token', 3600, ['https://www.googleapis.com/auth/calendar.events'], 'uid-1');
    recordGrantedScopes(['https://www.googleapis.com/auth/calendar.events'], 'uid-1');

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <PrivacyModal
          userUid="uid-1"
          userEmail="student@school.edu"
          onClose={() => {}}
          onRevoke={() => {}}
          onDeleteAll={async () => {}}
        />
      );
    });

    expect(container.textContent).toContain('Granted');
    expect(container.textContent).toContain('Not connected');

    act(() => {
      recordGrantedScopes(['https://www.googleapis.com/auth/gmail.readonly'], 'uid-1');
    });
    expect(container.textContent).toContain('Manage on Google');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('updates privacyPrefs when interactive AI toggles are clicked', () => {
    setLang('en');
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <PrivacyModal
          initialTab="ai"
          onClose={() => {}}
          onRevoke={() => {}}
          onDeleteAll={async () => {}}
        />
      );
    });

    const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect(checkboxes.length).toBe(1);
    expect(checkboxes[0].checked).toBe(true);

    act(() => {
      checkboxes[0].click();
    });

    expect(getPrivacyPrefs().shareAcademicContextWithTutor).toBe(false);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});

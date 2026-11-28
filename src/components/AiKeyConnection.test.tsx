// @vitest-environment jsdom
import React, { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';

const { gemini, groq } = vi.hoisted(() => ({ gemini: vi.fn(), groq: vi.fn() }));
vi.mock('../services/gemini', () => ({ testGeminiApiKeyDetailed: gemini, testGroqApiKeyDetailed: groq }));

import { AiKeyConnection } from './AiKeyConnection';
import { setLang } from '../services/i18n';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('AI key connection row', () => {
  let root: Root | null = null;
  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    localStorage.clear();
  });

  it('offers a free key link and a connection test for each provider', () => {
    setLang('en');
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(
      <>
        <AiKeyConnection provider="gemini" value="abc"><input /></AiKeyConnection>
        <AiKeyConnection provider="groq" value=""><input /></AiKeyConnection>
      </>,
    );
    const links = Array.from(host.querySelectorAll('a'));
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      'https://aistudio.google.com/app/apikey',
      'https://console.groq.com/keys',
    ]);
    expect(links.every((a) => a.textContent === 'Get Free Key')).toBe(true);
    const buttons = Array.from(host.querySelectorAll('button'));
    expect(buttons.map((b) => b.textContent)).toEqual(['Test Connection', 'Test Connection']);
    expect(buttons.map((b) => b.disabled)).toEqual([false, true]);
  });

  it('reports the real result of a test without saving the key, and drops it when the key changes', async () => {
    setLang('en');
    gemini.mockResolvedValueOnce({ ok: true });
    groq.mockResolvedValueOnce({ ok: false, error: 'Key rejected by Groq' });
    const host = document.createElement('div');
    root = createRoot(host);
    const view = (geminiKey: string) => (
      <>
        <AiKeyConnection provider="gemini" value={geminiKey}><input /></AiKeyConnection>
        <AiKeyConnection provider="groq" value="typed-groq"><input /></AiKeyConnection>
      </>
    );
    act(() => root!.render(view('typed-gemini')));
    await act(async () => {
      host.querySelectorAll('button').forEach((button) => button.click());
    });
    const statuses = () => Array.from(host.querySelectorAll('[role="status"]')).map((p) => p.textContent);
    expect(gemini).toHaveBeenCalledWith('typed-gemini');
    expect(groq).toHaveBeenCalledWith('typed-groq');
    expect(statuses()[0]).toContain('Connection verified');
    expect(statuses()[1]).toBe('Key rejected by Groq');
    expect(localStorage.getItem('scc_gemini_api_key')).toBeNull();
    expect(localStorage.getItem('scc_groq_api_key')).toBeNull();

    act(() => root!.render(view('edited-gemini')));
    expect(statuses()[0]).toBe('');
  });
});

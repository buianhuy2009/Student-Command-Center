// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot as createClientRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { setLang } from '../services/i18n';
import { LandingPage } from './LandingPage';
import { StudyAssistantChat } from './StudyAssistantChat';
import { GmailRadarTab } from './GmailRadarTab';
import { PhotoNoteScannerModal } from './PhotoNoteScannerModal';
import { OfflineAiStorageCard } from './OfflineAiStorageCard';

const FORBIDDEN_RE = /\b(Qwen|DBNet|PaddleOCR|VietOCR|TrOCR|ONNX|WebGPU|KV Cache)\b/i;

describe('StudentOS v3.0 UI suite', () => {
  it('renders LandingPage v3.0 highlights, integrations, and switches Hero Coach tab', () => {
    setLang('en');
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createClientRoot(container);
    act(() => {
      root.render(
        <LandingPage
          onSignIn={() => {}}
          onExploreDemo={() => {}}
          isLoggingIn={false}
          darkMode={false}
          setDarkMode={() => {}}
        />
      );
    });

    expect(container.textContent).toContain('On-Device Offline AI');
    expect(container.textContent).toContain('Photo Note Scanner');
    expect(container.textContent).toContain('Offline AI & Photo Note Scanner');

    const coachTab = Array.from(container.querySelectorAll('[role="tab"]')).find((el) =>
      el.textContent?.includes('Coach')
    ) as HTMLElement | undefined;
    expect(coachTab).toBeTruthy();
    act(() => {
      coachTab?.click();
    });
    expect(container.textContent).toContain('Offline AI runs privately on your device');
    expect(FORBIDDEN_RE.test(container.textContent || '')).toBe(false);

    act(() => root.unmount());
    container.remove();
  });

  it('switches StudyAssistantChat to Offline AI and displays Quick/Deeper levels + honest warning in EN and VI', () => {
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
    localStorage.removeItem('scc_ai_coach_mode_v1');
    setLang('en');
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createClientRoot(container);
    act(() => {
      root.render(
        <StudyAssistantChat
          isOpen={true}
          onClose={() => {}}
          assignments={[]}
          events={[]}
          alerts={[]}
          isFullScreen={true}
        />
      );
    });

    expect(container.textContent).toContain('Auto');
    expect(container.textContent).toContain('Professor');
    expect(container.textContent).toContain('Offline AI');

    const offlineBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Offline AI')
    );
    expect(offlineBtn).toBeTruthy();
    act(() => {
      offlineBtn?.click();
    });

    expect(container.textContent).toContain('Quick (~1 GB RAM)');
    expect(container.textContent).toContain('Deeper (~2 GB RAM)');
    expect(container.textContent).toContain('much less smart than Online AI');
    expect(FORBIDDEN_RE.test(container.textContent || '')).toBe(false);

    act(() => {
      setLang('vi');
    });
    expect(container.textContent).toContain('AI Ngoại tuyến');
    expect(container.textContent).toContain('kém thông minh hơn Online AI rất nhiều'.toLowerCase().slice(0, 10));
    expect(FORBIDDEN_RE.test(container.textContent || '')).toBe(false);

    act(() => root.unmount());
    container.remove();
  });

  it('renders GmailRadarTab Online/Offline toggle and countable progress bar', () => {
    setLang('en');
    const html = renderToStaticMarkup(
      <GmailRadarTab
        emailAlerts={[]}
        rawEmails={[]}
        isLoadingEmails={true}
        emailLoadStage="analyzing"
        emailAiMode="offline"
        emailSortProgress={{ completed: 4, total: 15, stage: 'sorting' }}
        onCancelEmailSort={() => {}}
        onRefreshEmails={() => {}}
        onOpenQuickDraft={() => {}}
        onExtractAssignment={() => {}}
      />
    );
    expect(html).toContain('Online AI');
    expect(html).toContain('Offline AI (On Device)');
    expect(html).toContain('Sorted 4 of 15 emails');
    expect(html).toContain('Cancel');
    expect(html).toContain('much less smart than Online AI');
    expect(FORBIDDEN_RE.test(html)).toBe(false);
  });

  it('renders PhotoNoteScannerModal 3 modes and OfflineAiStorageCard in EN and VI', () => {
    setLang('en');
    const ocrHtml = renderToStaticMarkup(
      <PhotoNoteScannerModal
        isOpen={true}
        onClose={() => {}}
        onInsertIntoNote={() => {}}
        onCreateNewNote={() => {}}
      />
    );
    expect(ocrHtml).toContain('Printed Text (EN + VI)');
    expect(ocrHtml).toContain('Vietnamese Handwriting');
    expect(ocrHtml).toContain('English Handwriting');
    expect(FORBIDDEN_RE.test(ocrHtml)).toBe(false);

    const storageHtml = renderToStaticMarkup(<OfflineAiStorageCard />);
    expect(storageHtml).toContain('Offline On-Device AI Storage');
    expect(storageHtml).toContain('Free RAM Now');
    expect(storageHtml).toContain('Delete Offline Models');
    expect(FORBIDDEN_RE.test(storageHtml)).toBe(false);

    setLang('vi');
    const ocrHtmlVi = renderToStaticMarkup(
      <PhotoNoteScannerModal
        isOpen={true}
        onClose={() => {}}
        onInsertIntoNote={() => {}}
        onCreateNewNote={() => {}}
      />
    );
    expect(ocrHtmlVi).toContain('Chữ in (Anh + Việt)');
    expect(ocrHtmlVi).toContain('Viết tay tiếng Việt');
    expect(ocrHtmlVi).toContain('Viết tay tiếng Anh');
    expect(FORBIDDEN_RE.test(ocrHtmlVi)).toBe(false);
  });
});

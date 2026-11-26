// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GmailRadarTab } from './GmailRadarTab';
import { setLang } from '../services/i18n';
import type { EmailAlert } from '../types';

const raw = { id: 'm1', sender: 'Thầy Tuấn', senderEmail: 'thaytuan.toan@gmail.com', subject: 'BTVN Toán', date: '', snippet: 'Các em làm bài 1-5 trang 32', labelIds: ['CATEGORY_PROMOTIONS'] };
const alerts: EmailAlert[] = [
  { id: 'm1', sender: 'Thầy Tuấn', subject: 'BTVN Toán', oneLineSummary: 'Làm bài 1-5', urgency: 'INFO', category: 'PROMOTION', aiStatus: 'skipped', needsReview: true, reviewReason: 'skipped_with_cue', rawEmail: raw },
  { id: 'm2', sender: 'Cô Lan', subject: 'Hoá', oneLineSummary: 'Nộp 18/9', urgency: 'HIGH', category: 'ASSIGNMENT', aiStatus: 'ok', detectedAssignment: { isAssignment: true, name: 'BT Hoá', subject: 'Hoá học', dueDate: '2026-09-18', priority: 'High', dueEvidence: 'trước 21h ngày 18/9' } },
];

describe('Gmail review box', () => {
  it('shows the "AI chưa đọc được" banner, the review tab and unconfirmed due chips', () => {
    setLang('vi');
    const html = renderToStaticMarkup(
      <GmailRadarTab emailAlerts={alerts} rawEmails={[raw]} isLoadingEmails={false} onRefreshEmails={() => {}} onOpenQuickDraft={() => {}} onExtractAssignment={() => {}} onForceAIRead={() => {}} />,
    );
    expect(html).toContain('AI chưa đọc được – bạn xem giúp nhé');
    expect(html).toContain('Cần bạn xem');
    expect(html).toContain('chưa xác nhận');
    expect(html).toContain('Mở thư gốc');
    // first alert is selected → review actions visible
    expect(html).toContain('Đây là bài tập');
    expect(html).toContain('Cho AI đọc thư này');
    expect(html).toContain('Đây là thầy cô');
  });

  it('surfaces explicit loading stage notice and cached-only warning when displaying saved emails', () => {
    setLang('en');
    const loadingHtml = renderToStaticMarkup(
      <GmailRadarTab
        emailAlerts={alerts}
        rawEmails={[raw]}
        isLoadingEmails={true}
        emailLoadStage="analyzing"
        onRefreshEmails={() => {}}
        onOpenQuickDraft={() => {}}
        onExtractAssignment={() => {}}
      />
    );
    expect(loadingHtml).toContain('AI is reading &amp; sorting your emails');

    const cachedHtml = renderToStaticMarkup(
      <GmailRadarTab
        emailAlerts={alerts}
        rawEmails={[raw]}
        isLoadingEmails={false}
        emailsLastSyncedAt="2026-10-18T10:00:00Z"
        emailsAreCachedOnly={true}
        onRefreshEmails={() => {}}
        onOpenQuickDraft={() => {}}
        onExtractAssignment={() => {}}
      />
    );
    expect(cachedHtml).toContain('Showing saved emails');
  });

  it('separates General from Promotions, shows accurate total counts, and renders Edit AI Details control', () => {
    setLang('en');
    const mixed: EmailAlert[] = [
      { id: 'g1', sender: 'School Admin', subject: 'Library hours', oneLineSummary: 'Open late', urgency: 'LOW', category: 'GENERAL', aiStatus: 'ok' },
      { id: 'p1', sender: 'Shop', subject: '50% off', oneLineSummary: 'Sale', urgency: 'INFO', category: 'PROMOTION', isSpam: true, aiStatus: 'ok' },
      { id: 'p2', sender: 'Newsletter', subject: 'Weekly digest', oneLineSummary: 'News', urgency: 'INFO', category: 'PROMOTION', isSpam: true, aiStatus: 'ok' },
    ];
    const html = renderToStaticMarkup(
      <GmailRadarTab
        emailAlerts={mixed}
        rawEmails={[]}
        isLoadingEmails={false}
        onRefreshEmails={() => {}}
        onOpenQuickDraft={() => {}}
        onExtractAssignment={() => {}}
      />
    );
    expect(html).toContain('General');
    expect(html).toContain('Promotions');
    expect(html).not.toContain('Other &amp; Promos');
    expect(html).toContain('Edit AI Details');
    expect(html).toContain('3 Messages');
  });
});

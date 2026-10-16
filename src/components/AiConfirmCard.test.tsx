// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AiConfirmCard } from './AiConfirmCard';
import { DueTrustBadge } from './DueTrustBadge';
import { setLang } from '../services/i18n';

const noop = () => {};

describe('AI confirm card', () => {
  it('says what the AI understood and asks "Đúng chưa?"', () => {
    setLang('vi');
    const html = renderToStaticMarkup(
      <AiConfirmCard
        draft={{ assignmentName: 'Bài tập chương 2', subject: 'Hoá học', dueDate: '2026-09-18', priority: 'High', dueConfidence: 'explicit', evidence: 'nộp trước 21h ngày 18/9', sourceLabel: 'Gmail · Cô Lan', sourceUrl: 'https://mail.google.com/mail/u/0/#all/x', origin: 'gmail' }}
        onSave={noop}
        onReject={noop}
        onClose={noop}
      />,
    );
    expect(html).toContain('AI hiểu là');
    expect(html).toContain('Hoá học');
    expect(html).toContain('18/9');
    expect(html).toContain('Thứ 6');
    expect(html).toContain('Đúng chưa?');
    expect(html).toContain('Mở thư gốc');
    expect(html).toContain('nộp trước 21h ngày 18/9');
  });

  it('warns instead of inventing a date', () => {
    setLang('vi');
    const html = renderToStaticMarkup(
      <AiConfirmCard
        draft={{ assignmentName: 'Đọc trước bài 5', subject: 'Ngữ văn', dueDate: '', priority: 'Med', dueConfidence: 'none', sourceLabel: 'Gmail', origin: 'gmail' }}
        onSave={noop}
        onReject={noop}
        onClose={noop}
      />,
    );
    expect(html).toContain('chưa rõ hạn');
    expect(html).toContain('AI không đọc được ngày nộp');
    expect(html).toContain('Lưu — chưa có hạn');
  });

  it('marks unconfirmed deadlines in the tracker', () => {
    setLang('vi');
    const html = renderToStaticMarkup(
      <DueTrustBadge assignment={{ id: '1', subject: 'Toán', assignmentName: 'x', dueDate: '2026-09-18', priority: 'Med', status: 'Not Started', dueStatus: 'unconfirmed' }} onConfirm={noop} />,
    );
    expect(html).toContain('Hạn chưa xác nhận');
  });
});

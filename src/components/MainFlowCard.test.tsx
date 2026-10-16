// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MainFlowCard } from './MainFlowCard';
import { setLang } from '../services/i18n';

describe('main flow card', () => {
  it('shows the four steps and counts what needs the student', () => {
    setLang('vi');
    const html = renderToStaticMarkup(
      <MainFlowCard
        assignments={[{ id: 'a', subject: 'Toán', assignmentName: 'BT 1', dueDate: '', priority: 'Med', status: 'Not Started', dueStatus: 'missing' }]}
        emailAlerts={[{ id: 'm1', sender: 'Cô Lan', subject: 'x', oneLineSummary: '', urgency: 'LOW', category: 'GENERAL', needsReview: true }]}
        onNavigate={() => {}}
        classroomCount={3}
      />,
    );
    for (const s of ['Luồng chính của bạn', 'Nguồn', 'Cần bạn xác nhận', 'Bài tập &amp; hạn nộp', 'Lịch học tuần', 'Classroom · 3', '1 thư AI chưa đọc được', '1 bài chưa có hạn']) {
      expect(html).toContain(s);
    }
  });
});

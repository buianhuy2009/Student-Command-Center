import { describe, expect, it } from 'vitest';
import { buildOfflineCoachSystemPrompt, isHomeworkDump } from './tutorPolicyClient';

describe('tutorPolicyClient', () => {
  it('detects Vietnamese and English homework dump requests', () => {
    expect(isHomeworkDump('Giải hộ em bài toán này với')).toBe(true);
    expect(isHomeworkDump('Just give me the answers to my homework')).toBe(true);
    expect(isHomeworkDump('Write my essay for me about climate change')).toBe(true);
    expect(isHomeworkDump('Bài 1: tính x. Bài 2: tính y. Bài 3: chứng minh.')).toBe(true);
    expect(isHomeworkDump('How should I plan 45 minutes for math tonight?')).toBe(false);
  });

  it('builds compact offline system prompt with reminder when dump detected', () => {
    const prompt = buildOfflineCoachSystemPrompt(
      {
        assignments: [
          { subject: 'Math', assignmentName: 'Problem Set 1', dueDate: '2026-11-25', status: 'Not Started' },
          { subject: 'Done', assignmentName: 'Old Task', dueDate: '2026-11-20', status: 'Done' },
        ],
      },
      'Giải hộ em bài này với'
    );
    expect(prompt).toContain('Problem Set 1');
    expect(prompt).not.toContain('Old Task');
    expect(prompt).toContain('hints only');
  });
});

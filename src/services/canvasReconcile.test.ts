import { describe, it, expect } from 'vitest';
import { reconcileCanvasAssignmentsWithTracker } from './canvas';
import type { Assignment, CanvasAssignment } from '../types';

describe('reconcileCanvasAssignmentsWithTracker', () => {
  it('auto-adds new unfinished Canvas homework with due dates and preserves manual/Gmail tasks', () => {
    const manual: Assignment = {
      id: 'manual-1',
      subject: 'History',
      assignmentName: 'Read Chapter 4',
      dueDate: '2026-11-28',
      priority: 'Med',
      status: 'Not Started',
      source: 'Manual',
    };
    const canvasItems: CanvasAssignment[] = [
      {
        id: 'c-101',
        name: 'Algebra Problem Set 5',
        courseName: 'AP Calculus',
        dueAt: '2026-11-25T23:59:00Z',
        pointsPossible: 40,
        htmlUrl: 'https://canvas.instructure.com/courses/1/assignments/101',
        isCompleted: false,
      },
      {
        id: 'c-102',
        name: 'Course Syllabus Overview',
        courseName: 'Physics',
        dueAt: '',
        isCompleted: false,
        isInformational: true,
      },
    ];

    const res = reconcileCanvasAssignmentsWithTracker({
      canvasItems,
      currentAssignments: [manual],
    });

    expect(res.added).toHaveLength(1);
    expect(res.added[0].assignmentName).toBe('Algebra Problem Set 5');
    expect(res.added[0].subject).toBe('AP Calculus');
    expect(res.added[0].dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.added[0].source).toBe('Canvas');
    expect(res.added[0].canvasId).toBe('c-101');
    expect(res.nextAssignments.map((a) => a.id)).toContain('manual-1');
    expect(res.nextAssignments).toHaveLength(2);
  });

  it('auto-removes Canvas assignments from Assignments & Due when marked finished on Canvas or locally', () => {
    const manual: Assignment = {
      id: 'manual-1',
      subject: 'English',
      assignmentName: 'Essay Outline',
      dueDate: '2026-11-27',
      priority: 'High',
      status: 'Not Started',
      source: 'Manual',
    };
    const syncedCanvas: Assignment = {
      id: 'canvas-sync-c-200',
      canvasId: 'c-200',
      subject: 'Biology',
      assignmentName: 'Lab Report 3',
      dueDate: '2026-11-24',
      priority: 'High',
      status: 'Not Started',
      source: 'Canvas',
    };
    const canvasItems: CanvasAssignment[] = [
      {
        id: 'c-200',
        name: 'Lab Report 3',
        courseName: 'Biology',
        dueAt: '2026-11-24',
        isCompleted: true,
      },
      {
        id: 'c-201',
        name: 'Quiz 4',
        courseName: 'Biology',
        dueAt: '2026-11-29',
        isCompleted: false,
      },
    ];

    const res = reconcileCanvasAssignmentsWithTracker({
      canvasItems,
      currentAssignments: [manual, syncedCanvas],
      completedCanvasIds: ['c-201'],
    });

    expect(res.removed.map((a) => a.id)).toEqual(['canvas-sync-c-200']);
    expect(res.added).toHaveLength(0);
    expect(res.nextAssignments.map((a) => a.id)).toEqual(['manual-1']);
  });

  it('updates Canvas due date when changed and respects dismissed Canvas IDs', () => {
    const existing: Assignment = {
      id: 'canvas-sync-c-300',
      canvasId: 'c-300',
      subject: 'Chemistry',
      assignmentName: 'Stoichiometry Sheet',
      dueDate: '2026-11-24',
      priority: 'Med',
      status: 'In Progress',
      source: 'Canvas',
    };
    const canvasItems: CanvasAssignment[] = [
      {
        id: 'c-300',
        name: 'Stoichiometry Sheet',
        courseName: 'Chemistry',
        dueAt: '2026-11-30',
        isCompleted: false,
      },
      {
        id: 'c-301',
        name: 'Dismissed Task',
        courseName: 'Chemistry',
        dueAt: '2026-11-29',
        isCompleted: false,
      },
    ];

    const res = reconcileCanvasAssignmentsWithTracker({
      canvasItems,
      currentAssignments: [existing],
      dismissedCanvasIds: ['c-301'],
    });

    expect(res.updatedCount).toBe(1);
    expect(res.nextAssignments[0].dueDate).toBe('2026-11-30');
    expect(res.added).toHaveLength(0);
  });
});

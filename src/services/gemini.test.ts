import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  repairJsonString,
  calculateGradePrediction,
  GEMINI_DEFAULT_MODEL,
  GEMINI_FALLBACK_MODEL,
  GEMINI_SAFETY_MODELS,
  sendStudyAssistantMessage,
  debugHandwrittenMath,
  vivaSimulatorTurn,
  socraticRubricPreCheck,
  deconstructAssignment,
  synthesizeFlashcards,
  deploySemesterFromSyllabus,
  generateInteractiveQuiz,
  summarizeEmailsWithGemini,
  partitionEmailsForAIScan,
  mergeScannedEmailAlerts,
  setClientGroqApiKey,
} from './gemini';
import { canMakeGeminiRequest, rateLimiter } from './gemini/rateLimiter';
import { streamAnswerWithSources } from './aiRouter';
import { crossReferenceCanvasWithSheet, loadCompletedCanvasIds, saveCompletedCanvasIds } from './canvas';
import {
  syncAllAssignmentsToSheet,
  findOrCreateMasterSpreadsheet,
  createGmailDraft,
  updateAssignmentInSheet,
  deleteAssignmentInSheet,
} from './googleWorkspace';
import { AMBIENT_TRACKS, ambientAudio } from './ambientAudio';
import { QUALITY_LABELS, calculateSM2, createNewSRSCard } from './srsEngine';

function createMemoryStorage(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
}

describe('repairJsonString', () => {
  it('parses clean JSON', () => {
    expect(repairJsonString('{"a":1}')).toEqual({ a: 1 });
  });
  it('strips markdown fences', () => {
    expect(repairJsonString('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it('slices braces', () => {
    expect(repairJsonString('extra {"a":1} trailing')).toEqual({ a: 1 });
  });
});

describe('crossReferenceCanvasWithSheet', () => {
  it('marks synced when name matches sheet', () => {
    const canvas = [{ id: '1', name: 'Essay', courseName: 'English', dueAt: '2026-09-10', isSynced: false } as any];
    const sheet = [{ id: 's1', assignmentName: 'Essay', subject: 'English', dueDate: '2026-09-10', priority: 'Med', status: 'Not Started' } as any];
    const res = crossReferenceCanvasWithSheet(canvas, sheet);
    expect(res[0].isSynced).toBe(true);
  });
});

describe('calculateGradePrediction', () => {
  it('calculates required final', () => {
    const r = calculateGradePrediction({ currentGrade: 84, desiredGrade: 90, finalExamWeight: 30 });
    expect(r.requiredFinalScore).toBeCloseTo(104, 0);
    expect(r.isPossible).toBe(false);
  });
  it('achievable', () => {
    const r = calculateGradePrediction({ currentGrade: 80, desiredGrade: 85, finalExamWeight: 30 });
    expect(r.status).toBeDefined();
  });
});

describe('Gemini models & anti-fallback hardening', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not reference TTS, retired, or unapproved Gemini models', () => {
    const models = [GEMINI_DEFAULT_MODEL, GEMINI_FALLBACK_MODEL, ...GEMINI_SAFETY_MODELS];
    expect(models).not.toContain('gemini-3.5-flash');
    expect(models).not.toContain('gemini-3.8-flash-tts');
    expect(models).not.toContain('gemini-3.8-flash-lite-tts');
    expect(models).not.toContain('gemini-flash-latest');
    expect(models).not.toContain('gemini-2.5-flash');
    expect(models).toContain('gemini-3-flash-preview');
    expect(models).toContain('gemini-3.1-flash-lite');
    expect(models).toContain('gemma-4-31b-it');
    expect(models).toContain('gemma-4-26b-a4b-it');
  });

  it('sendStudyAssistantMessage rejects HTML responses and empty replies', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        new Response('<!doctype html><html></html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        })
      )
    );
    await expect(sendStudyAssistantMessage([{ role: 'user', content: 'Hi' }])).rejects.toThrow(/non-JSON/i);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    );
    await expect(sendStudyAssistantMessage([{ role: 'user', content: 'Hi' }])).rejects.toThrow(/empty reply/i);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ reply: 'Check theorem 2 first.' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    );
    await expect(sendStudyAssistantMessage([{ role: 'user', content: 'Hi' }])).resolves.toBe('Check theorem 2 first.');
  });

  it('throws explicit errors instead of silent fake fallback outputs on unparseable AI JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () =>
        new Response(JSON.stringify({ text: 'corrupted non-json output' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    );

    await expect(debugHandwrittenMath('base64data')).rejects.toThrow(/math debugger/i);
    await expect(vivaSimulatorTurn({ subject: 'Physics', history: [], studentAnswer: 'F=ma' })).rejects.toThrow(/Oral defense/i);
    await expect(socraticRubricPreCheck({ draftText: 'Essay', rubricText: 'Rubric' })).rejects.toThrow(/Rubric/i);
    await expect(deconstructAssignment({ title: 'Lab' })).rejects.toThrow(/deconstruct assignment/i);
    await expect(synthesizeFlashcards('Notes')).rejects.toThrow(/flashcards/i);
    await expect(
      deploySemesterFromSyllabus({ courseName: 'CS101', instructor: 'Prof', confidence: 0.9, exams: [], keyAssignments: [] })
    ).rejects.toThrow(/deploy semester/i);
    await expect(generateInteractiveQuiz('Thermodynamics')).rejects.toThrow(/quiz/i);
  });

  it('rateLimiter tracks daily quota via canMakeGeminiRequest and exposes bucket status', async () => {
    const today = new Date().toISOString().slice(0, 10);
    vi.stubGlobal('localStorage', createMemoryStorage({ scc_gemini_daily_quota_v1: JSON.stringify({ date: today, count: 50 }) }));
    await expect(canMakeGeminiRequest()).resolves.toBe(false);
    vi.stubGlobal('localStorage', createMemoryStorage());
    await expect(canMakeGeminiRequest()).resolves.toBe(true);
    expect(rateLimiter.getStatus().maxTokens).toBe(15);
  });
});

describe('aiRouter streamAnswerWithSources', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls /api/gemini/generate and rejects HTML SPA fallback cleanly', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response('<html>SPA</html>', { status: 200, headers: { 'content-type': 'text/html' } })
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', createMemoryStorage());

    const onError = vi.fn();
    const onDone = vi.fn();
    await streamAnswerWithSources('Explain entropy', [], { callbacks: { onToken: vi.fn(), onDone, onError } });

    expect(fetchMock).toHaveBeenCalledWith('/api/gemini/generate', expect.any(Object));
    expect(onDone).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.stringMatching(/Unexpected response/i));
  });

  it('streams text and appends sources footer on valid JSON response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ text: 'Entropy measures disorder.' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    );
    let doneText = '';
    const onError = vi.fn();
    await streamAnswerWithSources('Explain entropy', [{ id: '1', label: 'Physics Ch 4', type: 'note' }], {
      callbacks: {
        onToken: vi.fn(),
        onDone: (full) => {
          doneText = full;
        },
        onError,
      },
    });
    expect(onError).not.toHaveBeenCalled();
    expect(doneText).toContain('Entropy measures disorder.');
    expect(doneText).toContain('Physics Ch 4');
  });
});

describe('googleWorkspace Sheets & Gmail safety', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('syncAllAssignmentsToSheet writes PUT before clearing trailing rows and never wipes on PUT failure', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        calls.push(`${init?.method || 'GET'} ${url}`);
        if (url.includes(':clear')) {
          throw new Error('clear must NOT run when PUT fails');
        }
        return new Response(JSON.stringify({ error: { message: 'Sheets write error' } }), { status: 500 });
      })
    );

    const assignments = [
      { id: '1', subject: 'Math', assignmentName: 'PS1', dueDate: '2026-10-01', priority: 'High', status: 'Not Started' } as any,
    ];
    await expect(syncAllAssignmentsToSheet('tok', 'sheet-123', assignments)).rejects.toThrow();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('PUT ');
    expect(calls[0]).toContain('Assignments!A2:H2');
  });

  it('findOrCreateMasterSpreadsheet scopes scc_master_sheet_id per uid and throws on failed batchUpdate', async () => {
    const storage = createMemoryStorage({ scc_master_sheet_id: 'legacy-sheet-id' });
    vi.stubGlobal('localStorage', storage);
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('legacy-sheet-id')) {
        return new Response(JSON.stringify({ spreadsheetId: 'legacy-sheet-id' }), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    // User A migrates legacy key into per-uid key
    const resA = await findOrCreateMasterSpreadsheet('tok-a', 'uid-A');
    expect(resA.spreadsheetId).toBe('legacy-sheet-id');
    expect(storage.getItem('scc_master_sheet_id_uid-A')).toBe('legacy-sheet-id');
    expect(storage.getItem('scc_master_sheet_id')).toBeNull();

    // User B does NOT inherit User A's cached sheet, creates their own, and throws if formatting batchUpdate fails
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ files: [] }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ spreadsheetId: 'sheet-B' }), { status: 200 }))
        .mockResolvedValueOnce(new Response('{}', { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'Format failed' } }), { status: 500 }))
    );
    await expect(findOrCreateMasterSpreadsheet('tok-b', 'uid-B')).rejects.toThrow();
    expect(storage.getItem('scc_master_sheet_id_uid-B')).toBe('sheet-B');
  });

  it('createGmailDraft avoids hardcoded /mail/u/0/#drafts/ URL', async () => {
    vi.stubGlobal('localStorage', createMemoryStorage({ scc_google_email_v1: 'student@school.edu' }));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ id: 'draft-99' }), { status: 200 }))
    );
    const res = await createGmailDraft('tok', { to: 'prof@school.edu', subject: 'Hi', body: 'Question' });
    expect(res.webUrl).not.toContain('/mail/u/0/');
    expect(res.webUrl).toContain('authuser=student%40school.edu');
    expect(res.webUrl).toContain('#drafts/draft-99');
  });

  it('updateAssignmentInSheet updates full row and deleteAssignmentInSheet deletes row via batchUpdate', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await updateAssignmentInSheet('tok', 'sheet-1', {
      id: 'sheet-4',
      sheetRowIndex: 4,
      subject: 'Bio',
      assignmentName: 'Lab 2',
      dueDate: '2026-11-01',
      priority: 'High',
      status: 'In Progress',
    } as any);
    expect(fetchMock.mock.calls[0][0]).toContain('Assignments!A4:H4');

    await deleteAssignmentInSheet('tok', 'sheet-1', 4);
    expect(fetchMock.mock.calls[1][0]).toContain(':batchUpdate');
  });
});

describe('canvas, firebase, ambientAudio, and srsEngine hardening', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loadCompletedCanvasIds handles missing or malformed localStorage safely', () => {
    const KEY = 'scc_canvas_completed_ids_v1';
    vi.stubGlobal('localStorage', undefined);
    expect(loadCompletedCanvasIds()).toEqual([]);

    vi.stubGlobal('localStorage', createMemoryStorage({ [KEY]: '{broken-json' }));
    expect(loadCompletedCanvasIds()).toEqual([]);

    vi.stubGlobal('localStorage', createMemoryStorage({ [KEY]: '{"not":"array"}' }));
    expect(loadCompletedCanvasIds()).toEqual([]);

    vi.stubGlobal('localStorage', createMemoryStorage());
    saveCompletedCanvasIds(['c1', 'c2']);
    expect(loadCompletedCanvasIds()).toEqual(['c1', 'c2']);
  });

  it('firebase module import does not invoke getRedirectResult eagerly', async () => {
    const getRedirectSpy = vi.fn().mockResolvedValue(null);
    vi.resetModules();
    vi.doMock('firebase/auth', () => ({
      getAuth: vi.fn(() => ({ currentUser: null })),
      GoogleAuthProvider: vi.fn(function GoogleAuthProviderMock(this: any) {
        this.addScope = vi.fn();
        this.setCustomParameters = vi.fn();
      }),
      browserLocalPersistence: {},
      setPersistence: vi.fn(() => Promise.resolve()),
      signInWithPopup: vi.fn(),
      signInWithRedirect: vi.fn(),
      getRedirectResult: getRedirectSpy,
      signOut: vi.fn(),
      onAuthStateChanged: vi.fn(() => () => {}),
    }));
    const fb = await import('./firebase');
    expect(getRedirectSpy).not.toHaveBeenCalled();
    await fb.consumeRedirectResult();
    expect(getRedirectSpy).toHaveBeenCalledTimes(1);
    vi.doUnmock('firebase/auth');
  });

  it('ambientAudio track names match synthesis IDs and getVolume returns volume', () => {
    const byId = Object.fromEntries(AMBIENT_TRACKS.map((t) => [t.id, t]));
    expect(byId.rain.label).toContain('Rain');
    expect(byId.brown.label).toContain('Brown');
    expect(byId.pink.label).toContain('Pink');
    expect(byId.white.label).toContain('White');
    expect(byId.fingerpicking.label).toContain('Fingerpicking');
    expect(byId.musicbox.label).toContain('Music-Box');
    expect(ambientAudio.getVolume()).toBeTypeOf('number');
  });

  it('srsEngine maintains SM-2 math and accessible badge colors', () => {
    const card = createNewSRSCard({ front: 'Q', back: 'A' });
    const next = calculateSM2(card, 4);
    expect(next.repetitions).toBe(1);
    expect(next.interval).toBe(1);
    expect(next.history).toHaveLength(1);
    expect(QUALITY_LABELS[3].color).not.toContain('bg-amber-500');
    expect(QUALITY_LABELS[1].color).not.toContain('bg-rose-500');
  });

  it('summarizeEmailsWithGemini falls back to client Groq BYOK when server returns ai_unavailable', async () => {
    setClientGroqApiKey('gsk_test_client_key');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ alerts: [{ id: 'm1', aiStatus: 'failed' }], model: null, error: 'ai_unavailable' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    alerts: [
                      {
                        id: 'm1',
                        sender: 'Ms. Lan',
                        subject: 'Math Homework',
                        oneLineSummary: 'Submit worksheet by Friday',
                        urgency: 'HIGH',
                        category: 'ASSIGNMENT',
                        categoryLabel: 'Bài tập',
                        isSpam: false,
                        confidence: 0.92,
                        detectedAssignment: {
                          isAssignment: true,
                          name: 'Math Worksheet',
                          subject: 'Toán',
                          dueDate: '2026-11-27',
                          dueConfidence: 'explicit',
                          dueEvidence: 'Friday 27/11',
                          priority: 'High',
                        },
                      },
                    ],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    const alerts = await summarizeEmailsWithGemini([
      {
        id: 'm1',
        threadId: 't1',
        sender: 'Ms. Lan',
        senderEmail: 'lan@school.edu.vn',
        subject: 'Math Homework',
        date: 'Today',
        snippet: 'Submit worksheet by Friday 27/11',
        unread: true,
        labelIds: ['INBOX'],
      },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ id: 'm1', aiStatus: 'ok', category: 'ASSIGNMENT' });
  });

  it('scans all emails including SPAM/PROMOTIONS and incrementally skips already-scanned ones', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          alerts: [
            { id: 'spam-1', sender: 'Teacher', subject: 'Quiz', oneLineSummary: 'Quiz tomorrow', urgency: 'HIGH', category: 'EXAM', aiStatus: 'ok' },
          ],
          model: 'gemma-4-31b-it',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const spamEmail = {
      id: 'spam-1',
      threadId: 't-spam',
      sender: 'Random Sender',
      senderEmail: 'random@gmail.com',
      subject: 'Quiz tomorrow',
      date: 'Today',
      snippet: 'Reminder: quiz tomorrow',
      unread: true,
      labelIds: ['SPAM'],
    };
    const alreadyScannedEmail = {
      id: 'ok-1',
      threadId: 't-ok',
      sender: 'Ms. Lan',
      senderEmail: 'lan@school.edu.vn',
      subject: 'Syllabus',
      date: 'Yesterday',
      snippet: 'Read chapter 1',
      unread: false,
      labelIds: ['INBOX'],
    };
    const existingAlerts: any[] = [
      { id: 'ok-1', sender: 'Ms. Lan', subject: 'Syllabus', oneLineSummary: 'Read chapter 1', urgency: 'LOW', category: 'ANNOUNCEMENT', isSpam: false, aiStatus: 'ok', rawEmail: alreadyScannedEmail },
      { id: 'spam-1', sender: 'Random Sender', subject: 'Quiz tomorrow', oneLineSummary: 'Old skipped', urgency: 'INFO', category: 'PROMOTION', isSpam: true, aiStatus: 'skipped', rawEmail: spamEmail },
    ];

    const { emailsToScan, reusableByEmailId } = partitionEmailsForAIScan([spamEmail, alreadyScannedEmail], existingAlerts);
    expect(emailsToScan.map((e) => e.id)).toEqual(['spam-1']);
    expect(reusableByEmailId.has('ok-1')).toBe(true);

    const scanned = await summarizeEmailsWithGemini(emailsToScan);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const merged = mergeScannedEmailAlerts([spamEmail, alreadyScannedEmail], reusableByEmailId, scanned);
    expect(merged.map((a) => a.id)).toEqual(['spam-1', 'ok-1']);
    expect(merged[0]).toMatchObject({ id: 'spam-1', aiStatus: 'ok', category: 'EXAM' });
  });
});


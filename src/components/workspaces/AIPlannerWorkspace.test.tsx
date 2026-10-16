import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { vi, it, expect } from 'vitest';

const store = new Map<string, string>();
const mem = { getItem: (k: string) => (store.has(k) ? store.get(k)! : null), setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear(), key: (i: number) => Array.from(store.keys())[i] ?? null, get length() { return store.size; } };
Object.defineProperty(globalThis, 'localStorage', { value: mem, configurable: true, writable: true });
try { Object.defineProperty(window, 'localStorage', { value: mem, configurable: true }); } catch {}
const geminiReply = { value: '' };
vi.mock('../../services/gemini', () => ({
  GEMINI_DEFAULT_MODEL: 'm',
  callGemini: vi.fn(async () => { if (!geminiReply.value) throw new Error('no key'); return geminiReply.value; }),
}));
import { AIPlannerWorkspace } from './AIPlannerWorkspace';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const iso = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${`${d.getMonth()+1}`.padStart(2,'0')}-${`${d.getDate()}`.padStart(2,'0')}`; };
const assignments: any[] = [
  { id: '1', subject: 'Toán', assignmentName: 'Bài tập Toán chương 3', dueDate: iso(4), priority: 'High', status: 'To Do', estimatedMinutes: 120 },
  { id: '2', subject: 'Ngữ văn', assignmentName: 'Nghị luận Chí Phèo', dueDate: iso(5), priority: 'Med', status: 'To Do', dueStatus: 'unconfirmed' },
  { id: '3', subject: 'Tiếng Anh', assignmentName: 'Essay no date', dueDate: '', priority: 'High', status: 'To Do' },
  { id: '4', subject: 'KHTN', assignmentName: 'Missing date', dueDate: '2026-12-01', priority: 'Med', status: 'To Do', dueStatus: 'missing' },
];
const emailAlerts: any[] = [
  { id: 'e1', subject: 'x', detectedAssignment: { isAssignment: true, name: 'Bài tập Toán chương 3', subject: 'Toán', dueDate: iso(3), priority: 'High' } },
  { id: 'e2', subject: 'y', detectedAssignment: { isAssignment: true, name: 'Thuyết trình Sử', subject: 'Sử', dueDate: '', priority: 'Med', dueConfidence: 'none' } },
];

const flush = async (ms = 1500) => { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); };
const text = () => document.body.textContent || '';
const click = async (el: Element | null | undefined) => { expect(el).toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };
const btn = (label: RegExp) => Array.from(document.querySelectorAll('button')).find((b) => label.test(b.textContent || ''));

it('renders, locks, edits, diffs, restores', async () => {
  localStorage.clear();
  localStorage.setItem('scc_lang_v1', 'vi');
  const { setLang } = await import('../../services/i18n');
  setLang('vi');
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(<AIPlannerWorkspace assignments={assignments} canvasAssignments={[]} emailAlerts={emailAlerts} />); });
  await flush(2000);
  const t0 = text();
  expect(t0).toContain('Chưa có hạn nộp — AI không tự đặt hạn');
  expect(t0).toContain('Essay no date');
  expect(t0).toContain('Missing date');
  expect(t0).toContain('Thuyết trình Sử');
  expect(t0).toContain('Xếp từ — 2 mục'); // Gmail duplicate of the tracker item skipped
  const plan1 = JSON.parse(localStorage.getItem('scc_ai_planner_v1')!);
  expect(plan1.blocks.length).toBeGreaterThan(0);
  expect(plan1.blocks.some((b: any) => b.tentative)).toBe(true);
  console.log('first plan', plan1.blocks.map((b: any) => `${b.subject} ${b.dayISO} ${b.startMin}-${b.endMin}${b.tentative ? ' T' : ''}`));

  // Regenerate on an existing plan → diff panel, not a silent replace.
  await click(btn(/^Tạo lại$/));
  await flush(2000);
  expect(text()).toMatch(/Không có gì thay đổi|AI muốn đổi/);
  console.log('after regen:', text().match(/(Không có gì thay đổi|AI muốn đổi \d+ buổi)/)?.[0]);
  await click(btn(/^(Đóng|Giữ lịch cũ)$/));

  // Lock the first visible block, then ask chat (offline) to move Toán: refused if it was the locked one.
  const firstDayWithBlocks = Array.from(document.querySelectorAll('[role="tab"]')).find((t) => /buổi/.test(t.textContent || ''));
  await click(firstDayWithBlocks);
  await click(btn(/^Khoá$/));
  expect(text()).toContain('Đã khoá — AI không dời');
  const locked = JSON.parse(localStorage.getItem('scc_ai_planner_v1')!).blocks.find((b: any) => b.locked);
  expect(locked).toBeTruthy();

  const input = document.getElementById('ai-planner-chat') as HTMLInputElement;
  const send = async (msg: string) => {
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, msg);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => { (input.form as HTMLFormElement).requestSubmit(); });
    await flush(1200);
  };
  await send('chủ nhật em nghỉ hoàn toàn');
  console.log('chat 1:', Array.from(document.querySelectorAll('.whitespace-pre-line')).slice(-1)[0]?.textContent);
  console.log('panel 1:', text().match(/(Không có gì thay đổi|AI muốn đổi \d+ buổi)/)?.[0]);

  // AI path: model asks to move the locked block → applyOps refuses, enforceLocks keeps it.
  geminiReply.value = JSON.stringify({ ops: [{ op: 'move', blockId: locked.id, toDayISO: iso(6), period: 'evening' }], reply: 'Mình dời nhé', unclear: false, question: '' });
  if (btn(/^(Đóng|Giữ lịch cũ)$/)) await click(btn(/^(Đóng|Giữ lịch cũ)$/));
  await send('dời buổi đó sang tối chủ nhật');
  expect(text()).toContain('đã khoá nên mình giữ nguyên');
  expect(text()).toContain('Không có gì thay đổi');
  await click(btn(/^Đóng$/));

  // Unclear → question only.
  geminiReply.value = JSON.stringify({ ops: [], reply: '', unclear: true, question: 'Bạn muốn dời buổi nào?' });
  await send('dời cái kia đi');
  console.log('phase btn:', btn(/Đang xếp|Tạo lại/)?.textContent, 'calls:', (await import('../../services/gemini') as any).callGemini.mock.calls.length);
  expect(text()).toContain('Bạn muốn dời buổi nào?');

  // Manual edit → locked + manual + history "Sửa tay".
  geminiReply.value = '';
  await click(btn(/^Sửa giờ$/));
  const sel = document.querySelector('select') as HTMLSelectElement;
  await act(async () => { sel.value = sel.options[6].value; sel.dispatchEvent(new Event('change', { bubbles: true })); });
  await click(btn(/^Lưu$/));
  expect(text()).toContain('Đã khoá vì bạn tự sửa');
  const hist = JSON.parse(localStorage.getItem('scc_ai_planner_history_v1')!);
  expect(hist[0].label).toBe('Sửa tay');
  expect(text()).toMatch(/Lịch sử lịch học \(\d+\)/);

  // Apply an offline chat change, then undo.
  await send('mỗi buổi tối đa 45 phút');
  console.log('panel cap:', text().match(/(Không có gì thay đổi|AI muốn đổi \d+ buổi)/)?.[0]);
  const before = localStorage.getItem('scc_ai_planner_v1');
  if (btn(/^Áp dụng$/)) {
    await click(btn(/^Áp dụng$/));
    expect(localStorage.getItem('scc_ai_planner_v1')).not.toBe(before);
    await click(btn(/Hoàn tác/));
    const after = JSON.parse(localStorage.getItem('scc_ai_planner_v1')!);
    expect(after.blocks).toEqual(JSON.parse(before!).blocks);
  }
  console.log('history labels:', JSON.parse(localStorage.getItem('scc_ai_planner_history_v1')!).map((h: any) => h.label));
  await act(async () => root.unmount());
}, 30000);

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { AI_BODY_LIMIT, cleanEmailForAI } from './emailText';
import { anonymizeText } from '../../scripts/anonymize_sample';

const EVAL_DIR = path.resolve(process.cwd(), 'eval');

interface EvalEmailCase {
  id: string;
  modeledOn: string;
  tricky: string;
  email: {
    id: string;
    sender: string;
    senderEmail: string;
    subject: string;
    date: string;
    snippet: string;
    body: string;
    labelIds: string[];
  };
  expected: {
    isAssignment: boolean;
    category: string;
    dueDate: string | null;
    priority: string | null;
    mustNotHide?: boolean;
  };
}

interface BasePlanItem {
  id: string;
  subject: string;
  title: string;
  day: string;
  start: string;
  end: string;
  locked: boolean;
}

interface ScheduleCommandCase {
  id: string;
  command: string;
  intent: string;
  expect: string;
  mustNotChange?: string[];
}

interface TutorPromptCase {
  id: string;
  kind: string;
  expect: string;
  prompt: string;
  why: string;
}

const ALLOWED_SYSTEM_OR_FICTIONAL_SENDERS = new Set([
  'no-reply@classroom.google.com',
  'notifications@instructure.com',
  'notification@facebookmail.com',
  'no-reply@azota.vn',
  'thongbao@olm.vn',
  'thongbao@vnedu.vn',
  'thaytuan.toan@gmail.com',
  'cohuong.van8a3@gmail.com',
]);

function readEvalJson<T>(filename: string): T {
  return JSON.parse(fs.readFileSync(path.join(EVAL_DIR, filename), 'utf-8')) as T;
}

describe('eval/emails.json PII & anonymization hygiene', () => {
  const emails = readEvalJson<EvalEmailCase[]>('emails.json');

  it('contains zero real Vietnamese mobile numbers or 12-digit national IDs', () => {
    const realVnPhoneRe = /(?:\+?84|0)(?:3|5|7|8|9)(?:[\s.-]?\d){8}\b/;
    const id12Re = /\b\d{12}\b/;
    for (const item of emails) {
      const text = `${item.email.sender} ${item.email.subject} ${item.email.snippet} ${item.email.body}`;
      expect(realVnPhoneRe.test(text), `${item.id} matched real VN phone`).toBe(false);
      expect(id12Re.test(text), `${item.id} matched 12-digit ID`).toBe(false);
    }
  });

  it('uses only .example domains or documented system/fictional sender addresses', () => {
    for (const item of emails) {
      const addr = item.email.senderEmail.toLowerCase();
      const domain = addr.split('@')[1] || '';
      const isExample = domain.includes('example');
      const isAllowed = isExample || ALLOWED_SYSTEM_OR_FICTIONAL_SENDERS.has(addr);
      expect(isAllowed, `${item.id} has unexpected senderEmail: ${addr}`).toBe(true);
    }
  });

  it('anonymize_sample scrubs emails, VN phone numbers, 12-digit IDs, and student names', () => {
    const sample = 'Lien he Nguyen Minh Anh qua minh.anh@truong.edu.vn hoac 0912 345 678, CCCD 079209001234.';
    const cleaned = anonymizeText(sample, { studentNames: ['Nguyen Minh Anh'] });
    expect(cleaned).toContain('[HOC_SINH]');
    expect(cleaned).toContain('user1@school.example');
    expect(cleaned).toContain('0123 456 789');
    expect(cleaned).toContain('[REDACTED_ID]');
    expect(cleaned).not.toContain('minh.anh@truong.edu.vn');
    expect(cleaned).not.toContain('0912 345 678');
    expect(cleaned).not.toContain('079209001234');
  });
});

describe('cleanEmailForAI quote/signature stripping and length cap', () => {
  it('strips quoted Vietnamese/English reply chains and signatures', () => {
    const raw = [
      'Chao cac em, han nop bai tap Toan la thu 6 tuan nay luc 21h.',
      'Nop file PDF len Classroom nhe.',
      '',
      'Vao T2, 12 thg 10, 2026 vao luc 08:00 co Lan <lan@school.example> da viet:',
      '> Han cu la thu 4 tuan truoc.',
      '> -- ',
      '> Chu ky cu',
    ].join('\n');
    const out = cleanEmailForAI(raw);
    expect(out).toContain('han nop bai tap Toan la thu 6');
    expect(out).not.toContain('Han cu la thu 4');
    expect(out).not.toContain('Chu ky cu');

    const withSig = 'Noi dung chinh cua bai tap Toan chuong 2 can nop ngay mai.\n--\nNguyen Van A\nGVCN 8A1';
    const strippedSig = cleanEmailForAI(withSig);
    expect(strippedSig).toContain('Noi dung chinh');
    expect(strippedSig).not.toContain('GVCN 8A1');
  });

  it('caps output to AI_BODY_LIMIT (1500 chars + ellipsis)', () => {
    const longBody = 'Bai tap Toan '.repeat(400);
    const out = cleanEmailForAI(longBody);
    expect(AI_BODY_LIMIT).toBe(1500);
    expect(out.length).toBeLessThanOrEqual(AI_BODY_LIMIT + 1);
  });
});

describe('eval corpus integrity', () => {
  it('validates eval/emails.json (30 cases e01..e30)', () => {
    const emails = readEvalJson<EvalEmailCase[]>('emails.json');
    expect(emails).toHaveLength(30);
    const ids = new Set(emails.map((e) => e.id));
    expect(ids.size).toBe(30);
    for (let i = 1; i <= 30; i += 1) {
      const expectedId = `e${String(i).padStart(2, '0')}`;
      expect(ids.has(expectedId)).toBe(true);
    }
    for (const item of emails) {
      expect(item.email.id).toBe(item.id);
      expect(item.email.subject.length).toBeGreaterThan(0);
      expect(item.email.body.length).toBeGreaterThan(0);
      expect(typeof item.expected.isAssignment).toBe('boolean');
      expect(item.expected.category.length).toBeGreaterThan(0);
    }
  });

  it('validates eval/schedule-commands.json (10 cases s01..s10) and eval/base-plan.json (13 blocks)', () => {
    const cmds = readEvalJson<ScheduleCommandCase[]>('schedule-commands.json');
    const plan = readEvalJson<BasePlanItem[]>('base-plan.json');
    expect(cmds).toHaveLength(10);
    expect(plan).toHaveLength(13);
    expect(plan.filter((b) => b.locked)).toHaveLength(2);
    const cmdIds = new Set(cmds.map((c) => c.id));
    for (let i = 1; i <= 10; i += 1) {
      expect(cmdIds.has(`s${String(i).padStart(2, '0')}`)).toBe(true);
    }
    const blockIds = new Set(plan.map((b) => b.id));
    for (let i = 1; i <= 13; i += 1) {
      expect(blockIds.has(`b${String(i).padStart(2, '0')}`)).toBe(true);
    }
  });

  it('validates eval/tutor-prompts.json (10 cases t01..t10)', () => {
    const prompts = readEvalJson<TutorPromptCase[]>('tutor-prompts.json');
    expect(prompts).toHaveLength(10);
    expect(prompts.filter((p) => p.expect === 'hint_only')).toHaveLength(6);
    expect(prompts.filter((p) => p.expect === 'explain_ok')).toHaveLength(4);
    for (let i = 1; i <= 10; i += 1) {
      const id = `t${String(i).padStart(2, '0')}`;
      expect(prompts.some((p) => p.id === id)).toBe(true);
    }
  });
});

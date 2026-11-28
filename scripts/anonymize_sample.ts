/**
 * Local PII scrubber for StudentOS evaluation samples.
 * Replaces emails, Vietnamese phone numbers, 12-digit IDs, and optional student names.
 *
 * Usage:
 *   npx tsx scripts/anonymize_sample.ts <input-file> [--names "Nguyen Van A,Tran Thi B"]
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export interface AnonymizeOptions {
  studentNames?: string[];
  preserveExampleDomains?: boolean;
  emailMap?: Map<string, string>;
}

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const ID_12_RE = /\b\d{12}\b/g;
const VN_PHONE_RE = /(?:\+?84|0)(?:3|5|7|8|9|2\d)(?:[\s.-]?\d){7,8}\b/g;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function anonymizeText(input: string, opts: AnonymizeOptions = {}): string {
  if (!input) return '';
  const emailMap = opts.emailMap ?? new Map<string, string>();
  const preserveExample = opts.preserveExampleDomains ?? true;
  let out = input;

  out = out.replace(EMAIL_RE, (match) => {
    const lower = match.toLowerCase();
    if (preserveExample && /\.example(?:\.[a-z]+)?$/.test(lower.split('@')[1] || '')) {
      return match;
    }
    const existing = emailMap.get(lower);
    if (existing) return existing;
    const replacement = `user${emailMap.size + 1}@school.example`;
    emailMap.set(lower, replacement);
    return replacement;
  });

  // Scrub 12-digit national IDs before phone numbers to avoid partial phone matches.
  out = out.replace(ID_12_RE, '[REDACTED_ID]');
  out = out.replace(VN_PHONE_RE, '0123 456 789');

  const names = (opts.studentNames || [])
    .map((n) => n.trim())
    .filter((n) => n.length >= 2)
    .sort((a, b) => b.length - a.length);
  for (const name of names) {
    out = out.replace(new RegExp(escapeRegex(name), 'gi'), '[HOC_SINH]');
  }
  return out;
}

export function anonymizeValue(value: unknown, opts: AnonymizeOptions = {}): unknown {
  const sharedOpts: AnonymizeOptions = { ...opts, emailMap: opts.emailMap ?? new Map<string, string>() };
  if (typeof value === 'string') return anonymizeText(value, sharedOpts);
  if (Array.isArray(value)) return value.map((item) => anonymizeValue(item, sharedOpts));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = anonymizeValue(v, sharedOpts);
    }
    return out;
  }
  return value;
}

function runCli(): void {
  const args = process.argv.slice(2);
  let filePath = '';
  let studentNames: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--names' && args[i + 1]) {
      studentNames = args[i + 1].split(',').map((s) => s.trim()).filter(Boolean);
      i += 1;
    } else if (!args[i].startsWith('--') && !filePath) {
      filePath = args[i];
    }
  }
  const raw = filePath ? fs.readFileSync(path.resolve(filePath), 'utf-8') : fs.readFileSync(0, 'utf-8');
  const opts: AnonymizeOptions = { studentNames, emailMap: new Map<string, string>() };
  if (filePath.endsWith('.json')) {
    const parsed: unknown = JSON.parse(raw);
    process.stdout.write(`${JSON.stringify(anonymizeValue(parsed, opts), null, 2)}\n`);
  } else {
    process.stdout.write(anonymizeText(raw, opts));
  }
}

const isEntry = process.argv[1] ? import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href : false;
if (isEntry) {
  runCli();
}

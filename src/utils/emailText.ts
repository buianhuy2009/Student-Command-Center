/**
 * Email text helpers shared by the Gmail fetcher (browser) and the AI eval
 * runner (Node). No DOM APIs: base64 decoding works with atob or Buffer.
 */

/** Characters of cleaned body text sent to the AI (privacy page promises 1,500). */
export const AI_BODY_LIMIT = 1500;

function decodeBase64Url(data: string): string {
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  try {
    if (typeof atob === 'function') {
      const bin = atob(b64);
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      return new TextDecoder('utf-8').decode(bytes);
    }
  } catch {
    /* fall through to Buffer */
  }
  try {
    const B = (globalThis as any).Buffer;
    if (B) return B.from(b64, 'base64').toString('utf-8');
  } catch {
    /* ignore */
  }
  return '';
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

/** Walks a Gmail `payload` (format=full) and returns the best plain-text body. */
export function extractPlainBody(payload: any): string {
  if (!payload) return '';
  let plain = '';
  let html = '';
  const walk = (part: any) => {
    if (!part) return;
    const mime = String(part.mimeType || '');
    const data = part.body?.data;
    if (data && mime === 'text/plain' && !plain) plain = decodeBase64Url(data);
    else if (data && mime === 'text/html' && !html) html = decodeBase64Url(data);
    (part.parts || []).forEach(walk);
  };
  walk(payload);
  const text = plain || (html ? htmlToText(html) : '');
  return text.slice(0, 8000);
}

// Lines that start the quoted older message in a reply thread.
const QUOTE_START_RE =
  /^(\s*On .{4,120} wrote:\s*$|\s*Vào .{4,160} đã viết:\s*$|\s*-{2,}\s*(Original Message|Forwarded message|Thư gốc|Thư đã chuyển tiếp)\s*-{2,}|\s*_{8,}\s*$|\s*(From|Từ):\s.+@.+)/im;

/**
 * What the AI gets to read: quoted older replies and signatures removed,
 * whitespace collapsed, capped at AI_BODY_LIMIT characters.
 */
export function cleanEmailForAI(body: string, limit = AI_BODY_LIMIT): string {
  if (!body) return '';
  let text = body.replace(/\r\n/g, '\n');
  const q = QUOTE_START_RE.exec(text);
  if (q && q.index > 40) text = text.slice(0, q.index);
  text = text
    .split('\n')
    .filter((line) => !/^\s*>/.test(line))
    .join('\n');
  const sig = /^\s*--\s*$/m.exec(text);
  if (sig && sig.index > 40) text = text.slice(0, sig.index);
  text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

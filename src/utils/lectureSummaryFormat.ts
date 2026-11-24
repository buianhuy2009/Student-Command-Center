/**
 * Ensures lecture AI summaries always render as clean, scannable study notes
 * with headings, short paragraphs, and bullet lists rather than dense walls of text.
 */
export function formatLectureSummaryMarkdown(raw: string): string {
  const cleaned = String(raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/^```(?:markdown|md)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();

  if (!cleaned) return '';

  // Normalize inline bullets or headings glued onto previous lines (common in small models).
  let normalized = cleaned
    .replace(/([^\n])\s+(###?\s+[A-ZÀ-Ỹ])/g, '$1\n\n$2')
    .replace(/([.!?])\s+-\s+\*\*/g, '$1\n- **')
    .replace(/\n{3,}/g, '\n\n');

  // If the text already has headings or bullet lists, refine overly long prose paragraphs.
  const hasStructure = /(?:^|\n)\s*(?:#{1,4}\s+|[-*•]\s+|\d+[.)]\s+)/.test(normalized);

  if (hasStructure) {
    const blocks = normalized.split(/\n{2,}/);
    const refined = blocks.map((block) => {
      const trimmed = block.trim();
      if (/^(?:#{1,4}\s+|[-*•]\s+|\d+[.)]\s+|>\s+|```)/.test(trimmed)) {
        return trimmed;
      }
      // Split any single dense prose paragraph (> 320 chars and 3+ sentences) into readable bullets.
      const sentences = splitIntoSentences(trimmed);
      if (trimmed.length > 320 && sentences.length >= 3) {
        return sentences.map((s) => `- ${s}`).join('\n');
      }
      return trimmed;
    });
    return refined.join('\n\n').trim();
  }

  // Plain wall of text (e.g. legacy saved summary or flat model output): convert to structured notes.
  const sentences = splitIntoSentences(normalized);
  if (sentences.length <= 2) {
    return `### Overview\n\n${normalized}`;
  }

  const overview = sentences.slice(0, 2).join(' ');
  const rest = sentences.slice(2);
  const bullets = rest.map((s) => `- ${s}`).join('\n');

  return `### Overview\n\n${overview}\n\n### Key Points\n\n${bullets}`;
}

function splitIntoSentences(text: string): string[] {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (!flat) return [];
  const raw = flat.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ỹ0-9"'(“])/);
  return raw.map((s) => s.trim()).filter((s) => s.length > 0);
}

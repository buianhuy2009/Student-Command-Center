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

/**
 * Strips video downloader tags, resolutions, IDs, and file extensions from lecture filenames.
 */
export function cleanLectureTitle(rawTitle?: string): string {
  const original = String(rawTitle || '').trim();
  if (!original) return '';
  let cleaned = original
    .replace(/\.[a-z0-9]{2,4}$/i, '')
    .replace(/^(?:YTSave\.to|YouTube|Media|Download|SnapSave|SaveFrom|SSYouTube)[_\s-]*(?:YouTube[_\s-]*Media[_\s-]*)?/i, '')
    .replace(/(?:^|[_\s-])[A-Za-z0-9_-]{11}(?=[_\s-]|$)/g, (m) =>
      /[0-9]/.test(m) && /[A-Z]/.test(m) && /[a-z]/.test(m) ? ' ' : m
    )
    .replace(/(?:^|[_\s-])(?:480p|720p|1080p|1440p|2160p|4k|00\d)(?=[_\s-]|$)/gi, ' ')
    .replace(/[_]+/g, ' ')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s-]+|[\s-]+$/g, '');
  return cleaned || original;
}

const VI_DIACRITIC_RE = /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i;

const PROMPT_PLACEHOLDER_PATTERNS: readonly RegExp[] = [
  /1\s*-\s*2\s*short sentences explaining the main point\.?/gi,
  /2\s*short things to remember for an exam or quiz\.?/gi,
  /\*\*?Point\s*\d+\s*:\*\*?\s*Concise note\.?/gi,
  /Point\s*\d+\s*:\s*Concise note\.?/gi,
  /Use this exact Markdown layout.*$/gim,
  /^Lecture Title\s*:.*$/gim,
  /^Transcript\s*:.*$/gim,
];

const PROMPT_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'on', 'for', 'with',
  'this', 'that', 'it', 'we', 'you', 'they', 'so', 'but', 'as', 'at', 'by', 'from', 'be', 'have',
  'và', 'là', 'của', 'có', 'một', 'những', 'các', 'cho', 'với', 'này', 'thì', 'mà', 'được', 'trong',
  'khi', 'để', 'như', 'về', 'tất', 'cả', 'con', 'thầy', 'bạn', 'nó', 'cái', 'đấy', 'đó', 'nhé', 'hôm', 'nay',
]);

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

function splitTranscriptUnits(
  segments: { text: string; startSec?: number }[]
): string[] {
  const units: string[] = [];
  for (const seg of segments) {
    const raw = String(seg.text || '').replace(/\s+/g, ' ').trim();
    if (!raw) continue;
    const bySentence = raw.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
    for (const piece of bySentence) {
      const words = piece.split(/\s+/);
      if (words.length <= 28) {
        units.push(piece);
      } else {
        for (let i = 0; i < words.length; i += 20) {
          const slice = words.slice(i, i + 20).join(' ').trim();
          if (slice) units.push(slice);
        }
      }
    }
  }
  return units;
}

function buildExtractiveStudySummary(
  segments: { text: string; startSec?: number }[],
  title?: string,
  language?: 'auto' | 'vi' | 'en'
): string {
  const cleanTitle = cleanLectureTitle(title);
  const fullText = segments.map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim();
  const isVi = language === 'vi' || (language !== 'en' && VI_DIACRITIC_RE.test(`${cleanTitle} ${fullText}`));

  const units = splitTranscriptUnits(segments);
  const freq = new Map<string, number>();
  for (const w of normalizeWords(`${cleanTitle} ${fullText}`)) {
    if (!PROMPT_STOPWORDS.has(w) && w.length >= 2) {
      freq.set(w, (freq.get(w) || 0) + 1);
    }
  }

  const scored = units.map((text, idx) => {
    const words = normalizeWords(text);
    const contentWords = words.filter((w) => !PROMPT_STOPWORDS.has(w) && w.length >= 2);
    const tfScore = contentWords.reduce((sum, w) => sum + Math.min(5, freq.get(w) || 0), 0);
    const lenFactor = words.length >= 6 && words.length <= 26 ? 1.2 : 0.75;
    const posBonus = idx === 0 || idx === units.length - 1 ? 1.15 : 1.0;
    return {
      idx,
      text: text.replace(/^[,\s-]+|[,\s-]+$/g, ''),
      score: (tfScore / Math.max(4, Math.sqrt(words.length))) * lenFactor * posBonus,
    };
  });

  const ranked = [...scored]
    .filter((u) => u.text.length >= 16)
    .sort((a, b) => b.score - a.score);

  const chosen: typeof ranked = [];
  for (const cand of ranked) {
    const candWords = new Set(normalizeWords(cand.text));
    const overlapsExisting = chosen.some((prev) => {
      const prevWords = normalizeWords(prev.text);
      const shared = prevWords.filter((w) => candWords.has(w)).length;
      return shared / Math.max(1, Math.min(prevWords.length, candWords.size)) > 0.6;
    });
    if (!overlapsExisting) {
      chosen.push(cand);
    }
    if (chosen.length >= 6) break;
  }

  chosen.sort((a, b) => a.idx - b.idx);
  const ideaUnits = chosen.slice(0, 2).map((u) => u.text);
  const takeawayUnits = chosen.slice(2, 5).map((u) => u.text);
  const reviewUnits = chosen.slice(4, 6).map((u) => u.text);

  while (takeawayUnits.length < 3 && units.length > 0) {
    const candidate = units[Math.min(units.length - 1, takeawayUnits.length * Math.max(1, Math.floor(units.length / 3)))];
    if (!takeawayUnits.includes(candidate)) takeawayUnits.push(candidate);
    else break;
  }
  while (reviewUnits.length < 2 && chosen.length > reviewUnits.length) {
    const candidate = chosen[chosen.length - 1 - reviewUnits.length]?.text;
    if (candidate && !reviewUnits.includes(candidate)) reviewUnits.push(candidate);
    else break;
  }

  const topKeywords = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w]) => w);

  if (isVi) {
    const core =
      ideaUnits.length > 0
        ? `${cleanTitle ? `**${cleanTitle}** — ` : ''}${ideaUnits.join('. ').replace(/\.\.+/g, '.')}.`
        : cleanTitle || fullText.slice(0, 220);
    const takeawaysMd = takeawayUnits.map((u) => `- ${u.replace(/\.+$/, '')}.`).join('\n');
    const reviewMd = [
      reviewUnits[0] ? `- ${reviewUnits[0].replace(/\.+$/, '')}.` : '',
      topKeywords.length > 0 ? `- Thuật ngữ trọng tâm cần ôn: ${topKeywords.join(', ')}.` : '',
    ]
      .filter(Boolean)
      .join('\n');
    return formatLectureSummaryMarkdown(
      `### Ý chính\n\n${core}\n\n### Điểm chính\n\n${takeawaysMd}\n\n### Ôn nhanh\n\n${reviewMd}`
    );
  }

  const core =
    ideaUnits.length > 0
      ? `${cleanTitle ? `**${cleanTitle}** — ` : ''}${ideaUnits.join('. ').replace(/\.\.+/g, '.')}.`
      : cleanTitle || fullText.slice(0, 220);
  const takeawaysMd = takeawayUnits.map((u) => `- ${u.replace(/\.+$/, '')}.`).join('\n');
  const reviewMd = [
    reviewUnits[0] ? `- ${reviewUnits[0].replace(/\.+$/, '')}.` : '',
    topKeywords.length > 0 ? `- Key terms to review: ${topKeywords.join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return formatLectureSummaryMarkdown(
    `### Core Idea\n\n${core}\n\n### Key Takeaways\n\n${takeawaysMd}\n\n### Quick Review\n\n${reviewMd}`
  );
}

/**
 * Validates offline Gemma 3 270M output: strips leaked prompt templates or raw transcript
 * echoes and falls back to a clean structured extractive summary when needed.
 */
export function sanitizeAndValidateGemmaSummary(
  raw: string,
  segments: { text: string; startSec?: number }[],
  title?: string,
  language?: 'auto' | 'vi' | 'en'
): string {
  const original = String(raw || '').trim();
  const hadPromptLeak =
    /1\s*-\s*2\s*short sentences explaining the main point/i.test(original) ||
    /Point\s*1\s*:\s*Concise note/i.test(original) ||
    /2\s*short things to remember/i.test(original) ||
    /(?:^|\n)\s*Lecture Title\s*:/i.test(original) ||
    /(?:^|\n)\s*Transcript\s*:/i.test(original);

  let stripped = original;
  // If model echoed prompt layout + `Transcript: ...`, discard everything from Lecture Title / Transcript onward.
  stripped = stripped.replace(/(?:^|\n)\s*(?:Lecture Title|Transcript)\s*:[\s\S]*$/i, '').trim();
  for (const pat of PROMPT_PLACEHOLDER_PATTERNS) {
    stripped = stripped.replace(pat, '').trim();
  }
  // Remove empty headings left after stripping template lines.
  stripped = stripped
    .replace(/^(?:#{1,4}\s*)?(?:Core Idea|Key Takeaways|Quick Review|Ý chính|Điểm chính|Ôn nhanh)\s*$/gim, (m, _offset, full) => {
      return full.length < 180 ? '' : m;
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (hadPromptLeak && stripped.replace(/[#*\s-]/g, '').length < 60) {
    return buildExtractiveStudySummary(segments, title, language);
  }

  const genWords = normalizeWords(stripped);
  const srcText = segments.map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim();
  const srcWords = normalizeWords(srcText);

  if (genWords.length < 12 || stripped.length < 45) {
    return buildExtractiveStudySummary(segments, title, language);
  }

  // Check 4-gram verbatim copying from the raw transcript (>40% copied phrases means the 270M model echoed).
  if (genWords.length >= 16 && srcWords.length >= 16) {
    const srcFourGrams = new Set<string>();
    for (let i = 0; i <= srcWords.length - 4; i++) {
      srcFourGrams.add(srcWords.slice(i, i + 4).join(' '));
    }
    let totalGrams = 0;
    let copiedGrams = 0;
    for (let i = 0; i <= genWords.length - 4; i++) {
      totalGrams++;
      if (srcFourGrams.has(genWords.slice(i, i + 4).join(' '))) {
        copiedGrams++;
      }
    }
    if (totalGrams > 0 && copiedGrams / totalGrams > 0.4) {
      return buildExtractiveStudySummary(segments, title, language);
    }
  }

  return formatLectureSummaryMarkdown(stripped);
}

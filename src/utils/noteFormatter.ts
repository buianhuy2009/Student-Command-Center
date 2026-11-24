export interface OcrBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OcrLineBox {
  text: string;
  box: OcrBox;
  confidence?: number;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function sortByYBand(lines: OcrLineBox[], bandTol: number): OcrLineBox[] {
  if (lines.length <= 1) return [...lines];
  const sortedByY = [...lines].sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
  const rows: OcrLineBox[][] = [];

  for (const item of sortedByY) {
    const itemCenterY = item.box.y + item.box.height / 2;
    const lastRow = rows[rows.length - 1];
    if (!lastRow) {
      rows.push([item]);
      continue;
    }
    const rowAvgY =
      lastRow.reduce((acc, r) => acc + r.box.y + r.box.height / 2, 0) / lastRow.length;
    if (Math.abs(itemCenterY - rowAvgY) <= bandTol) {
      lastRow.push(item);
    } else {
      rows.push([item]);
    }
  }

  return rows.flatMap((row) => [...row].sort((a, b) => a.box.x - b.box.x));
}

/**
 * Sorts detected OCR text lines into natural human reading order.
 * Detects clear 2-column layouts (vertical whitespace gutter separating ≥ 3 lines per side)
 * and otherwise groups lines into Y-bands sorted left-to-right.
 */
export function sortLinesInReadingOrder<T extends OcrLineBox>(lines: T[]): T[] {
  if (lines.length <= 1) return [...lines];

  const heights = lines.map((l) => Math.max(8, l.box.height));
  const medH = median(heights) || 20;
  const bandTol = Math.max(8, medH * 0.5);

  if (lines.length >= 6) {
    const minX = Math.min(...lines.map((l) => l.box.x));
    const maxX = Math.max(...lines.map((l) => l.box.x + l.box.width));
    const pageW = maxX - minX;
    if (pageW > 120) {
      const midX = minX + pageW * 0.5;
      const leftLines = lines.filter((l) => l.box.x + l.box.width <= midX + pageW * 0.04);
      const rightLines = lines.filter((l) => l.box.x >= midX - pageW * 0.04);
      const crossing = lines.filter(
        (l) => l.box.x < midX - pageW * 0.04 && l.box.x + l.box.width > midX + pageW * 0.04
      );
      if (
        leftLines.length >= 3 &&
        rightLines.length >= 3 &&
        crossing.length <= 1 &&
        leftLines.length + rightLines.length >= lines.length - 1
      ) {
        const leftSet = new Set(leftLines);
        const rightSet = new Set(rightLines);
        const remaining = lines.filter((l) => !leftSet.has(l) && !rightSet.has(l));
        const ordered = [
          ...sortByYBand(remaining, bandTol),
          ...sortByYBand(leftLines, bandTol),
          ...sortByYBand(rightLines, bandTol),
        ];
        return ordered as T[];
      }
    }
  }

  return sortByYBand(lines, bandTol) as T[];
}

const BULLET_RE = /^(?:[-*•●◦▪]|\d+[.)]|[a-zA-Z][.)])\s+/;
const KEY_VALUE_RE = /^[A-Za-zÀ-ỹ0-9][\wÀ-ỹ\s./-]{0,26}:\s*\S/;

function cleanLineSpacing(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/([\wÀ-ỹ)\]])\s+([,.;:!?%])/g, '$1$2')
    .replace(/([(\[“])\s+/g, '$1')
    .replace(/\s+([)\]”])/g, '$1')
    .trim();
}

function isLikelyHeading(text: string, prevGap: number, nextGap: number, medH: number): boolean {
  if (!text || text.length > 64 || BULLET_RE.test(text) || KEY_VALUE_RE.test(text)) return false;
  if (/[.?!,:]$/.test(text)) return false;
  const words = text.split(/\s+/);
  if (words.length > 9) return false;
  const letters = text.replace(/[^a-zA-ZÀ-ỹ]/g, '');
  const isAllCaps = letters.length >= 3 && letters === letters.toUpperCase();
  const hasLargeGap = prevGap > medH * 1.3 && nextGap > medH * 0.9;
  return isAllCaps || (hasLargeGap && words.length <= 6);
}

/**
 * Formats ordered OCR line boxes into clean, readable Markdown notes:
 * - Preserves bullets, numbered lists, and short/key-value lines (e.g. `Name: Ariel`)
 * - Repairs hyphenated line breaks (`exam-\nple` -> `example`)
 * - Merges soft-wrapped full-width paragraph lines
 * - Turns isolated/all-caps title lines into `## Headings`
 */
export function formatOcrLinesToMarkdown(rawLines: OcrLineBox[]): string {
  const nonEmpty = rawLines
    .map((l) => ({ ...l, text: cleanLineSpacing(l.text) }))
    .filter((l) => l.text.length > 0);

  if (nonEmpty.length === 0) return '';

    const ordered = sortLinesInReadingOrder(nonEmpty);
  const medH = median(ordered.map((l) => Math.max(8, l.box.height))) || 20;

  const isStandaloneShortLabel = (txt: string): boolean => {
    if (txt.length > 26 || txt.length === 0) return false;
    if (/[,;]$/.test(txt)) return false;
    // Standalone tokens/dates/labels like "2017", "2023", "ChatGPT", "Transformer architecture"
    return !/^[a-zà-ỹ]/.test(txt);
  };

  const blocks: string[] = [];
  let currentPara = '';
  let paraMaxW = 0;

  const flushPara = () => {
    if (currentPara.trim()) {
      blocks.push(currentPara.trim());
      currentPara = '';
      paraMaxW = 0;
    }
  };

  for (let i = 0; i < ordered.length; i++) {
    const curr = ordered[i];
    const prev = i > 0 ? ordered[i - 1] : null;
    const next = i + 1 < ordered.length ? ordered[i + 1] : null;

    const prevGap = prev ? curr.box.y - (prev.box.y + prev.box.height) : medH * 1.5;
    const nextGap = next ? next.box.y - (curr.box.y + curr.box.height) : medH * 1.5;

    const lineText = curr.text;

    if (BULLET_RE.test(lineText)) {
      flushPara();
      const normalizedBullet = lineText.replace(/^[•●◦▪]\s+/, '- ');
      blocks.push(normalizedBullet);
      continue;
    }

    if (isLikelyHeading(lineText, prevGap, nextGap, medH)) {
      flushPara();
      blocks.push(`## ${lineText}`);
      continue;
    }

    const columnJump =
      prev !== null &&
      Math.abs(curr.box.x - prev.box.x) > Math.max(medH * 3.2, Math.max(prev.box.width, curr.box.width) * 0.45) &&
      Math.abs(curr.box.y - prev.box.y) > medH * 0.4;

    const isNewParagraph = !prev || prevGap > medH * 0.95 || prevGap < -medH * 2 || columnJump;

    const prevEndsSentence = prev !== null && /[.!?]["'”)]?$/.test(prev.text.trim());
    const localMax = Math.max(paraMaxW, prev?.box.width || 0, curr.box.width);
    const keepSeparateLine =
      !isNewParagraph &&
      prev !== null &&
      (KEY_VALUE_RE.test(lineText) ||
        KEY_VALUE_RE.test(prev.text) ||
        (isStandaloneShortLabel(prev.text) && isStandaloneShortLabel(lineText)) ||
        (prevEndsSentence && prev.box.width < localMax * 0.78));

    if (isNewParagraph) {
      flushPara();
      currentPara = lineText;
      paraMaxW = curr.box.width;
    } else if (keepSeparateLine) {
      currentPara = currentPara ? `${currentPara}  \n${lineText}` : lineText;
      paraMaxW = Math.max(paraMaxW, curr.box.width);
    } else if (currentPara.endsWith('-') && /^[a-zà-ỹ]/i.test(lineText)) {
      currentPara = currentPara.slice(0, -1) + lineText;
      paraMaxW = Math.max(paraMaxW, curr.box.width);
    } else if (!currentPara) {
      currentPara = lineText;
      paraMaxW = curr.box.width;
    } else {
      currentPara = `${currentPara} ${lineText}`;
      paraMaxW = Math.max(paraMaxW, curr.box.width);
    }
  }

  flushPara();
  return blocks.join('\n\n').trim();
}

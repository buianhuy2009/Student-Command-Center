import { describe, it, expect } from 'vitest';
import { formatLectureSummaryMarkdown } from './lectureSummaryFormat';
import { formatOcrLinesToMarkdown } from './noteFormatter';
import { LOCAL_MODEL_CATALOG } from '../services/localAiConfig';

describe('formatLectureSummaryMarkdown', () => {
  it('breaks a dense wall of plain text into Overview and Key Points bullets', () => {
    const wall =
      'Linear algebra studies vector spaces and linear maps. Eigenvalues describe how a matrix stretches vectors along invariant directions. Determinants measure volume scaling and test invertibility. Orthogonal bases simplify projections and least squares.';
    const out = formatLectureSummaryMarkdown(wall);
    expect(out).toContain('### Overview');
    expect(out).toContain('### Key Points');
    expect(out).toContain('- Determinants measure volume scaling');
    expect(out).toContain('- Orthogonal bases simplify projections');
  });

  it('preserves structured headings and bullets while unwrapping markdown fences', () => {
    const raw = '```markdown\n### Core Idea\nDerivatives measure change.\n\n### Key Takeaways\n- **Rule:** Power rule\n```';
    const out = formatLectureSummaryMarkdown(raw);
    expect(out).not.toContain('```');
    expect(out).toContain('### Core Idea');
    expect(out).toContain('- **Rule:** Power rule');
  });
});

describe('formatOcrLinesToMarkdown & offline model catalog', () => {
  it('preserves line breaks for key-value handwritten lines instead of merging into one line', () => {
    const md = formatOcrLinesToMarkdown([
      { text: 'Name: Ariel', box: { x: 20, y: 50, width: 110, height: 20 } },
      { text: 'Simple: Ariel', box: { x: 20, y: 78, width: 112, height: 20 } },
      { text: 'Cursive: Ariel', box: { x: 20, y: 106, width: 120, height: 22 } },
      { text: 'Rate: ?/10', box: { x: 20, y: 136, width: 95, height: 20 } },
    ]);
    const lines = md.split('\n').map((l) => l.trim()).filter(Boolean);
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe('Name: Ariel');
    expect(lines[3]).toBe('Rate: ?/10');
  });

  it('configures Gemma 3 270M for offline summaries and PP-OCRv5 English for EN handwriting', () => {
    expect(LOCAL_MODEL_CATALOG.gemmaSummary.id).toBe('onnx-community/gemma-3-270m-it-ONNX');
    expect(LOCAL_MODEL_CATALOG.ocrHandwrittenEn.id).toBe('paddleocr-en-v5');
    expect(LOCAL_MODEL_CATALOG.ocrHandwrittenEn.urls[0]).toContain('/languages/english/rec.onnx');
  });
});

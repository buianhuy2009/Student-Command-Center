import { describe, it, expect } from 'vitest';
import { formatOcrLinesToMarkdown } from './noteFormatter';

describe('formatOcrLinesToMarkdown paragraph merging', () => {
  it('merges wrapped lines of a printed paragraph into a single flowing sentence block', () => {
    const md = formatOcrLinesToMarkdown([
      {
        text: 'intelligence demonstrated by machines to perform tasks that',
        box: { x: 40, y: 120, width: 310, height: 18 },
      },
      {
        text: 'typically require human intelligence, like understanding',
        box: { x: 40, y: 142, width: 295, height: 18 },
      },
      {
        text: 'language, recognizing patterns, or making decisions.',
        box: { x: 40, y: 164, width: 270, height: 18 },
      },
    ]);

    expect(md).toBe(
      'intelligence demonstrated by machines to perform tasks that typically require human intelligence, like understanding language, recognizing patterns, or making decisions.'
    );
  });

  it('keeps stacked standalone labels and years on separate lines while merging narrow paragraphs', () => {
    const md = formatOcrLinesToMarkdown([
      { text: 'Timeline of LLM Developments', box: { x: 40, y: 60, width: 240, height: 22 } },
      { text: '2017', box: { x: 40, y: 110, width: 42, height: 18 } },
      { text: '2023', box: { x: 40, y: 132, width: 42, height: 18 } },
      { text: 'Transformer architecture', box: { x: 40, y: 154, width: 170, height: 18 } },
      { text: 'ChatGPT', box: { x: 40, y: 176, width: 70, height: 18 } },
    ]);

    const lines = md.split('\n').map((l) => l.trim()).filter(Boolean);
    expect(lines).toContain('## Timeline of LLM Developments');
    expect(lines).toContain('2017');
    expect(lines).toContain('2023');
    expect(lines).toContain('ChatGPT');
  });

  it('repairs hyphenated line breaks across wrapped lines', () => {
    const md = formatOcrLinesToMarkdown([
      { text: 'Neural networks learn represen-', box: { x: 30, y: 40, width: 260, height: 20 } },
      { text: 'tations from labeled data.', box: { x: 30, y: 64, width: 210, height: 20 } },
    ]);
    expect(md).toBe('Neural networks learn representations from labeled data.');
  });
});

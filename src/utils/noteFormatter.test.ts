import { describe, expect, it } from 'vitest';
import { formatOcrLinesToMarkdown, sortLinesInReadingOrder, type OcrLineBox } from './noteFormatter';

describe('noteFormatter', () => {
  it('sorts lines in single-column reading order across Y-bands', () => {
    const lines: OcrLineBox[] = [
      { text: 'world', box: { x: 120, y: 12, width: 60, height: 20 } },
      { text: 'Hello', box: { x: 20, y: 10, width: 60, height: 20 } },
      { text: 'Second line', box: { x: 20, y: 45, width: 100, height: 20 } },
    ];
    const sorted = sortLinesInReadingOrder(lines);
    expect(sorted.map((l) => l.text)).toEqual(['Hello', 'world', 'Second line']);
  });

  it('detects 2-column layouts and reads left column before right column', () => {
    const lines: OcrLineBox[] = [
      { text: 'Left 1', box: { x: 20, y: 20, width: 150, height: 20 } },
      { text: 'Right 1', box: { x: 320, y: 22, width: 150, height: 20 } },
      { text: 'Left 2', box: { x: 20, y: 55, width: 150, height: 20 } },
      { text: 'Right 2', box: { x: 320, y: 57, width: 150, height: 20 } },
      { text: 'Left 3', box: { x: 20, y: 90, width: 150, height: 20 } },
      { text: 'Right 3', box: { x: 320, y: 92, width: 150, height: 20 } },
    ];
    const sorted = sortLinesInReadingOrder(lines);
    expect(sorted.map((l) => l.text)).toEqual([
      'Left 1',
      'Left 2',
      'Left 3',
      'Right 1',
      'Right 2',
      'Right 3',
    ]);
  });

  it('formats headings, bullets, hyphenated line wraps, and Vietnamese text cleanly', () => {
    const lines: OcrLineBox[] = [
      { text: 'CHƯƠNG 3: ĐỘNG LỰC HỌC', box: { x: 20, y: 10, width: 220, height: 22 } },
      { text: 'Định luật bảo toàn động-', box: { x: 20, y: 60, width: 240, height: 20 } },
      { text: 'lượng trong hệ cô lập .', box: { x: 20, y: 84, width: 200, height: 20 } },
      { text: '• Ý chính thứ nhất', box: { x: 20, y: 120, width: 180, height: 20 } },
      { text: '1. Ghi chú quan trọng', box: { x: 20, y: 150, width: 180, height: 20 } },
    ];
    const md = formatOcrLinesToMarkdown(lines);
    expect(md).toContain('## CHƯƠNG 3: ĐỘNG LỰC HỌC');
    expect(md).toContain('Định luật bảo toàn độnglượng trong hệ cô lập.');
    expect(md).toContain('- Ý chính thứ nhất');
    expect(md).toContain('1. Ghi chú quan trọng');
  });
});

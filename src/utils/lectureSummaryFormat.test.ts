import { describe, it, expect } from 'vitest';
import {
  cleanLectureTitle,
  formatLectureSummaryMarkdown,
  sanitizeAndValidateGemmaSummary,
} from './lectureSummaryFormat';
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

  it('configures Qwen3.5 0.8B for offline summaries and upgraded PP-OCRv5 + VietOCR models for Note Scanner', () => {
    expect(LOCAL_MODEL_CATALOG.gemmaSummary.id).toBe('onnx-community/Qwen3.5-0.8B-Text-ONNX');
    expect(LOCAL_MODEL_CATALOG.gemmaSummary.fallbackId).toBe('onnx-community/Qwen3-0.6B-ONNX-OPT');
    expect(LOCAL_MODEL_CATALOG.ocrDetector.urls[0]).toContain('PP-OCRv5_mobile_det_onnx');
    expect(LOCAL_MODEL_CATALOG.ocrPrinted.id).toBe('vietocr-transformer-w8');
    expect(LOCAL_MODEL_CATALOG.ocrHandwrittenVi.id).toBe('vietocr-transformer-fp16w');
    expect(LOCAL_MODEL_CATALOG.ocrHandwrittenEn.id).toBe('pp-ocrv5-mobile-rec-en');
    expect(LOCAL_MODEL_CATALOG.ocrHandwrittenEn.urls[0]).toContain('PP-OCRv5_mobile_rec_onnx');
  });
});

describe('sanitizeAndValidateGemmaSummary & cleanLectureTitle', () => {
  it('cleans downloader noise from lecture titles', () => {
    expect(
      cleanLectureTitle('YTSave.to_YouTube_Media_xxjJiJBF5kw_Toán-lớp-6-Cộng-trừ-số-nguyên_002_720p')
    ).toBe('Toán - lớp - 6 - Cộng - trừ - số - nguyên');
  });

  it('replaces leaked prompt templates and transcript echoes with a structured Vietnamese summary', () => {
    const broken = `Core Idea
1-2 short sentences explaining the main point.
Key Takeaways
Point 1: Concise note
Point 2: Concise note
Point 3: Concise note
Quick Review
2 short things to remember for an exam or quiz.
Lecture Title: YTSave.to_YouTube_Media_xxjJiJBF5kw_Toán-lớp-6-Cộng-trừ-số-nguyên_002_720p
Transcript: xin chào tất cả các con trong quá trình thầy dạy chúng ta phần số nguyên cộng trừ số nguyên thì có một số bạn bị lúng túng`;

    const segments = [
      { text: 'Hôm nay thầy hướng dẫn cách cộng trừ số nguyên với các ví dụ số nhỏ dễ hiểu.' },
      { text: 'Bảy trừ một bằng sáu nhưng một trừ bảy không trừ được theo cách tiểu học mà cho kết quả âm sáu.' },
      { text: 'Khi chuyển lên cấp hai, phép trừ số nhỏ cho số lớn sẽ cho ra số nguyên âm.' },
      { text: 'Cần ghi nhớ quy tắc dấu để làm bài kiểm tra chính xác.' },
    ];

    const repaired = sanitizeAndValidateGemmaSummary(
      broken,
      segments,
      'YTSave.to_YouTube_Media_xxjJiJBF5kw_Toán-lớp-6-Cộng-trừ-số-nguyên_002_720p',
      'vi'
    );

    expect(repaired).not.toContain('Point 1: Concise note');
    expect(repaired).not.toContain('YTSave.to');
    expect(repaired).not.toContain('Transcript:');
    expect(repaired).toContain('### Ý chính');
    expect(repaired).toContain('### Điểm chính');
    expect(repaired).toContain('### Ôn nhanh');
  });

  it('keeps genuine structured Gemma summaries untouched', () => {
    const valid = `### Ý chính\n\nBài giảng giải thích phép cộng trừ số nguyên âm và cách xử lý khi số bị trừ nhỏ hơn số trừ.\n\n### Điểm chính\n\n- Số nguyên âm xuất hiện khi lấy số nhỏ trừ đi số lớn.\n- Ví dụ: 1 trừ 7 bằng -6.\n\n### Ôn nhanh\n\n- Luôn xét dấu của hiệu dựa theo số có giá trị tuyệt đối lớn hơn.`;
    const out = sanitizeAndValidateGemmaSummary(
      valid,
      [{ text: 'Hôm nay học cộng trừ số nguyên.' }],
      'Toán lớp 6',
      'vi'
    );
    expect(out).toContain('Bài giảng giải thích phép cộng trừ số nguyên âm');
    expect(out).toContain('Ví dụ: 1 trừ 7 bằng -6');
  });

  it('catches foreign-script gibberish and <think> tags from local models', () => {
    const gibberish = '<think>reasoning...</think>Tơ cht hoạt động để khám phá kiến thức và kỹ năng sử dụng công cụ vี้. Yếu tố then้ือง cần thiết.';
    const segments = [
      { text: 'Hôm nay thầy hướng dẫn cộng trừ số nguyên lớp 6.' },
      { text: 'Khi trừ số nhỏ cho số lớn ta thu được số nguyên âm.' },
    ];
    const cleaned = sanitizeAndValidateGemmaSummary(gibberish, segments, 'Toán lớp 6', 'vi');
    expect(cleaned).not.toContain('vี้');
    expect(cleaned).not.toContain('<think>');
    expect(cleaned).toContain('### Ý chính');
    expect(cleaned).toContain('số nguyên');
  });
});

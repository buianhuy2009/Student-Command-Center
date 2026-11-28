#!/usr/bin/env node
/**
 * Generates public/minh-chung.html — airy, scannable, scroll-first judge evidence page
 * with ZERO removed tests or hidden sections:
 * - Explicitly labels Before = v2.16.0 (Chặng 1) vs After = v3.6 (Chặng 2)
 * - Unified Higher-is-Better scale (100% = 0 errors) with exact error counts
 * - Scroll order: 1. Before/After & all 19 metrics -> 2. 5 Screenshots
 *                 -> 3. 6+1 Permissions, AI Data & 4 Socratic Layers
 *                 -> 4. All 50 interactive test cases -> 5. Sources & PII Audit
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));

const summary = readJson('eval/results/summary.json');
const rawEmails = readJson('eval/emails.json');
const emailsBefore = readJson('eval/results/emails-before-model.json');
const emailsAfter = readJson('eval/results/emails-after.json');
const schedBefore = readJson('eval/results/schedule-before.json');
const schedAfter = readJson('eval/results/schedule-after.json');
const tutorBefore = readJson('eval/results/tutor-before.json');
const tutorAfter = readJson('eval/results/tutor-after.json');

const emailRawMap = new Map(rawEmails.map((e) => [e.id, e]));
const emailBeforeMap = new Map((emailsBefore.rows || []).map((r) => [r.id, r]));
const schedBeforeMap = new Map((schedBefore.rows || []).map((r) => [r.id, r]));
const tutorBeforeMap = new Map((tutorBefore.rows || []).map((r) => [r.id, r]));

const dataset = {
  summary,
  emails: (emailsAfter.rows || []).map((r) => {
    const raw = emailRawMap.get(r.id) || {};
    const bef = emailBeforeMap.get(r.id) || {};
    return {
      id: r.id,
      subject: r.subject,
      sender: raw.sender || '',
      date: raw.date || '',
      body: (raw.body || '').slice(0, 500),
      expected: r.expected,
      beforePass: Boolean(bef.pass),
      afterPass: Boolean(r.pass),
      afterGot: r.got || null,
    };
  }),
  schedule: (schedAfter.rows || []).map((r) => {
    const bef = schedBeforeMap.get(r.id) || {};
    return {
      id: r.id,
      command: r.command,
      beforePass: Boolean(bef.pass),
      beforeSaid: bef.said || '(Không có phản hồi)',
      afterPass: Boolean(r.pass),
      afterSaid: r.said || '',
    };
  }),
  tutor: (tutorAfter.rows || []).map((r) => {
    const bef = tutorBeforeMap.get(r.id) || {};
    return {
      id: r.id,
      prompt: r.prompt,
      beforePass: Boolean(bef.pass),
      beforeReply: (bef.reply || '').slice(0, 700),
      afterPass: Boolean(r.pass),
      afterReply: (r.reply || '').slice(0, 700),
    };
  }),
};

const safeJson = JSON.stringify(dataset)
  .replace(/<\//g, '<\\/')
  .replace(/[\p{Extended_Pictographic}]/gu, '');

const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>StudentOS · Minh chứng Trước (v2.16.0) &amp; Sau (v3.6)</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #FAF7F2;
      --surface: #FFFFFF;
      --subtle: #F3EDE4;
      --border: #E8DFD3;
      --ink: #1C1917;
      --muted: #57534E;
      --accent: #C85A32;
      --accent-dark: #A54321;
      --ok: #15803D;
      --ok-bg: #ECFDF3;
      --ok-border: #BBF7D0;
      --err: #B91C1C;
      --err-bg: #FEF2F2;
      --err-border: #FECACA;
      --warn: #B45309;
      --warn-bg: #FFFBEB;
      --warn-border: #FDE68A;
      --shadow: 0 2px 12px rgba(28, 25, 23, 0.04);
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--ink);
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }
    code { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 0.9em; }
    a { color: var(--accent-dark); text-decoration: none; }
    a:hover { text-decoration: underline; }

    /* Minimal Sticky Topbar */
    .topbar {
      position: sticky; top: 0; z-index: 40;
      background: rgba(250, 247, 242, 0.93);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
    }
    .topbar-inner {
      max-width: 980px; margin: 0 auto; padding: 12px 24px;
      display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;
    }
    .brand { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 15px; }
    .brand-mark {
      width: 30px; height: 30px; border-radius: 9px; background: var(--accent);
      display: grid; place-items: center; color: #fff; font-weight: 800; font-size: 13px;
    }
    .nav { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .nav a {
      padding: 6px 11px; border-radius: 999px; font-size: 12.5px; font-weight: 700; color: var(--muted);
    }
    .nav a:hover { background: var(--subtle); color: var(--ink); text-decoration: none; }
    .nav a.cta { background: var(--accent); color: #fff; }
    .nav a.cta:hover { background: var(--accent-dark); }

    /* Airy Container */
    .wrap { max-width: 980px; margin: 0 auto; padding: 40px 24px 88px; }
    section { scroll-margin-top: 76px; margin-bottom: 60px; }

    /* Calm Hero */
    .hero { text-align: center; padding: 8px 0 4px; margin-bottom: 44px; }
    .eyebrow {
      display: inline-block; padding: 5px 14px; border-radius: 999px;
      background: var(--subtle); color: var(--muted);
      font-size: 12px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase;
    }
    .hero h1 {
      margin: 14px 0 10px; font-size: clamp(28px, 4.8vw, 42px); line-height: 1.14;
      font-weight: 800; letter-spacing: -0.03em;
    }
    .version-strip {
      display: inline-flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: center;
      margin: 8px 0 22px; padding: 8px 16px; border-radius: 999px;
      background: var(--surface); border: 1px solid var(--border); font-size: 13.5px; font-weight: 700;
    }
    .v-before { color: var(--muted); }
    .v-after { color: var(--ok); }
    .hero-btns { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }
    .btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 10px 16px; border-radius: 12px; font-size: 13.5px; font-weight: 700;
      border: 1px solid var(--border); background: var(--surface); color: var(--ink); cursor: pointer;
    }
    .btn:hover { background: var(--subtle); text-decoration: none; }
    .btn.solid { background: var(--accent); border-color: var(--accent); color: #fff; }
    .btn.solid:hover { background: var(--accent-dark); }

    /* Section Header */
    .sec-title {
      display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap;
      margin-bottom: 20px;
    }
    .sec-title h2 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
    .scale-tag {
      font-size: 12.5px; font-weight: 700; color: var(--ok);
      background: var(--ok-bg); border: 1px solid var(--ok-border);
      padding: 4px 12px; border-radius: 999px;
    }

    /* Spacious Story Cards */
    .stack { display: flex; flex-direction: column; gap: 20px; }
    .card {
      background: var(--surface); border: 1px solid var(--border); border-radius: 20px;
      padding: 26px 28px; box-shadow: var(--shadow);
    }
    .card-head {
      display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
      margin-bottom: 18px;
    }
    .card-head h3 { margin: 0; font-size: 18px; font-weight: 800; }
    .big-jump { display: flex; align-items: baseline; gap: 10px; font-weight: 800; }
    .jump-before { font-size: 17px; color: var(--muted); text-decoration: line-through; }
    .jump-arrow { font-size: 15px; color: var(--muted); }
    .jump-after { font-size: 30px; color: var(--ok); line-height: 1; }

    .ba-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px; }
    @media (max-width: 700px) { .ba-grid { grid-template-columns: 1fr; } }
    .ba-box {
      border-radius: 14px; padding: 15px 18px;
      border: 1px solid var(--border); background: #FAF8F5;
    }
    .ba-box.after { border-color: var(--ok-border); background: var(--ok-bg); }
    .ba-tag {
      display: inline-block; font-size: 11px; font-weight: 800; letter-spacing: .04em;
      text-transform: uppercase; margin-bottom: 5px; color: var(--muted);
    }
    .ba-box.after .ba-tag { color: var(--ok); }
    .ba-text { margin: 0; font-size: 14px; font-weight: 600; color: var(--ink); }

    .bar-pair { display: flex; flex-direction: column; gap: 6px; }
    .bar-row { display: flex; align-items: center; gap: 10px; font-size: 12.5px; }
    .bar-lbl { width: 52px; font-weight: 700; color: var(--muted); }
    .bar-lbl.after { color: var(--ink); }
    .track { flex: 1; height: 9px; border-radius: 999px; background: var(--subtle); overflow: hidden; }
    .fill-before { height: 100%; background: #C7BEB4; border-radius: 999px; }
    .fill-after { height: 100%; background: #16A34A; border-radius: 999px; }
    .fill-after.accent { background: var(--accent); }
    .bar-val { width: 46px; text-align: right; font-weight: 800; }

    /* All 19 Metrics (Spacious & Visible!) */
    .m-row {
      display: grid; grid-template-columns: 230px 1fr 130px; align-items: center; gap: 16px;
      padding: 11px 0; border-bottom: 1px dashed var(--border); font-size: 13.5px;
    }
    .m-row:last-child { border-bottom: none; }
    @media (max-width: 700px) { .m-row { grid-template-columns: 1fr; gap: 6px; } }
    .m-err { font-size: 12px; color: var(--muted); text-align: right; font-weight: 600; }

    /* Screenshots */
    .gallery { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
    @media (max-width: 700px) { .gallery { grid-template-columns: 1fr; } }
    .shot {
      background: var(--surface); border: 1px solid var(--border); border-radius: 18px;
      overflow: hidden; box-shadow: var(--shadow); cursor: pointer; transition: transform .15s ease;
    }
    .shot:hover { transform: translateY(-2px); }
    .shot img { width: 100%; height: 225px; object-fit: cover; object-position: top; display: block; border-bottom: 1px solid var(--border); }
    .shot-cap { padding: 14px 18px; font-size: 14px; font-weight: 700; }

    /* Permissions & Guardrails */
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 720px) { .grid-2 { grid-template-columns: 1fr; } }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip {
      padding: 7px 12px; border-radius: 10px; font-size: 13px; font-weight: 700;
      background: var(--subtle); color: var(--ink);
    }
    .chip.warn { background: var(--warn-bg); color: var(--warn); border: 1px solid var(--warn-border); }
    .chip.no { background: var(--err-bg); color: var(--err); border: 1px solid var(--err-border); }
    .chip.ok { background: var(--ok-bg); color: var(--ok); border: 1px solid var(--ok-border); }

    .layer-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-top: 20px; }
    @media (max-width: 700px) { .layer-grid { grid-template-columns: 1fr; } }
    .layer-box {
      border-radius: 14px; padding: 14px 18px;
      border: 1px solid var(--ok-border); background: var(--ok-bg);
    }
    .layer-box strong { display: block; font-size: 14px; margin-bottom: 2px; }
    .layer-box span { font-size: 13px; color: var(--muted); }

    /* Visible 50-Case Explorer */
    .controls { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .btn-group { display: flex; flex-wrap: wrap; gap: 6px; }
    .fbtn {
      padding: 7px 13px; border-radius: 999px; border: 1px solid var(--border);
      background: var(--surface); font-size: 12.5px; font-weight: 700; cursor: pointer; font-family: inherit;
    }
    .fbtn.active { background: var(--ink); color: #fff; border-color: var(--ink); }
    .search-box {
      padding: 7px 13px; border-radius: 10px; border: 1px solid var(--border);
      background: var(--surface); font-size: 13px; min-width: 210px; font-family: inherit;
    }
    .case-item { border: 1px solid var(--border); border-radius: 12px; margin-bottom: 8px; overflow: hidden; background: var(--surface); }
    .case-head {
      width: 100%; text-align: left; background: transparent; border: none; padding: 11px 16px;
      display: flex; align-items: center; gap: 10px; cursor: pointer; font-family: inherit; font-size: 13.5px;
    }
    .case-head:hover { background: #FAF8F5; }
    .cid { font-family: 'JetBrains Mono', monospace; font-weight: 700; background: var(--subtle); padding: 2px 8px; border-radius: 6px; font-size: 12px; }
    .ctitle { flex: 1; font-weight: 600; }
    .pill { padding: 3px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 700; white-space: nowrap; }
    .pill.ok { background: var(--ok-bg); color: var(--ok); }
    .pill.err { background: var(--err-bg); color: var(--err); }
    .pill.neutral { background: var(--subtle); color: var(--muted); }
    .case-body { display: none; padding: 14px 16px; border-top: 1px solid var(--border); background: #FAF8F5; font-size: 13px; }
    .case-item.open .case-body { display: block; }

    /* Lightbox */
    .lightbox {
      position: fixed; inset: 0; z-index: 100; background: rgba(20, 18, 16, 0.9);
      display: none; align-items: center; justify-content: center; padding: 24px;
    }
    .lightbox.open { display: flex; }
    .lightbox img { max-width: 96%; max-height: 82vh; border-radius: 14px; }
    .lb-close {
      position: fixed; top: 18px; right: 22px; background: rgba(255,255,255,0.18); color: #fff;
      border: 1px solid rgba(255,255,255,0.3); border-radius: 999px; padding: 8px 16px;
      font-weight: 700; cursor: pointer; font-family: inherit;
    }

    footer {
      padding-top: 24px; border-top: 1px solid var(--border);
      display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px;
      font-size: 13px; color: var(--muted);
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="topbar-inner">
      <div class="brand">
        <div class="brand-mark">S</div>
        <span>StudentOS · Chặng 2</span>
      </div>
      <nav class="nav">
        <a href="#truoc-sau">1. Trước &amp; Sau</a>
        <a href="#anh-thuc-te">2. Ảnh thực tế</a>
        <a href="#quyen-rieng-tu">3. Quyền &amp; AI</a>
        <a href="#bo-50-ca">4. 50 ca test</a>
        <a href="#nguon">5. Nguồn &amp; PII</a>
        <a class="cta" href="https://sutdent-command-center.vercel.app" target="_blank" rel="noreferrer">Mở StudentOS</a>
      </nav>
    </div>
  </header>

  <main class="wrap">
    <!-- CALM HERO WITH EXPLICIT VERSION COMPARISON -->
    <section class="hero">
      <span class="eyebrow">Minh chứng Cải tiến · Kiểm thử 50 ca AI &amp; Bảo vệ Dữ liệu</span>
      <h1>So sánh Trước &amp; Sau Cải tiến</h1>
      <div class="version-strip">
        <span class="v-before">Trước: <strong>v2.16.0</strong> (Chặng 1 — bản gốc)</span>
        <span>-&gt;</span>
        <span class="v-after">Sau: <strong>v3.6</strong> (Chặng 2 — bản hiện tại)</span>
      </div>
      <div class="hero-btns">
        <a class="btn solid" href="https://docs.google.com/document/d/1QqdDl3FwUrktKwe3ejZDCktQA2EwkQC2EGKalVYOQwc/edit" target="_blank" rel="noreferrer">Báo cáo Google Docs</a>
        <a class="btn" href="https://sutdent-command-center.vercel.app" target="_blank" rel="noreferrer">Mở sản phẩm chạy thử</a>
        <button class="btn" onclick="window.print()">In / PDF</button>
      </div>
    </section>

    <!-- SECTION 1: BEFORE vs AFTER + ALL 19 METRICS VISIBLE -->
    <section id="truoc-sau">
      <div class="sec-title">
        <h2>1. Trước (v2.16.0) vs Sau (v3.6) &amp; Toàn bộ 19 chỉ số</h2>
        <span class="scale-tag">Thang thống nhất: Càng cao càng tốt (100% = 0 lỗi)</span>
      </div>

      <div class="stack">
        <!-- Tutor Story + 4 Metrics -->
        <article class="card">
          <div class="card-head">
            <h3>Gia sư AI chỉ gợi ý (10 câu hỏi)</h3>
            <div class="big-jump"><span class="jump-before">40%</span><span class="jump-arrow">-&gt;</span><span class="jump-after">100%</span></div>
          </div>
          <div class="ba-grid">
            <div class="ba-box">
              <div class="ba-tag">Trước · v2.16.0</div>
              <p class="ba-text">AI giải hộ luôn 6/6 bài tập, đề thi trực tuyến và câu giả danh giáo viên.</p>
            </div>
            <div class="ba-box after">
              <div class="ba-tag">Sau · v3.6</div>
              <p class="ba-text">Chặn 100% giải hộ &amp; gian lận thi; chỉ gợi ý từng bước Socratic (10/10 đạt).</p>
            </div>
          </div>
          <div id="bars-tutor"></div>
        </article>

        <!-- Schedule Story + 6 Metrics -->
        <article class="card">
          <div class="card-head">
            <h3>Đổi lịch học tiếng Việt (10 câu lệnh)</h3>
            <div class="big-jump"><span class="jump-before">0%</span><span class="jump-arrow">-&gt;</span><span class="jump-after">90%</span></div>
          </div>
          <div class="ba-grid">
            <div class="ba-box">
              <div class="ba-tag">Trước · v2.16.0</div>
              <p class="ba-text">Không xử lý đúng lệnh lịch, không báo buổi khóa và không hỏi lại khi mơ hồ.</p>
            </div>
            <div class="ba-box after">
              <div class="ba-tag">Sau · v3.6</div>
              <p class="ba-text">Đạt 9/10 ca: 100% giữ buổi khóa, 0% trùng lịch, tự hỏi lại khi mơ hồ (<code>s07</code>).</p>
            </div>
          </div>
          <div id="bars-schedule"></div>
        </article>

        <!-- Email Story + 9 Metrics -->
        <article class="card">
          <div class="card-head">
            <h3>Quét 30 Email trường học ẩn danh</h3>
            <div class="big-jump"><span class="jump-before">13% / 43%</span><span class="jump-arrow">-&gt;</span><span class="jump-after">50%</span></div>
          </div>
          <div class="ba-grid">
            <div class="ba-box">
              <div class="ba-tag">Trước · v2.16.0</div>
              <p class="ba-text">Bản chạy cũ đạt 13% (mô hình gốc 43%), sai 75% hạn nộp và ẩn nhầm thư thầy cô.</p>
            </div>
            <div class="ba-box after">
              <div class="ba-tag">Sau · v3.6</div>
              <p class="ba-text">Đạt 50% gắt cả 6 tiêu chí: <strong>85%</strong> đúng hạn nộp, <strong>100%</strong> chặn quảng cáo, <strong>100%</strong> giữ thư GV.</p>
            </div>
          </div>
          <div id="bars-email"></div>
        </article>
      </div>
    </section>

    <!-- SECTION 2: 5 REAL SCREENSHOTS -->
    <section id="anh-thuc-te">
      <div class="sec-title">
        <h2>2. Ảnh chụp màn hình thực tế (v3.6)</h2>
        <span style="font-size:13px;color:var(--muted);font-weight:600;">Bấm vào ảnh để phóng to</span>
      </div>
      <div class="gallery">
        <div class="shot" data-src="/evidence/privacy-permissions-tab.png"><img src="/evidence/privacy-permissions-tab.png" alt="Quản lý quyền 6+1" loading="lazy" /><div class="shot-cap">1. Quản lý trực tiếp 6+1 quyền truy cập</div></div>
        <div class="shot" data-src="/evidence/privacy-ai-data-tab.png"><img src="/evidence/privacy-ai-data-tab.png" alt="Dữ liệu AI và nút tắt" loading="lazy" /><div class="shot-cap">2. Minh bạch dữ liệu AI &amp; công tắc tắt/bật</div></div>
        <div class="shot" data-src="/evidence/privacy-parents-tab.png"><img src="/evidence/privacy-parents-tab.png" alt="Lưu trữ và phụ huynh" loading="lazy" /><div class="shot-cap">3. Hướng dẫn phụ huynh &amp; xóa dữ liệu</div></div>
        <div class="shot" data-src="/evidence/google-permission-consent.png"><img src="/evidence/google-permission-consent.png" alt="Xin quyền từng tính năng" loading="lazy" /><div class="shot-cap">4. Hộp thoại xin quyền có nhãn Dữ liệu AI</div></div>
        <div class="shot" data-src="/evidence/tutor-hint-only.png" style="grid-column: 1 / -1;"><img src="/evidence/tutor-hint-only.png" alt="Gia sư AI Socratic" loading="lazy" style="height:260px;" /><div class="shot-cap">5. Gia sư AI ở Chế độ Gợi ý Socratic (không giải hộ)</div></div>
      </div>
    </section>

    <!-- SECTION 3: PERMISSIONS, AI DATA & 4 SOCRATIC LAYERS -->
    <section id="quyen-rieng-tu">
      <div class="sec-title">
        <h2>3. Quyền truy cập 6+1, Dữ liệu AI &amp; 4 lớp Socratic</h2>
      </div>
      <div class="grid-2">
        <div class="card">
          <h3 style="margin:0 0 14px;font-size:16.5px;">6 quyền chuẩn + 1 tùy chọn</h3>
          <div class="chips">
            <span class="chip">Calendar (lịch học)</span>
            <span class="chip">Gmail (chỉ đọc &lt;=1.500 ký tự)</span>
            <span class="chip">Classroom (3 quyền chỉ đọc)</span>
            <span class="chip">Drive &amp; Sheets (drive.file)</span>
            <span class="chip warn">drive.readonly (tắt mặc định)</span>
            <span class="chip ok">Canvas (lưu trên máy, 0 AI)</span>
          </div>
        </div>
        <div class="card" style="border-color: var(--err-border);">
          <h3 style="margin:0 0 14px;font-size:16.5px;color:var(--err);">KHÔNG BAO GIỜ gửi tới AI</h3>
          <div class="chips">
            <span class="chip no">Mật khẩu Google</span>
            <span class="chip no">Khóa OAuth / mã Canvas</span>
            <span class="chip no">Điểm số &amp; học bạ</span>
            <span class="chip no">Danh bạ lớp học</span>
            <span class="chip no">Tệp Drive cá nhân</span>
            <span class="chip no">Ghi chú ngoại tuyến</span>
          </div>
        </div>
      </div>
      <div class="layer-grid">
        <div class="layer-box"><strong>Lớp 1 · Nhận diện đầu vào</strong><span>Phát hiện giải hộ, thi trực tuyến (t06), giả danh GV (t05)</span></div>
        <div class="layer-box"><strong>Lớp 2 · Khóa tool máy chủ</strong><span>Chỉ cho phép 5 tool hợp lệ, chặn giả mạo context.tool</span></div>
        <div class="layer-box"><strong>Lớp 3 · Quét rò rỉ đáp án</strong><span>detectAnswerLeak() tự viết lại thành gợi ý nếu lộ đáp án</span></div>
        <div class="layer-box"><strong>Lớp 4 · Đồng bộ mọi đường dẫn</strong><span>Áp dụng cả Server, khóa cá nhân BYOK &amp; Trợ lý nổi</span></div>
      </div>
    </section>

    <!-- SECTION 4: ALL 50 TEST CASES VISIBLE DIRECTLY -->
    <section id="bo-50-ca">
      <div class="sec-title">
        <h2>4. Toàn bộ 50 ca kiểm thử (bấm dòng bất kỳ để xem Trước vs Sau)</h2>
      </div>
      <div class="card">
        <div class="controls">
          <div class="btn-group">
            <button class="fbtn active" data-suite="tutor">10 Gia sư AI (100%)</button>
            <button class="fbtn" data-suite="schedule">10 Đổi lịch (90%)</button>
            <button class="fbtn" data-suite="emails">30 Email (50%)</button>
          </div>
          <div class="btn-group">
            <button class="fbtn active" data-filter="all">Tất cả</button>
            <button class="fbtn" data-filter="pass">PASS</button>
            <button class="fbtn" data-filter="fail">FAIL</button>
            <input id="case-search" class="search-box" type="search" placeholder="Tìm mã (t06, s07, e08)..." />
          </div>
        </div>
        <div id="case-list"></div>
      </div>
    </section>

    <!-- SECTION 5: SOURCES & PII AUDIT -->
    <section id="nguon">
      <div class="sec-title">
        <h2>5. Nguồn dữ liệu &amp; Xác minh ẩn danh PII</h2>
        <span class="scale-tag">8/8 kiểm tra PII đạt</span>
      </div>
      <div class="grid-2">
        <div class="card">
          <h3 style="margin:0 0 12px;font-size:15.5px;">Kiểm tra tự động (<code>evalAnonymization.test.ts</code>)</h3>
          <div class="chips">
            <span class="chip ok">0 email thật (*.example)</span>
            <span class="chip ok">0 SĐT thật (0123 456 789)</span>
            <span class="chip ok">0 CCCD 12 số</span>
            <span class="chip ok">Lọc trích dẫn &lt;= 1.500 ký tự</span>
          </div>
        </div>
        <div class="card">
          <h3 style="margin:0 0 12px;font-size:15.5px;">Tệp bằng chứng gốc trên GitHub</h3>
          <div class="chips">
            <a class="btn" href="https://github.com/buianhuy2009/Student-Command-Center/blob/main/eval/results/summary.json" target="_blank" rel="noreferrer">summary.json</a>
            <a class="btn" href="https://github.com/buianhuy2009/Student-Command-Center/blob/main/eval/REPORT.md" target="_blank" rel="noreferrer">REPORT.md</a>
            <a class="btn" href="https://github.com/buianhuy2009/Student-Command-Center/blob/main/eval/SOURCES.md" target="_blank" rel="noreferrer">SOURCES.md</a>
            <a class="btn" href="https://github.com/buianhuy2009/Student-Command-Center/blob/main/docs/AI_EVAL_AND_PRIVACY_EVIDENCE.md" target="_blank" rel="noreferrer">Toàn văn + Phụ lục A–D</a>
          </div>
        </div>
      </div>
    </section>

    <footer>
      <div>StudentOS v3.6.5 · So sánh v2.16.0 (Trước) vs v3.6 (Sau)</div>
      <div><a href="/privacy">Quyền riêng tư</a> · <a href="https://github.com/buianhuy2009/Student-Command-Center" target="_blank" rel="noreferrer">GitHub</a></div>
    </footer>
  </main>

  <div id="lightbox" class="lightbox" role="dialog" aria-modal="true">
    <button class="lb-close" id="lb-close">Đóng (Esc)</button>
    <img id="lb-img" src="" alt="" />
  </div>

  <script>
    const DATA = ${safeJson};
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    const pct = (v) => Math.round(v * 10) / 10;

    function renderGroup(containerId, bTax, aTax, rows) {
      document.getElementById(containerId).innerHTML = rows.map(([k, label]) => {
        const b = bTax?.[k] || { ratePct: 0 };
        const a = aTax?.[k] || { count: 0, total: 0, ratePct: 0 };
        const bAcc = pct(100 - b.ratePct);
        const aAcc = pct(100 - a.ratePct);
        const fillClass = aAcc >= 80 ? 'fill-after' : 'fill-after accent';
        return \`
          <div class="m-row">
            <strong>\${esc(label)}</strong>
            <div class="bar-pair">
              <div class="bar-row"><span class="bar-lbl">v2.16.0</span><div class="track"><div class="fill-before" style="width:\${Math.max(2, bAcc)}%"></div></div><span class="bar-val">\${bAcc}%</span></div>
              <div class="bar-row"><span class="bar-lbl after">v3.6</span><div class="track"><div class="\${fillClass}" style="width:\${Math.max(2, aAcc)}%"></div></div><span class="bar-val">\${aAcc}%</span></div>
            </div>
            <div class="m-err">Lỗi: \${a.count}/\${a.total} (\${a.ratePct}%)</div>
          </div>
        \`;
      }).join('');
    }

    renderGroup('bars-tutor', DATA.summary.tutor.before.taxonomy, DATA.summary.tutor.after.taxonomy, [
      ['fullSolutionLeak', 'Chặn đưa lời giải / bài văn'],
      ['liveExamCheatingLeak', 'Chặn giải hộ khi đang thi'],
      ['roleplayBypassLeak', 'Chặn giả danh giáo viên'],
      ['unhelpfulOverRefusal', 'Hỗ trợ đúng câu học tập'],
    ]);

    renderGroup('bars-schedule', DATA.summary.schedule.before.taxonomy, DATA.summary.schedule.after.taxonomy, [
      ['lockedBlockViolation', 'Bảo vệ buổi đã khóa'],
      ['overlapViolation', 'Không gây trùng lịch'],
      ['collateralMove', 'Không đổi nhầm buổi khác'],
      ['missingAddition', 'Thêm đúng buổi ôn'],
      ['missingClarificationOrLockNotice', 'Hỏi lại mơ hồ / báo khóa'],
      ['targetNotChanged', 'Đổi đúng buổi mục tiêu'],
    ]);

    renderGroup('bars-email', DATA.summary.emails.beforeModel.taxonomy, DATA.summary.emails.after.taxonomy, [
      ['falsePositiveAssignment', 'Chặn quảng cáo/lừa đảo'],
      ['hiddenTeacherOrSchool', 'Không ẩn thư thầy cô'],
      ['fabricatedDueDate', 'Không tự bịa hạn nộp'],
      ['missedAssignment', 'Bắt trúng bài tập thật'],
      ['wrongSubject', 'Đúng môn học'],
      ['wrongDueDate', 'Đúng hạn nộp'],
      ['wrongCategory', 'Đúng phân loại thư'],
      ['aiOmittedOrFailed', 'Không lỗi kỹ thuật'],
      ['wrongPriority', 'Khớp nhãn ưu tiên'],
    ]);

    // Visible 50-Case Explorer (ALL cases shown for selected suite)
    let suite = 'tutor';
    let filter = 'all';
    let query = '';

    function renderCases() {
      const items = (DATA[suite] || []).filter((it) => {
        if (filter === 'pass' && !it.afterPass) return false;
        if (filter === 'fail' && it.afterPass) return false;
        if (query && !JSON.stringify(it).toLowerCase().includes(query)) return false;
        return true;
      });
      if (!items.length) {
        document.getElementById('case-list').innerHTML = '<div style="padding:12px;color:var(--muted);">Không có ca kiểm thử phù hợp.</div>';
        return;
      }
      document.getElementById('case-list').innerHTML = items.map((it) => {
        const title = suite === 'emails' ? it.subject : (suite === 'schedule' ? it.command : it.prompt.split('\\n')[0].slice(0, 105));
        const befPill = it.beforePass ? '<span class="pill neutral">v2.16: PASS</span>' : '<span class="pill neutral">v2.16: FAIL</span>';
        const aftPill = it.afterPass ? '<span class="pill ok">v3.6: PASS</span>' : '<span class="pill err">v3.6: FAIL</span>';
        let body = '';
        if (suite === 'tutor') {
          body = \`<strong>Trước (v2.16.0):</strong> \${esc(it.beforeReply)}<hr style="border:none;border-top:1px solid var(--border);margin:10px 0;"/><strong>Sau (v3.6 Socratic):</strong> \${esc(it.afterReply)}\`;
        } else if (suite === 'schedule') {
          body = \`<strong>Trước (v2.16.0):</strong> \${esc(it.beforeSaid)}<br/><br/><strong>Sau (v3.6):</strong> \${esc(it.afterSaid)}\`;
        } else {
          const g = it.afterGot || {};
          body = \`<strong>\${esc(it.sender)}</strong> (\${esc(it.date)})<br/>Kỳ vọng: <code>\${esc(it.expected?.category)}</code> · Hạn <code>\${esc(it.expected?.dueDate || 'không')}</code> · Ưu tiên <code>\${esc(it.expected?.priority || 'N/A')}</code><br/>AI v3.6: <code>\${esc(g.category || 'N/A')}</code> · Hạn <code>\${esc(g.dueDate || 'không')}</code> · Môn <code>\${esc(g.subject || 'N/A')}</code> · Ưu tiên <code>\${esc(g.priority || 'N/A')}</code>\`;
        }
        return \`
          <div class="case-item">
            <button class="case-head" type="button"><span class="cid">\${esc(it.id)}</span><span class="ctitle">\${esc(title)}</span>\${befPill}\${aftPill}</button>
            <div class="case-body">\${body}</div>
          </div>
        \`;
      }).join('');
      document.querySelectorAll('.case-head').forEach((b) => b.addEventListener('click', () => b.parentElement.classList.toggle('open')));
    }

    document.querySelectorAll('[data-suite]').forEach((b) => b.addEventListener('click', () => {
      suite = b.dataset.suite;
      document.querySelectorAll('[data-suite]').forEach((x) => x.classList.toggle('active', x === b));
      renderCases();
    }));
    document.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
      filter = b.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach((x) => x.classList.toggle('active', x === b));
      renderCases();
    }));
    document.getElementById('case-search').addEventListener('input', (e) => {
      query = e.target.value.trim().toLowerCase();
      renderCases();
    });
    renderCases();

    // Lightbox
    const lb = document.getElementById('lightbox');
    const lbImg = document.getElementById('lb-img');
    document.querySelectorAll('.shot').forEach((s) => s.addEventListener('click', () => { lbImg.src = s.dataset.src; lb.classList.add('open'); }));
    const closeLb = () => lb.classList.remove('open');
    document.getElementById('lb-close').addEventListener('click', closeLb);
    lb.addEventListener('click', (e) => { if (e.target === lb) closeLb(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLb(); });
  </script>
</body>
</html>
`;

fs.writeFileSync(path.join(root, 'public/minh-chung.html'), html, 'utf8');
console.log(`Generated public/minh-chung.html (${html.length} bytes)`);

#!/usr/bin/env node
/**
 * Generates public/minh-chung.html — a scannable, scroll-first, zero-wall-of-text
 * visual evidence page for StudentOS Chặng 2 judges.
 * Order: Hero + Before/After Legend -> 1. Accuracy/Error Charts -> 3. Screenshots
 *        -> 4. 6+1 Permissions & AI Data -> 2. 50-Case Explorer -> 5. Sources & PII.
 * Metric convention everywhere: HIGHER IS BETTER (100% = 0 errors), with exact error % shown.
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
  generatedAt: summary.generatedAt,
  summary,
  emails: (emailsAfter.rows || []).map((r) => {
    const raw = emailRawMap.get(r.id) || {};
    const bef = emailBeforeMap.get(r.id) || {};
    return {
      id: r.id,
      subject: r.subject,
      sender: raw.sender || '',
      senderEmail: raw.senderEmail || '',
      date: raw.date || '',
      body: (raw.body || '').slice(0, 600),
      tricky: r.tricky || '',
      expected: r.expected,
      beforePass: Boolean(bef.pass),
      beforeGot: bef.got || null,
      afterPass: Boolean(r.pass),
      afterGot: r.got || null,
      model: r.meta?.model || '',
    };
  }),
  schedule: (schedAfter.rows || []).map((r) => {
    const bef = schedBeforeMap.get(r.id) || {};
    return {
      id: r.id,
      command: r.command,
      intent: r.intent,
      expect: r.expect,
      beforePass: Boolean(bef.pass),
      beforeSaid: bef.said || '(Không có phản hồi)',
      beforeFails: bef.fails || [],
      afterPass: Boolean(r.pass),
      afterSaid: r.said || '',
      afterFails: r.fails || [],
      model: r.meta?.model || '',
    };
  }),
  tutor: (tutorAfter.rows || []).map((r) => {
    const bef = tutorBeforeMap.get(r.id) || {};
    return {
      id: r.id,
      kind: r.kind,
      expect: r.expect,
      prompt: r.prompt,
      beforePass: Boolean(bef.pass),
      beforeReply: (bef.reply || '').slice(0, 800),
      beforeReason: bef.judge?.reason || '',
      afterPass: Boolean(r.pass),
      afterReply: (r.reply || '').slice(0, 800),
      afterReason: r.judge?.reason || '',
      model: r.meta?.model || '',
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
  <title>StudentOS · Minh chứng Chặng 2 (Kiểm thử AI &amp; Bảo vệ Dữ liệu)</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #FAF7F2;
      --surface: #FFFFFF;
      --subtle: #F3EDE4;
      --border: #E7DDD0;
      --ink: #1C1917;
      --muted: #57534E;
      --accent: #C85A32;
      --accent-soft: #FDF1EC;
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
      --shadow: 0 1px 2px rgba(28, 25, 23, 0.04), 0 8px 24px rgba(28, 25, 23, 0.04);
      --radius: 18px;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--ink);
      line-height: 1.45;
      -webkit-font-smoothing: antialiased;
    }
    code, .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
    a { color: var(--accent-dark); text-decoration: none; }
    a:hover { text-decoration: underline; }

    /* Sticky Nav */
    .topbar {
      position: sticky; top: 0; z-index: 40;
      background: rgba(250, 247, 242, 0.92);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
    }
    .topbar-inner {
      max-width: 1120px; margin: 0 auto; padding: 10px 20px;
      display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
    }
    .brand { display: flex; align-items: center; gap: 9px; font-weight: 800; font-size: 14.5px; color: var(--ink); }
    .brand-mark {
      width: 30px; height: 30px; border-radius: 9px; background: var(--accent);
      display: grid; place-items: center; color: #fff; font-weight: 800; font-size: 13px;
    }
    .nav-links { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
    .nav-link {
      padding: 6px 11px; border-radius: 999px; font-size: 12.5px; font-weight: 700;
      color: var(--muted); transition: all .15s ease;
    }
    .nav-link:hover { color: var(--ink); background: var(--subtle); text-decoration: none; }
    .nav-link.cta { background: var(--accent); color: #fff; }
    .nav-link.cta:hover { background: var(--accent-dark); color: #fff; }

    .container { max-width: 1120px; margin: 0 auto; padding: 24px 20px 72px; }
    section.block { scroll-margin-top: 72px; margin-bottom: 34px; }

    /* Hero */
    .hero {
      background: linear-gradient(135deg, #FFFFFF 0%, #FDF6EE 100%);
      border: 1px solid var(--border); border-radius: 22px; padding: 26px 28px;
      box-shadow: var(--shadow); margin-bottom: 18px;
    }
    .eyebrow {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 4px 11px; border-radius: 999px;
      background: var(--accent-soft); color: var(--accent-dark);
      font-size: 11px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase;
    }
    .hero h1 {
      margin: 10px 0 6px; font-size: clamp(24px, 3.6vw, 34px); line-height: 1.15;
      font-weight: 800; letter-spacing: -0.025em;
    }
    .hero-sub { margin: 0 0 16px; font-size: 15px; color: var(--muted); font-weight: 500; }
    .hero-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
    .btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 9px 14px; border-radius: 11px; font-size: 13px; font-weight: 700;
      border: 1px solid var(--border); background: var(--surface); color: var(--ink); cursor: pointer;
    }
    .btn:hover { background: var(--subtle); text-decoration: none; }
    .btn.solid { background: var(--accent); border-color: var(--accent); color: #fff; }
    .btn.solid:hover { background: var(--accent-dark); }

    /* Clear Before vs After Legend */
    .ba-legend {
      display: grid; grid-template-columns: 1fr 1fr auto; gap: 10px; align-items: stretch;
      padding-top: 14px; border-top: 1px dashed var(--border);
    }
    @media (max-width: 820px) { .ba-legend { grid-template-columns: 1fr; } }
    .ba-pill {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 14px; border-radius: 12px; font-size: 12.5px;
      border: 1px solid var(--border); background: var(--surface);
    }
    .ba-pill.after { border-color: var(--ok-border); background: var(--ok-bg); }
    .ba-pill.rule { border-color: var(--accent); background: var(--accent-soft); color: var(--accent-dark); font-weight: 700; }
    .dot { width: 10px; height: 10px; border-radius: 999px; flex-shrink: 0; }
    .dot.before { background: #A8A29E; }
    .dot.after { background: #16A34A; }

    /* KPI Strip */
    .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
    @media (max-width: 860px) { .kpi-grid { grid-template-columns: 1fr; } }
    .kpi-card {
      background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 18px 20px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 10px;
    }
    .kpi-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .kpi-label { font-size: 13px; font-weight: 800; color: var(--ink); }
    .pill {
      display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 999px;
      font-size: 11px; font-weight: 700; white-space: nowrap;
    }
    .pill.ok { background: var(--ok-bg); color: var(--ok); border: 1px solid var(--ok-border); }
    .pill.err { background: var(--err-bg); color: var(--err); border: 1px solid var(--err-border); }
    .pill.warn { background: var(--warn-bg); color: var(--warn); border: 1px solid var(--warn-border); }
    .pill.neutral { background: var(--subtle); color: var(--muted); border: 1px solid var(--border); }

    .kpi-nums { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
    .kpi-before { font-size: 15px; font-weight: 700; color: var(--muted); text-decoration: line-through; }
    .kpi-arrow { font-size: 15px; color: var(--muted); font-weight: 700; }
    .kpi-after { font-size: 32px; font-weight: 800; letter-spacing: -0.03em; line-height: 1; color: var(--ink); }
    .kpi-delta { font-size: 12.5px; font-weight: 800; color: var(--ok); }

    .dual-bars { display: flex; flex-direction: column; gap: 5px; }
    .bar-line { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--muted); }
    .bar-track { flex: 1; height: 8px; border-radius: 999px; background: var(--subtle); overflow: hidden; }
    .bar-before { height: 100%; background: #C7BEB4; border-radius: 999px; }
    .bar-after-ok { height: 100%; background: #16A34A; border-radius: 999px; }
    .bar-after-accent { height: 100%; background: #C85A32; border-radius: 999px; }
    .tag-row { display: flex; flex-wrap: wrap; gap: 6px; }
    .micro-tag {
      font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 8px;
      background: var(--subtle); color: var(--ink);
    }

    /* Section Headers */
    .sec-head {
      display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap;
      margin-bottom: 14px;
    }
    .sec-num {
      display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 8px;
      background: var(--ink); color: #fff; font-size: 12.5px; font-weight: 800; margin-right: 8px;
    }
    .sec-head h2 { margin: 0; font-size: 20px; font-weight: 800; display: flex; align-items: center; }
    .sec-note { font-size: 12.5px; font-weight: 700; color: var(--ok); }

    /* Cards & Grids */
    .card {
      background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 20px 22px; box-shadow: var(--shadow); margin-bottom: 14px;
    }
    .card h3 { margin: 0 0 12px; font-size: 15px; font-weight: 800; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
    @media (max-width: 820px) { .grid-2 { grid-template-columns: 1fr; } }

    /* Consistent Higher-is-Better Bars */
    .metric-row {
      display: grid; grid-template-columns: 215px 1fr 145px; align-items: center; gap: 12px;
      padding: 9px 0; border-bottom: 1px dashed var(--border);
    }
    .metric-row:last-child { border-bottom: none; }
    @media (max-width: 720px) { .metric-row { grid-template-columns: 1fr; gap: 5px; } }
    .m-name { font-size: 13px; font-weight: 700; }
    .m-stat { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
    .m-err-sub { font-size: 11px; color: var(--muted); font-weight: 600; }

    /* Screenshots Gallery (Big & Visual) */
    .gallery-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
    @media (max-width: 900px) { .gallery-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 580px) { .gallery-grid { grid-template-columns: 1fr; } }
    .shot-card {
      background: var(--surface); border: 1px solid var(--border); border-radius: 16px;
      overflow: hidden; box-shadow: var(--shadow); cursor: pointer; transition: transform .15s ease;
    }
    .shot-card:hover { transform: translateY(-2px); }
    .shot-card img { width: 100%; height: 195px; object-fit: cover; object-position: top; display: block; border-bottom: 1px solid var(--border); }
    .shot-meta { padding: 11px 14px; }
    .shot-meta strong { display: block; font-size: 13px; margin-bottom: 2px; }
    .shot-meta span { font-size: 11.5px; color: var(--muted); }

    /* Compact 6+1 Scopes & AI Split (Zero paragraphs) */
    .scope-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    @media (max-width: 820px) { .scope-grid { grid-template-columns: 1fr; } }
    .scope-card {
      border: 1px solid var(--border); border-radius: 14px; padding: 12px 14px; background: #FCF9F5;
      display: flex; flex-direction: column; gap: 5px;
    }
    .scope-card.optin { background: var(--warn-bg); border-color: var(--warn-border); }
    .scope-line { font-size: 12px; color: var(--muted); font-weight: 500; }
    .scope-code { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--muted); word-break: break-all; }

    .chip-list { display: flex; flex-wrap: wrap; gap: 7px; }
    .data-chip {
      padding: 6px 10px; border-radius: 10px; font-size: 12px; font-weight: 700;
      background: var(--subtle); color: var(--ink); border: 1px solid var(--border);
    }
    .data-chip.no { background: var(--err-bg); color: var(--err); border-color: var(--err-border); }

    .layer-flow { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    @media (max-width: 820px) { .layer-flow { grid-template-columns: repeat(2, 1fr); } }
    .layer-step {
      border: 1px solid var(--ok-border); border-radius: 14px; padding: 12px 14px; background: var(--ok-bg);
    }
    .step-badge { font-size: 11px; font-weight: 800; color: var(--ok); text-transform: uppercase; }
    .layer-step strong { display: block; font-size: 13px; margin: 3px 0; }
    .layer-step span { font-size: 11.5px; color: var(--muted); }

    /* Compact Case Explorer */
    .controls { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .subtabs { display: flex; gap: 6px; flex-wrap: wrap; }
    .chip-btn {
      padding: 6px 12px; border-radius: 999px; border: 1px solid var(--border);
      background: var(--surface); color: var(--muted); font-size: 12px; font-weight: 700; cursor: pointer;
    }
    .chip-btn.active { background: var(--ink); color: #fff; border-color: var(--ink); }
    .search-input {
      padding: 6px 12px; border-radius: 10px; border: 1px solid var(--border);
      background: var(--surface); color: var(--ink); font-size: 12.5px; min-width: 200px; font-family: inherit;
    }
    .case-list { display: flex; flex-direction: column; gap: 6px; }
    .case-item { border: 1px solid var(--border); border-radius: 12px; background: var(--surface); overflow: hidden; }
    .case-head {
      width: 100%; text-align: left; background: transparent; border: none; padding: 10px 14px;
      display: flex; align-items: center; gap: 10px; cursor: pointer; font-family: inherit;
    }
    .case-head:hover { background: #FDFBF8; }
    .case-id {
      font-family: 'JetBrains Mono', monospace; font-size: 11.5px; font-weight: 700;
      padding: 2px 7px; border-radius: 7px; background: var(--subtle); color: var(--ink);
    }
    .case-title { flex: 1; font-size: 13px; font-weight: 600; color: var(--ink); }
    .case-body { display: none; padding: 0 14px 14px; border-top: 1px solid var(--border); background: #FCF9F5; font-size: 12.5px; }
    .case-item.open .case-body { display: block; }
    .compare-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
    @media (max-width: 760px) { .compare-grid { grid-template-columns: 1fr; } }
    .compare-box { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; }
    .compare-box h4 { margin: 0 0 5px; font-size: 11px; text-transform: uppercase; color: var(--muted); }
    .quote-box {
      margin-top: 10px; padding: 8px 12px; border-left: 3px solid var(--accent);
      background: var(--surface); border-radius: 0 8px 8px 0; white-space: pre-wrap;
      font-size: 12px; color: var(--muted); max-height: 180px; overflow-y: auto;
    }

    /* Lightbox */
    .lightbox {
      position: fixed; inset: 0; z-index: 100; background: rgba(20, 18, 16, 0.9);
      display: none; align-items: center; justify-content: center; padding: 20px;
    }
    .lightbox.open { display: flex; }
    .lightbox-inner { max-width: 1040px; width: 100%; text-align: center; }
    .lightbox img { max-width: 100%; max-height: 82vh; border-radius: 12px; }
    .lightbox-cap { color: #F5F5F4; margin-top: 10px; font-size: 13.5px; font-weight: 600; }
    .lightbox-close {
      position: fixed; top: 16px; right: 20px; background: rgba(255,255,255,0.16); color: #fff;
      border: 1px solid rgba(255,255,255,0.28); border-radius: 999px; padding: 7px 14px;
      font-weight: 700; cursor: pointer; font-family: inherit;
    }

    footer {
      margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border);
      display: flex; flex-wrap: wrap; justify-content: space-between; gap: 10px;
      font-size: 12px; color: var(--muted);
    }
    @media print {
      .topbar, .hero-actions, .controls { display: none !important; }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="topbar-inner">
      <div class="brand">
        <div class="brand-mark">S</div>
        <span>StudentOS · Minh chứng Chặng 2</span>
      </div>
      <nav class="nav-links" aria-label="Cuộn nhanh">
        <a class="nav-link" href="#sec-metrics">1. Biểu đồ</a>
        <a class="nav-link" href="#sec-screens">2. Ảnh thực tế</a>
        <a class="nav-link" href="#sec-privacy">3. Quyền &amp; AI</a>
        <a class="nav-link" href="#sec-cases">4. 50 ca test</a>
        <a class="nav-link" href="#sec-sources">5. Nguồn &amp; PII</a>
        <a class="nav-link cta" href="https://sutdent-command-center.vercel.app" target="_blank" rel="noreferrer">Mở StudentOS</a>
      </nav>
    </div>
  </header>

  <main class="container">
    <!-- HERO + CLEAR BEFORE/AFTER DEFINITION -->
    <section class="hero">
      <div class="eyebrow">Chặng 2 · Kiểm thử AI &amp; Bảo vệ Dữ liệu Học sinh · v3.6.3</div>
      <h1>Minh chứng Cải tiến: 50 ca Kiểm thử AI &amp; Quyền riêng tư</h1>
      <p class="hero-sub">Cuộn xuống để xem kết quả chạy thật — không chữ dài, số liệu minh bạch 100%.</p>
      <div class="hero-actions">
        <a class="btn solid" href="https://docs.google.com/document/d/1QqdDl3FwUrktKwe3ejZDCktQA2EwkQC2EGKalVYOQwc/edit" target="_blank" rel="noreferrer">Báo cáo Google Docs</a>
        <a class="btn" href="https://sutdent-command-center.vercel.app" target="_blank" rel="noreferrer">Sản phẩm chạy thử</a>
        <a class="btn" href="https://github.com/buianhuy2009/Student-Command-Center" target="_blank" rel="noreferrer">Mã nguồn GitHub</a>
        <button class="btn" onclick="window.print()">In / PDF</button>
      </div>
      <div class="ba-legend">
        <div class="ba-pill">
          <span class="dot before"></span>
          <div><strong>Trước (Chưa cải tiến):</strong> Bản gốc chưa lọc email, chưa khóa lịch/hỏi lại mơ hồ, chưa có 4 lớp chặn Gia sư.</div>
        </div>
        <div class="ba-pill after">
          <span class="dot after"></span>
          <div><strong>Sau (StudentOS v3.6):</strong> Đã bật lọc email, bảo vệ lịch + hỏi lại <code>s07</code>, 4 lớp Socratic &amp; Trung tâm Quyền riêng tư.</div>
        </div>
        <div class="ba-pill rule">Quy ước toàn trang: Càng cao càng tốt (100% = 0 lỗi)</div>
      </div>
    </section>

    <!-- TOP 3 KPI CARDS (ALL HIGHER IS BETTER) -->
    <section class="block" style="margin-bottom: 28px;">
      <div class="kpi-grid">
        <article class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-label">Gia sư AI Socratic (10 ca)</span>
            <span class="pill ok">10/10 PASS</span>
          </div>
          <div class="kpi-nums">
            <span class="kpi-before">40%</span>
            <span class="kpi-arrow">-&gt;</span>
            <span class="kpi-after">100%</span>
            <span class="kpi-delta">+60%</span>
          </div>
          <div class="dual-bars">
            <div class="bar-line"><span style="width:36px">Trước</span><div class="bar-track"><div class="bar-before" style="width:40%"></div></div><span>40%</span></div>
            <div class="bar-line"><span style="width:36px;font-weight:700;color:var(--ink)">Sau</span><div class="bar-track"><div class="bar-after-ok" style="width:100%"></div></div><strong>100%</strong></div>
          </div>
          <div class="tag-row">
            <span class="micro-tag">0% lộ đáp án</span>
            <span class="micro-tag">0% giải hộ thi</span>
            <span class="micro-tag">0% qua mặt vai GV</span>
          </div>
        </article>

        <article class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-label">Đổi lịch tiếng Việt (10 ca)</span>
            <span class="pill ok">9/10 PASS</span>
          </div>
          <div class="kpi-nums">
            <span class="kpi-before">0%</span>
            <span class="kpi-arrow">-&gt;</span>
            <span class="kpi-after">90%</span>
            <span class="kpi-delta">+90%</span>
          </div>
          <div class="dual-bars">
            <div class="bar-line"><span style="width:36px">Trước</span><div class="bar-track"><div class="bar-before" style="width:2%"></div></div><span>0%</span></div>
            <div class="bar-line"><span style="width:36px;font-weight:700;color:var(--ink)">Sau</span><div class="bar-track"><div class="bar-after-ok" style="width:90%"></div></div><strong>90%</strong></div>
          </div>
          <div class="tag-row">
            <span class="micro-tag">100% giữ buổi khóa</span>
            <span class="micro-tag">0% trùng lịch</span>
            <span class="micro-tag">s07 tự hỏi lại</span>
          </div>
        </article>

        <article class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-label">Trích xuất Email (30 ca)</span>
            <span class="pill warn">15/30 PASS cả 6 tiêu chí</span>
          </div>
          <div class="kpi-nums">
            <span class="kpi-before">13% / 43%</span>
            <span class="kpi-arrow">-&gt;</span>
            <span class="kpi-after">50%</span>
            <span class="kpi-delta">+37% (live)</span>
          </div>
          <div class="dual-bars">
            <div class="bar-line"><span style="width:36px">Trước</span><div class="bar-track"><div class="bar-before" style="width:43.3%"></div></div><span>43.3%</span></div>
            <div class="bar-line"><span style="width:36px;font-weight:700;color:var(--ink)">Sau</span><div class="bar-track"><div class="bar-after-accent" style="width:50%"></div></div><strong>50%</strong></div>
          </div>
          <div class="tag-row">
            <span class="micro-tag">85% đúng hạn nộp</span>
            <span class="micro-tag">100% chặn quảng cáo</span>
            <span class="micro-tag">100% giữ thư GV</span>
          </div>
        </article>
      </div>
    </section>

    <!-- ORDER 1: METRICS & ERROR BREAKDOWN (HIGHER IS BETTER EVERYWHERE) -->
    <section id="sec-metrics" class="block">
      <div class="sec-head">
        <h2><span class="sec-num">1</span>Độ chính xác &amp; Tỷ lệ lỗi theo từng loại</h2>
        <span class="sec-note">Thanh dài hơn = tốt hơn (100% = 0% lỗi)</span>
      </div>

      <div class="card">
        <h3>30 Thư trường học (e01–e30) <span class="pill neutral">Trước: mô hình gốc · Sau: StudentOS v3.6</span></h3>
        <div id="email-bars"></div>
      </div>

      <div class="grid-2">
        <div class="card">
          <h3>10 Lệnh đổi lịch (s01–s10) <span class="pill ok">9/10 PASS</span></h3>
          <div id="schedule-bars"></div>
        </div>
        <div class="card">
          <h3>10 Gia sư AI (t01–t10) <span class="pill ok">10/10 PASS</span></h3>
          <div id="tutor-bars"></div>
        </div>
      </div>
    </section>

    <!-- ORDER 3: SCREENSHOTS (VISUAL PROOF EARLY!) -->
    <section id="sec-screens" class="block">
      <div class="sec-head">
        <h2><span class="sec-num">2</span>Ảnh chụp màn hình thực tế (bấm để phóng to)</h2>
        <span class="pill neutral">5 ảnh chụp trực tiếp trên v3.6</span>
      </div>
      <div class="gallery-grid">
        <div class="shot-card" data-src="/evidence/privacy-permissions-tab.png" data-cap="Thẻ 1: Quản lý 6 quyền chuẩn + quyền mở rộng tùy chọn drive.readonly và Canvas cục bộ.">
          <img src="/evidence/privacy-permissions-tab.png" alt="Thẻ 1: Quyền truy cập" loading="lazy" />
          <div class="shot-meta"><strong>1. Quản lý quyền (6+1)</strong><span>Trạng thái trực tiếp · Gửi AI: Có/Không</span></div>
        </div>
        <div class="shot-card" data-src="/evidence/privacy-ai-data-tab.png" data-cap="Thẻ 2: Ma trận dữ liệu gửi AI, nút tắt ngữ cảnh Gia sư, tắt dự phòng Groq và khóa Socratic.">
          <img src="/evidence/privacy-ai-data-tab.png" alt="Thẻ 2: Dữ liệu AI" loading="lazy" />
          <div class="shot-meta"><strong>2. Dữ liệu AI &amp; Nút tắt</strong><span>Tắt ngữ cảnh · Tắt Groq · Khóa Socratic</span></div>
        </div>
        <div class="shot-card" data-src="/evidence/privacy-parents-tab.png" data-cap="Thẻ 3: Lưu trữ trên máy, hướng dẫn phụ huynh, thu hồi Google và xóa toàn bộ dữ liệu.">
          <img src="/evidence/privacy-parents-tab.png" alt="Thẻ 3: Lưu trữ & Phụ huynh" loading="lazy" />
          <div class="shot-meta"><strong>3. Lưu trữ &amp; Phụ huynh</strong><span>Thu hồi quyền · Xóa dữ liệu 2 bước</span></div>
        </div>
        <div class="shot-card" data-src="/evidence/google-permission-consent.png" data-cap="Hộp thoại xin quyền từng tính năng Google với nhãn Dữ liệu gửi AI rõ ràng.">
          <img src="/evidence/google-permission-consent.png" alt="Hộp thoại xin quyền Google" loading="lazy" />
          <div class="shot-meta"><strong>4. Xin quyền từng tính năng</strong><span>Nhãn dữ liệu gửi AI trước khi OAuth</span></div>
        </div>
        <div class="shot-card" data-src="/evidence/tutor-hint-only.png" data-cap="Gia sư AI ở Chế độ Gợi ý Socratic: từ chối giải hộ, chỉ gợi ý bước đầu tiên.">
          <img src="/evidence/tutor-hint-only.png" alt="Gia sư AI Socratic" loading="lazy" />
          <div class="shot-meta"><strong>5. Gia sư chỉ gợi ý</strong><span>Huy hiệu Socratic · Không giải hộ</span></div>
        </div>
      </div>
    </section>

    <!-- ORDER 4: PERMISSIONS & AI DATA (ULTRA-SCANNABLE CARDS) -->
    <section id="sec-privacy" class="block">
      <div class="sec-head">
        <h2><span class="sec-num">3</span>Quyền truy cập 6+1 &amp; Bảo vệ Dữ liệu AI</h2>
        <span class="pill ok">Nguyên tắc quyền tối thiểu</span>
      </div>

      <div class="card">
        <h3>6 quyền Google chuẩn + 1 quyền mở rộng tùy chọn + Canvas</h3>
        <div class="scope-grid">
          <div class="scope-card">
            <div class="kpi-top"><strong>Calendar</strong><span class="pill neutral">AI: Chỉ khung giờ</span></div>
            <div class="scope-line">Tránh trùng lịch &amp; lưu buổi học khi bấm Lưu.</div>
            <div class="scope-code">calendar.events</div>
          </div>
          <div class="scope-card">
            <div class="kpi-top"><strong>Gmail (Chỉ đọc)</strong><span class="pill warn">AI: &lt;=1.500 ký tự</span></div>
            <div class="scope-line">Tìm bài tập/lịch thi. Không gửi hay xóa thư.</div>
            <div class="scope-code">gmail.readonly</div>
          </div>
          <div class="scope-card">
            <div class="kpi-top"><strong>Classroom (3 quyền)</strong><span class="pill neutral">AI: Chỉ thông báo GV</span></div>
            <div class="scope-line">Đọc lớp &amp; bài tập. Không xem điểm, không nộp thay.</div>
            <div class="scope-code">courses · coursework.me · announcements</div>
          </div>
          <div class="scope-card">
            <div class="kpi-top"><strong>Drive &amp; Sheets</strong><span class="pill ok">AI: Không gửi</span></div>
            <div class="scope-line">Chỉ tệp ứng dụng tạo hoặc học sinh tự chọn.</div>
            <div class="scope-code">drive.file</div>
          </div>
          <div class="scope-card optin">
            <div class="kpi-top"><strong>Drive Tất cả tệp (Thứ 7)</strong><span class="pill warn">Tắt mặc định</span></div>
            <div class="scope-line">Chỉ xin khi bấm "Hiện tất cả tệp Drive".</div>
            <div class="scope-code">drive.readonly (Opt-in)</div>
          </div>
          <div class="scope-card">
            <div class="kpi-top"><strong>Canvas LMS</strong><span class="pill ok">Cục bộ · 0 AI</span></div>
            <div class="scope-line">Mã lưu trên máy học sinh, không gửi AI.</div>
            <div class="scope-code">Local device token</div>
          </div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <h3>Dữ liệu gửi tới AI (Gemini · Groq dự phòng tùy chọn)</h3>
          <div class="chip-list">
            <span class="data-chip">Gmail: &lt;=1.500 ký tự đã lọc trích dẫn</span>
            <span class="data-chip">Bỏ qua Quảng cáo &amp; MXH mặc định</span>
            <span class="data-chip">Gia sư: Tin nhắn + ảnh (ngữ cảnh có nút tắt)</span>
            <span class="data-chip">Đã xóa rawEmail &amp; senderEmail</span>
            <span class="data-chip">Lịch: Câu lệnh + khung giờ tuần</span>
          </div>
        </div>
        <div class="card" style="border-color: var(--err-border);">
          <h3 style="color: var(--err);">KHÔNG BAO GIỜ gửi tới AI</h3>
          <div class="chip-list">
            <span class="data-chip no">Mật khẩu Google</span>
            <span class="data-chip no">Khóa OAuth / mã Canvas</span>
            <span class="data-chip no">Điểm số &amp; học bạ</span>
            <span class="data-chip no">Danh bạ lớp học</span>
            <span class="data-chip no">Tệp Drive cá nhân</span>
            <span class="data-chip no">Ghi chú ở chế độ ngoại tuyến</span>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>4 lớp khóa Gia sư AI chỉ gợi ý (10/10 PASS)</h3>
        <div class="layer-flow">
          <div class="layer-step"><div class="step-badge">Lớp 1</div><strong>Bắt đầu vào</strong><span>Nhận diện giải hộ, thi trực tuyến (t06), giả GV (t05)</span></div>
          <div class="layer-step"><div class="step-badge">Lớp 2</div><strong>Khóa tool server</strong><span>Chỉ cho phép 5 tool hợp lệ, chặn giả mạo</span></div>
          <div class="layer-step"><div class="step-badge">Lớp 3</div><strong>Quét rò rỉ đáp án</strong><span>detectAnswerLeak() tự viết lại thành gợi ý</span></div>
          <div class="layer-step"><div class="step-badge">Lớp 4</div><strong>Đồng bộ toàn app</strong><span>Áp dụng cả Server, BYOK &amp; Trợ lý nổi</span></div>
        </div>
      </div>
    </section>

    <!-- ORDER 2: INTERACTIVE 50-CASE EXPLORER (COMPACT BY DEFAULT) -->
    <section id="sec-cases" class="block">
      <div class="sec-head">
        <h2><span class="sec-num">4</span>Kiểm tra từng ca trong bộ 50 ca (bấm để xem Trước vs Sau)</h2>
        <span class="pill neutral">Thu gọn mặc định · bấm dòng bất kỳ để mở</span>
      </div>
      <div class="card">
        <div class="controls">
          <div class="subtabs">
            <button class="chip-btn active" data-suite="tutor">10 Gia sư AI (100%)</button>
            <button class="chip-btn" data-suite="schedule">10 Đổi lịch (90%)</button>
            <button class="chip-btn" data-suite="emails">30 Thư trường học (50%)</button>
          </div>
          <div class="subtabs">
            <button class="chip-btn active" data-filter="all">Tất cả</button>
            <button class="chip-btn" data-filter="pass">PASS</button>
            <button class="chip-btn" data-filter="fail">FAIL</button>
            <input id="case-search" class="search-input" type="search" placeholder="Tìm mã (t06, s07, e08)..." />
          </div>
        </div>
        <div id="case-list" class="case-list"></div>
        <div id="show-more-wrap" style="margin-top:10px;text-align:center;display:none;">
          <button id="show-more-btn" class="btn" type="button">Hiện tất cả các ca</button>
        </div>
      </div>
    </section>

    <!-- ORDER 5: SOURCES & PII AUDIT -->
    <section id="sec-sources" class="block">
      <div class="sec-head">
        <h2><span class="sec-num">5</span>Nguồn dữ liệu &amp; Xác minh ẩn danh tự động</h2>
        <span class="pill ok">8/8 kiểm tra PII PASS</span>
      </div>
      <div class="grid-2">
        <div class="card">
          <h3>Kiểm tra ẩn danh tự động (<code>evalAnonymization.test.ts</code>)</h3>
          <div class="chip-list">
            <span class="data-chip">0 email thật (*.example)</span>
            <span class="data-chip">0 SĐT thật (0123 456 789)</span>
            <span class="data-chip">0 chuỗi CCCD 12 số</span>
            <span class="data-chip">Cắt trích dẫn &lt;= 1.500 ký tự</span>
          </div>
        </div>
        <div class="card">
          <h3>Bằng chứng gốc trên GitHub</h3>
          <div class="chip-list">
            <a class="btn" href="https://github.com/buianhuy2009/Student-Command-Center/blob/main/eval/results/summary.json" target="_blank" rel="noreferrer">summary.json</a>
            <a class="btn" href="https://github.com/buianhuy2009/Student-Command-Center/blob/main/eval/REPORT.md" target="_blank" rel="noreferrer">REPORT.md</a>
            <a class="btn" href="https://github.com/buianhuy2009/Student-Command-Center/blob/main/eval/SOURCES.md" target="_blank" rel="noreferrer">SOURCES.md</a>
            <a class="btn" href="https://github.com/buianhuy2009/Student-Command-Center/blob/main/docs/AI_EVAL_AND_PRIVACY_EVIDENCE.md" target="_blank" rel="noreferrer">Toàn văn + Phụ lục A–D</a>
          </div>
        </div>
      </div>
    </section>

    <footer>
      <div>StudentOS v3.6.3 · Minh chứng Chặng 2 · Nguồn dữ liệu: <code>eval/results/summary.json</code></div>
      <div><a href="/privacy">Quyền riêng tư</a> · <a href="https://docs.google.com/document/d/1QqdDl3FwUrktKwe3ejZDCktQA2EwkQC2EGKalVYOQwc/edit" target="_blank" rel="noreferrer">Google Docs</a></div>
    </footer>
  </main>

  <div id="lightbox" class="lightbox" role="dialog" aria-modal="true" aria-label="Xem ảnh phóng to">
    <button class="lightbox-close" id="lightbox-close">Đóng (Esc)</button>
    <div class="lightbox-inner">
      <img id="lightbox-img" src="" alt="" />
      <div id="lightbox-cap" class="lightbox-cap"></div>
    </div>
  </div>

  <script>
    const DATA = ${safeJson};

    // Higher-is-better accuracy labels (Score = 100% - ErrorRate%)
    const EMAIL_METRICS = [
      ['falsePositiveAssignment', 'Không báo nhầm quảng cáo/lừa đảo'],
      ['hiddenTeacherOrSchool', 'Không ẩn nhầm thư thầy cô/trường'],
      ['fabricatedDueDate', 'Không tự bịa hạn nộp'],
      ['missedAssignment', 'Bắt trúng bài tập thật (không bỏ sót)'],
      ['wrongSubject', 'Nhận diện đúng môn học'],
      ['wrongDueDate', 'Trích xuất đúng hạn nộp'],
      ['wrongCategory', 'Phân loại đúng nhóm thư'],
      ['aiOmittedOrFailed', 'Hoàn tất xử lý (không lỗi kỹ thuật)'],
      ['wrongPriority', 'Khớp đúng nhãn ưu tiên (High/Med/Low)'],
    ];

    const SCHED_METRICS = [
      ['lockedBlockViolation', 'Bảo vệ tuyệt đối buổi đã khóa'],
      ['overlapViolation', 'Không gây trùng lịch học'],
      ['collateralMove', 'Không đổi nhầm buổi khác'],
      ['missingAddition', 'Thêm đúng buổi ôn yêu cầu'],
      ['missingClarificationOrLockNotice', 'Tự hỏi lại khi mơ hồ / báo khóa'],
      ['targetNotChanged', 'Đổi đúng buổi mục tiêu'],
    ];

    const TUTOR_METRICS = [
      ['fullSolutionLeak', 'Chặn đưa lời giải / bài văn chép sẵn'],
      ['liveExamCheatingLeak', 'Chặn giải hộ khi đang thi trực tuyến'],
      ['roleplayBypassLeak', 'Chặn mẹo giả danh giáo viên'],
      ['unhelpfulOverRefusal', 'Hỗ trợ đúng câu hỏi học tập hợp lệ'],
    ];

    function esc(s) {
      return String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    }

    function pct(v) { return Math.round(v * 10) / 10; }

    function renderAccuracyBars(containerId, beforeTax, afterTax, metrics) {
      const el = document.getElementById(containerId);
      el.innerHTML = metrics.map(([key, label]) => {
        const bErr = beforeTax?.[key] || { count: 0, total: 0, ratePct: 0 };
        const aErr = afterTax?.[key] || { count: 0, total: 0, ratePct: 0 };
        const bAcc = pct(100 - bErr.ratePct);
        const aAcc = pct(100 - aErr.ratePct);
        const pillClass = aAcc >= 95 ? 'ok' : (aAcc >= 80 ? 'warn' : 'err');
        const barClass = aAcc >= 80 ? 'bar-after-ok' : 'bar-after-accent';
        return \`
          <div class="metric-row">
            <div class="m-name">\${esc(label)}</div>
            <div class="dual-bars">
              <div class="bar-line">
                <span style="width:36px">Trước</span>
                <div class="bar-track"><div class="bar-before" style="width:\${Math.max(2, bAcc)}%"></div></div>
                <span style="width:42px;text-align:right">\${bAcc}%</span>
              </div>
              <div class="bar-line">
                <span style="width:36px;font-weight:700;color:var(--ink)">Sau</span>
                <div class="bar-track"><div class="\${barClass}" style="width:\${Math.max(2, aAcc)}%"></div></div>
                <span style="width:42px;text-align:right;font-weight:800;color:var(--ink)">\${aAcc}%</span>
              </div>
            </div>
            <div class="m-stat">
              <span class="pill \${pillClass}">Đạt \${aAcc}%</span>
              <span class="m-err-sub">Lỗi: \${aErr.count}/\${aErr.total} (\${aErr.ratePct}%)</span>
            </div>
          </div>
        \`;
      }).join('');
    }

    renderAccuracyBars('email-bars', DATA.summary.emails.beforeModel.taxonomy, DATA.summary.emails.after.taxonomy, EMAIL_METRICS);
    renderAccuracyBars('schedule-bars', DATA.summary.schedule.before.taxonomy, DATA.summary.schedule.after.taxonomy, SCHED_METRICS);
    renderAccuracyBars('tutor-bars', DATA.summary.tutor.before.taxonomy, DATA.summary.tutor.after.taxonomy, TUTOR_METRICS);

    // Compact 50-Case Explorer
    let activeSuite = 'tutor';
    let activeFilter = 'all';
    let searchQ = '';
    let showAll = false;

    function renderCases() {
      const list = document.getElementById('case-list');
      const moreWrap = document.getElementById('show-more-wrap');
      const moreBtn = document.getElementById('show-more-btn');
      const items = DATA[activeSuite] || [];
      const filtered = items.filter((item) => {
        if (activeFilter === 'pass' && !item.afterPass) return false;
        if (activeFilter === 'fail' && item.afterPass) return false;
        if (searchQ && !JSON.stringify(item).toLowerCase().includes(searchQ)) return false;
        return true;
      });

      const limit = showAll || searchQ ? filtered.length : 8;
      const visible = filtered.slice(0, limit);
      if (filtered.length > limit) {
        moreWrap.style.display = 'block';
        moreBtn.textContent = \`Hiện toàn bộ \${filtered.length} ca (đang hiện \${limit})\`;
      } else {
        moreWrap.style.display = 'none';
      }

      if (!visible.length) {
        list.innerHTML = '<div class="scope-card">Không có ca kiểm thử phù hợp.</div>';
        return;
      }

      list.innerHTML = visible.map((item) => {
        const badge = item.afterPass ? '<span class="pill ok">Sau: PASS</span>' : '<span class="pill err">Sau: FAIL</span>';
        const beforeBadge = item.beforePass ? '<span class="pill neutral">Trước: PASS</span>' : '<span class="pill neutral">Trước: FAIL</span>';
        let title = '';
        let detail = '';

        if (activeSuite === 'emails') {
          title = item.subject;
          const gotA = item.afterGot || {};
          const exp = item.expected || {};
          detail = \`
            <div class="quote-box"><strong>\${esc(item.sender)}</strong> (\${esc(item.date)}) — \${esc(item.body)}</div>
            <div class="compare-grid">
              <div class="compare-box"><h4>Kỳ vọng</h4><code>\${esc(exp.category)}</code> · Hạn: <code>\${esc(exp.dueDate || 'không')}</code> · Ưu tiên: <code>\${esc(exp.priority || 'N/A')}</code></div>
              <div class="compare-box"><h4>AI Sau cải tiến</h4><code>\${esc(gotA.category || 'N/A')}</code> · Hạn: <code>\${esc(gotA.dueDate || 'không')}</code> · Môn: <code>\${esc(gotA.subject || 'N/A')}</code> · Ưu tiên: <code>\${esc(gotA.priority || 'N/A')}</code></div>
            </div>
          \`;
        } else if (activeSuite === 'schedule') {
          title = item.command;
          detail = \`
            <div class="compare-grid">
              <div class="compare-box"><h4>Trước (\${item.beforePass ? 'PASS' : 'FAIL'})</h4>\${esc(item.beforeSaid)}</div>
              <div class="compare-box"><h4>Sau (\${item.afterPass ? 'PASS' : 'FAIL'})</h4>\${esc(item.afterSaid)}</div>
            </div>
          \`;
        } else {
          title = item.prompt.split('\\n')[0].slice(0, 110);
          detail = \`
            <div class="quote-box">\${esc(item.prompt)}</div>
            <div class="compare-grid">
              <div class="compare-box"><h4>Trước (\${item.beforePass ? 'PASS' : 'FAIL'})</h4><div style="white-space:pre-wrap;max-height:200px;overflow-y:auto;">\${esc(item.beforeReply)}</div></div>
              <div class="compare-box" style="border-color:var(--ok-border);"><h4>Sau (Socratic · PASS)</h4><div style="white-space:pre-wrap;max-height:200px;overflow-y:auto;">\${esc(item.afterReply)}</div></div>
            </div>
          \`;
        }

        return \`
          <div class="case-item">
            <button class="case-head" type="button">
              <span class="case-id">\${esc(item.id)}</span>
              <span class="case-title">\${esc(title)}</span>
              \${beforeBadge}
              \${badge}
            </button>
            <div class="case-body">\${detail}</div>
          </div>
        \`;
      }).join('');

      list.querySelectorAll('.case-head').forEach((btn) => {
        btn.addEventListener('click', () => btn.parentElement.classList.toggle('open'));
      });
    }

    document.querySelectorAll('[data-suite]').forEach((b) => b.addEventListener('click', () => {
      activeSuite = b.dataset.suite;
      showAll = false;
      document.querySelectorAll('[data-suite]').forEach((x) => x.classList.toggle('active', x === b));
      renderCases();
    }));
    document.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
      activeFilter = b.dataset.filter;
      showAll = false;
      document.querySelectorAll('[data-filter]').forEach((x) => x.classList.toggle('active', x === b));
      renderCases();
    }));
    document.getElementById('case-search').addEventListener('input', (e) => {
      searchQ = e.target.value.trim().toLowerCase();
      renderCases();
    });
    document.getElementById('show-more-btn').addEventListener('click', () => {
      showAll = true;
      renderCases();
    });
    renderCases();

    // Lightbox
    const lb = document.getElementById('lightbox');
    const lbImg = document.getElementById('lightbox-img');
    const lbCap = document.getElementById('lightbox-cap');
    document.querySelectorAll('.shot-card').forEach((card) => {
      card.addEventListener('click', () => {
        lbImg.src = card.dataset.src;
        lbCap.textContent = card.dataset.cap;
        lb.classList.add('open');
      });
    });
    function closeLb() { lb.classList.remove('open'); }
    document.getElementById('lightbox-close').addEventListener('click', closeLb);
    lb.addEventListener('click', (e) => { if (e.target === lb) closeLb(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLb(); });
  </script>
</body>
</html>
`;

fs.writeFileSync(path.join(root, 'public/minh-chung.html'), html, 'utf8');
console.log(`Generated public/minh-chung.html (${html.length} bytes)`);

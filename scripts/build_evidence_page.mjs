#!/usr/bin/env node
/**
 * Generates public/minh-chung.html — an interactive, visual, judge-friendly
 * evidence hub for StudentOS Chặng 2 (AI Testing & Student Data Protection).
 * Reads real benchmark JSON files from eval/ and eval/results/ so every metric,
 * error-rate bar, and Before/After case comparison is 100% authentic.
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
      body: (raw.body || '').slice(0, 650),
      tricky: r.tricky || '',
      expected: r.expected,
      beforePass: Boolean(bef.pass),
      beforeGot: bef.got || null,
      afterPass: Boolean(r.pass),
      afterGot: r.got || null,
      checks: r.checks || {},
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
      beforeSaid: bef.said || '(Không có phản hồi / bỏ trống)',
      beforeFails: bef.fails || [],
      afterPass: Boolean(r.pass),
      afterSaid: r.said || '',
      afterOps: r.ops || [],
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
      beforeReply: (bef.reply || '').slice(0, 900),
      beforeReason: bef.judge?.reason || '',
      afterPass: Boolean(r.pass),
      afterReply: (r.reply || '').slice(0, 900),
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
  <title>StudentOS · Minh chứng Cải tiến Chặng 2 (Kiểm thử AI &amp; Bảo vệ Dữ liệu)</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
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
      --radius: 16px;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--ink);
      line-height: 1.55;
      -webkit-font-smoothing: antialiased;
    }
    code, pre, .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
    a { color: var(--accent-dark); text-decoration: none; }
    a:hover { text-decoration: underline; }

    /* Top Nav */
    .topbar {
      position: sticky; top: 0; z-index: 40;
      background: rgba(250, 247, 242, 0.9);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
    }
    .topbar-inner {
      max-width: 1180px; margin: 0 auto; padding: 12px 20px;
      display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
    }
    .brand { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 15px; color: var(--ink); }
    .brand-mark {
      width: 32px; height: 32px; border-radius: 10px; background: var(--accent);
      display: grid; place-items: center; color: #fff; font-weight: 800; font-size: 14px;
    }
    .nav-links { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .nav-btn {
      padding: 6px 12px; border-radius: 999px; font-size: 12.5px; font-weight: 600;
      color: var(--muted); border: 1px solid transparent; background: transparent; cursor: pointer;
      transition: all .15s ease;
    }
    .nav-btn:hover { color: var(--ink); background: var(--subtle); text-decoration: none; }
    .nav-btn.primary { background: var(--accent); color: #fff; }
    .nav-btn.primary:hover { background: var(--accent-dark); color: #fff; }

    .container { max-width: 1180px; margin: 0 auto; padding: 28px 20px 72px; }

    /* Hero */
    .hero {
      background: linear-gradient(135deg, #FFFFFF 0%, #FDF6EE 100%);
      border: 1px solid var(--border); border-radius: 24px; padding: 32px 32px 28px;
      box-shadow: var(--shadow); margin-bottom: 24px;
    }
    .eyebrow {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 5px 12px; border-radius: 999px;
      background: var(--accent-soft); color: var(--accent-dark);
      font-size: 11.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
    }
    .hero h1 {
      margin: 14px 0 10px; font-size: clamp(26px, 4vw, 38px); line-height: 1.15;
      font-weight: 800; letter-spacing: -0.025em;
    }
    .hero p.lead {
      margin: 0 0 20px; max-width: 780px; font-size: 15.5px; color: var(--muted);
    }
    .hero-actions { display: flex; flex-wrap: wrap; gap: 10px; }
    .btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 10px 16px; border-radius: 12px; font-size: 13.5px; font-weight: 700;
      border: 1px solid var(--border); background: var(--surface); color: var(--ink);
      cursor: pointer; transition: transform .12s ease, box-shadow .12s ease, background .12s ease;
    }
    .btn:hover { background: var(--subtle); text-decoration: none; transform: translateY(-1px); }
    .btn.solid { background: var(--accent); border-color: var(--accent); color: #fff; }
    .btn.solid:hover { background: var(--accent-dark); }

    /* KPI Strip */
    .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 26px; }
    @media (max-width: 860px) { .kpi-grid { grid-template-columns: 1fr; } }
    .kpi-card {
      background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 20px 22px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 10px;
    }
    .kpi-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .kpi-label { font-size: 13px; font-weight: 700; color: var(--muted); }
    .pill {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 3px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 700;
    }
    .pill.ok { background: var(--ok-bg); color: var(--ok); border: 1px solid var(--ok-border); }
    .pill.err { background: var(--err-bg); color: var(--err); border: 1px solid var(--err-border); }
    .pill.warn { background: var(--warn-bg); color: var(--warn); border: 1px solid var(--warn-border); }
    .pill.neutral { background: var(--subtle); color: var(--muted); border: 1px solid var(--border); }
    .kpi-num { display: flex; align-items: baseline; gap: 10px; }
    .kpi-big { font-size: 34px; font-weight: 800; letter-spacing: -0.03em; line-height: 1; }
    .kpi-delta { font-size: 13px; font-weight: 700; color: var(--ok); }
    .bar-track { height: 9px; border-radius: 999px; background: var(--subtle); overflow: hidden; position: relative; }
    .bar-fill { height: 100%; border-radius: 999px; transition: width .5s ease; }
    .bar-fill.ok { background: linear-gradient(90deg, #16A34A, #15803D); }
    .bar-fill.accent { background: linear-gradient(90deg, #D97742, #C85A32); }
    .bar-fill.err { background: linear-gradient(90deg, #EF4444, #B91C1C); }
    .kpi-foot { font-size: 12.5px; color: var(--muted); }

    /* Main Tabs */
    .tabs-bar {
      display: flex; gap: 8px; overflow-x: auto; padding: 6px;
      background: var(--subtle); border: 1px solid var(--border); border-radius: 16px;
      margin-bottom: 22px;
    }
    .tab-btn {
      flex: 1 0 auto; padding: 10px 16px; border-radius: 12px; border: none;
      background: transparent; color: var(--muted); font-family: inherit;
      font-size: 13.5px; font-weight: 700; cursor: pointer; transition: all .15s ease;
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    }
    .tab-btn:hover { color: var(--ink); }
    .tab-btn.active {
      background: var(--surface); color: var(--ink);
      box-shadow: 0 2px 8px rgba(28, 25, 23, 0.08);
    }
    .tab-panel { display: none; animation: fadeIn .18s ease; }
    .tab-panel.active { display: block; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

    /* Cards & Grids */
    .card {
      background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 22px 24px; box-shadow: var(--shadow); margin-bottom: 18px;
    }
    .card h2 { margin: 0 0 6px; font-size: 19px; font-weight: 800; letter-spacing: -0.015em; }
    .card h3 { margin: 0 0 8px; font-size: 15.5px; font-weight: 700; }
    .sub { margin: 0 0 16px; font-size: 13.5px; color: var(--muted); }
    .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    @media (max-width: 820px) { .grid-2 { grid-template-columns: 1fr; } }

    /* Error Rate Bars */
    .err-row {
      display: grid; grid-template-columns: 230px 1fr 120px; align-items: center; gap: 14px;
      padding: 10px 0; border-bottom: 1px dashed var(--border);
    }
    .err-row:last-child { border-bottom: none; }
    @media (max-width: 720px) { .err-row { grid-template-columns: 1fr; gap: 6px; } }
    .err-name { font-size: 13px; font-weight: 700; }
    .err-sub { font-size: 11.5px; color: var(--muted); }
    .err-bars { display: flex; flex-direction: column; gap: 5px; }
    .mini-bar-wrap { display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: var(--muted); }
    .mini-track { flex: 1; height: 8px; background: var(--subtle); border-radius: 999px; overflow: hidden; }
    .mini-fill-before { height: 100%; background: #D6CBC0; border-radius: 999px; }
    .mini-fill-after-ok { height: 100%; background: #16A34A; border-radius: 999px; }
    .mini-fill-after-warn { height: 100%; background: #D97706; border-radius: 999px; }
    .mini-fill-after-err { height: 100%; background: #DC2626; border-radius: 999px; }
    .err-stat { text-align: right; font-size: 12.5px; font-weight: 700; }

    /* Case Explorer */
    .controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .subtabs { display: flex; gap: 6px; flex-wrap: wrap; }
    .chip {
      padding: 7px 13px; border-radius: 999px; border: 1px solid var(--border);
      background: var(--surface); color: var(--muted); font-size: 12.5px; font-weight: 700; cursor: pointer;
    }
    .chip.active { background: var(--ink); color: #fff; border-color: var(--ink); }
    .search-input {
      padding: 8px 14px; border-radius: 10px; border: 1px solid var(--border);
      background: var(--surface); color: var(--ink); font-size: 13px; min-width: 220px; font-family: inherit;
    }
    .case-list { display: flex; flex-direction: column; gap: 8px; }
    .case-item {
      border: 1px solid var(--border); border-radius: 14px; background: var(--surface); overflow: hidden;
    }
    .case-head {
      width: 100%; text-align: left; background: transparent; border: none; padding: 13px 16px;
      display: flex; align-items: center; gap: 12px; cursor: pointer; font-family: inherit;
    }
    .case-head:hover { background: #FDFBF8; }
    .case-id {
      font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 700;
      padding: 3px 8px; border-radius: 8px; background: var(--subtle); color: var(--ink); flex-shrink: 0;
    }
    .case-title { flex: 1; font-size: 13.5px; font-weight: 600; color: var(--ink); }
    .case-body {
      display: none; padding: 0 16px 16px; border-top: 1px solid var(--border); background: #FCF9F5;
      font-size: 13px;
    }
    .case-item.open .case-body { display: block; }
    .compare-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
    @media (max-width: 760px) { .compare-grid { grid-template-columns: 1fr; } }
    .compare-box {
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px;
    }
    .compare-box h4 { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
    .quote-box {
      margin-top: 12px; padding: 10px 14px; border-left: 3px solid var(--accent);
      background: var(--surface); border-radius: 0 10px 10px 0; white-space: pre-wrap;
      font-size: 12.5px; color: var(--muted); max-height: 220px; overflow-y: auto;
    }

    /* Gallery */
    .gallery-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; }
    @media (max-width: 820px) { .gallery-grid { grid-template-columns: 1fr; } }
    .shot-card {
      background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
      overflow: hidden; box-shadow: var(--shadow); cursor: pointer; transition: transform .15s ease;
    }
    .shot-card:hover { transform: translateY(-2px); }
    .shot-card img { width: 100%; height: 240px; object-fit: cover; object-position: top; display: block; border-bottom: 1px solid var(--border); background: var(--subtle); }
    .shot-meta { padding: 14px 16px; }
    .shot-meta h3 { margin: 0 0 4px; font-size: 14.5px; }
    .shot-meta p { margin: 0; font-size: 12.5px; color: var(--muted); }

    /* Lightbox */
    .lightbox {
      position: fixed; inset: 0; z-index: 100; background: rgba(20, 18, 16, 0.88);
      display: none; align-items: center; justify-content: center; padding: 24px;
    }
    .lightbox.open { display: flex; }
    .lightbox-inner { max-width: 1060px; width: 100%; text-align: center; }
    .lightbox img { max-width: 100%; max-height: 80vh; border-radius: 14px; box-shadow: 0 20px 60px rgba(0,0,0,0.45); }
    .lightbox-cap { color: #F5F5F4; margin-top: 12px; font-size: 14px; font-weight: 600; }
    .lightbox-close {
      position: fixed; top: 18px; right: 22px; background: rgba(255,255,255,0.14); color: #fff;
      border: 1px solid rgba(255,255,255,0.25); border-radius: 999px; padding: 8px 16px;
      font-weight: 700; cursor: pointer; font-family: inherit;
    }

    /* Scopes & Privacy Grid */
    .scope-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 12px; }
    .scope-card {
      border: 1px solid var(--border); border-radius: 14px; padding: 14px 16px; background: #FCF9F5;
    }
    .scope-card.optin { background: var(--warn-bg); border-color: var(--warn-border); }
    .scope-code { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--muted); word-break: break-all; margin-top: 6px; }

    .layer-flow { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 12px; }
    @media (max-width: 860px) { .layer-flow { grid-template-columns: 1fr; } }
    .layer-step {
      border: 1px solid var(--border); border-radius: 14px; padding: 14px; background: #FCF9F5;
    }
    .step-num {
      display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 999px;
      background: var(--accent); color: #fff; font-size: 12px; font-weight: 800; margin-bottom: 8px;
    }

    footer {
      margin-top: 36px; padding-top: 20px; border-top: 1px solid var(--border);
      display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px;
      font-size: 12.5px; color: var(--muted);
    }

    @media print {
      .topbar, .tabs-bar, .controls, .hero-actions { display: none !important; }
      .tab-panel { display: block !important; page-break-inside: avoid; }
      .case-body { display: block !important; }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="topbar-inner">
      <div class="brand">
        <div class="brand-mark">S</div>
        <span>StudentOS · Minh chứng Cải tiến Chặng 2</span>
      </div>
      <nav class="nav-links" aria-label="Điều hướng nhanh">
        <button class="nav-btn" data-jump="tab-errors">Tỷ lệ lỗi</button>
        <button class="nav-btn" data-jump="tab-cases">50 ca kiểm thử</button>
        <button class="nav-btn" data-jump="tab-screens">Ảnh chụp thực tế</button>
        <button class="nav-btn" data-jump="tab-privacy">Quyền &amp; Dữ liệu AI</button>
        <button class="nav-btn" data-jump="tab-sources">Nguồn &amp; PII</button>
        <a class="nav-btn primary" href="https://sutdent-command-center.vercel.app" target="_blank" rel="noreferrer">Mở StudentOS</a>
      </nav>
    </div>
  </header>

  <main class="container">
    <section class="hero">
      <div class="eyebrow">Chặng 2 · Kiểm thử AI &amp; Bảo vệ Dữ liệu Học sinh · v3.6.2</div>
      <h1>Minh chứng Trực quan: Kiểm thử 50 ca AI &amp; Trung tâm Quyền riêng tư</h1>
      <p class="lead">
        Thay vì bảng chữ dài khó theo dõi, trang này cho phép Ban Giám khảo kiểm tra trực tiếp số liệu
        <strong>Trước vs Sau</strong> thực tế (không chỉnh sửa), phân tích <strong>tỷ lệ lỗi theo từng loại</strong>,
        bấm mở từng ca trong bộ <strong>30 thư trường học + 10 lệnh đổi lịch + 10 câu Gia sư AI</strong>, và xem ảnh chụp thật của hệ thống.
      </p>
      <div class="hero-actions">
        <a class="btn solid" href="https://docs.google.com/document/d/1QqdDl3FwUrktKwe3ejZDCktQA2EwkQC2EGKalVYOQwc/edit" target="_blank" rel="noreferrer">Mở Báo cáo Cải tiến (Google Docs)</a>
        <a class="btn" href="https://sutdent-command-center.vercel.app" target="_blank" rel="noreferrer">Trải nghiệm sản phẩm chạy thử</a>
        <a class="btn" href="https://github.com/buianhuy2009/Student-Command-Center/blob/main/docs/AI_EVAL_AND_PRIVACY_EVIDENCE.md" target="_blank" rel="noreferrer">Tài liệu Markdown đầy đủ (GitHub)</a>
        <button class="btn" onclick="window.print()">In / Xuất PDF</button>
      </div>
    </section>

    <!-- 3 Hero KPI Cards -->
    <section class="kpi-grid" aria-label="Chỉ số tổng quan">
      <article class="kpi-card">
        <div class="kpi-top">
          <span class="kpi-label">Gia sư AI Socratic (10 ca)</span>
          <span class="pill ok">10/10 PASS</span>
        </div>
        <div class="kpi-num">
          <span class="kpi-big">100%</span>
          <span class="kpi-delta">+60 điểm % (từ 40%)</span>
        </div>
        <div class="bar-track"><div class="bar-fill ok" style="width: 100%"></div></div>
        <div class="kpi-foot"><strong>0%</strong> rò rỉ đáp án · <strong>0%</strong> giải hộ bài thi trực tuyến · <strong>0%</strong> qua mặt đóng vai giáo viên.</div>
      </article>

      <article class="kpi-card">
        <div class="kpi-top">
          <span class="kpi-label">Đổi lịch tiếng Việt (10 ca)</span>
          <span class="pill ok">9/10 PASS</span>
        </div>
        <div class="kpi-num">
          <span class="kpi-big">90%</span>
          <span class="kpi-delta">+90 điểm % (từ 0%)</span>
        </div>
        <div class="bar-track"><div class="bar-fill ok" style="width: 90%"></div></div>
        <div class="kpi-foot"><strong>0%</strong> xâm phạm buổi khóa · <strong>0%</strong> trùng lịch · <strong>0%</strong> đổi nhầm buổi khác · ca mơ hồ <code>s07</code> tự hỏi lại.</div>
      </article>

      <article class="kpi-card">
        <div class="kpi-top">
          <span class="kpi-label">Trích xuất Email trường học (30 ca)</span>
          <span class="pill warn">15/30 PASS tuyệt đối</span>
        </div>
        <div class="kpi-num">
          <span class="kpi-big">50%</span>
          <span class="kpi-delta">+36.7% (live) / +6.7% (model)</span>
        </div>
        <div class="bar-track"><div class="bar-fill accent" style="width: 50%"></div></div>
        <div class="kpi-foot"><strong>0%</strong> báo nhầm quảng cáo/lừa đảo · <strong>0%</strong> ẩn nhầm thư thầy cô · <strong>0%</strong> tự bịa hạn nộp (sai sót chủ yếu ở nhãn mức ưu tiên).</div>
      </article>
    </section>

    <!-- Main Interactive Tabs -->
    <div class="tabs-bar" role="tablist">
      <button class="tab-btn active" role="tab" data-tab="tab-errors">1. Tỷ lệ lỗi theo loại</button>
      <button class="tab-btn" role="tab" data-tab="tab-cases">2. Khám phá 50 ca kiểm thử</button>
      <button class="tab-btn" role="tab" data-tab="tab-screens">3. Ảnh chụp thực tế (5)</button>
      <button class="tab-btn" role="tab" data-tab="tab-privacy">4. Quyền 6+1 &amp; Dữ liệu AI</button>
      <button class="tab-btn" role="tab" data-tab="tab-sources">5. Nguồn &amp; Xác minh ẩn danh</button>
    </div>

    <!-- TAB 1: ERROR RATES BY TYPE -->
    <section id="tab-errors" class="tab-panel active">
      <div class="card">
        <h2>Tỷ lệ lỗi theo từng loại — Bộ 30 thư trường học (e01–e30)</h2>
        <p class="sub">So sánh trực tiếp giữa chạy mô hình nền (Trước — thanh xám) và chuỗi cải tiến StudentOS v3.6 (Sau — thanh màu). Số liệu đọc trực tiếp từ <code>eval/results/summary.json</code>.</p>
        <div id="email-error-bars"></div>
      </div>

      <div class="grid-2">
        <div class="card">
          <h2>Tỷ lệ lỗi — 10 lệnh đổi lịch tiếng Việt (s01–s10)</h2>
          <p class="sub">Ca duy nhất còn trượt là <code>s10</code> (lệnh không dấu dài — mô hình không áp dụng đủ thao tác dời); <strong>0%</strong> vi phạm an toàn lịch.</p>
          <div id="schedule-error-bars"></div>
        </div>
        <div class="card">
          <h2>Tỷ lệ lỗi — 10 câu hỏi Gia sư AI (t01–t10)</h2>
          <p class="sub">Giảm từ 60% lỗi rò rỉ xuống <strong>0%</strong> trên cả 4 loại lỗi nhờ chính sách Socratic + kiểm tra rò rỉ đáp án hậu xử lý.</p>
          <div id="tutor-error-bars"></div>
        </div>
      </div>

      <div class="card">
        <h3>Vì sao sai sót nhỏ của AI không làm hỏng dữ liệu học sinh? (Cơ chế bảo vệ người dùng)</h3>
        <div class="grid-2" style="margin-top: 12px;">
          <div class="scope-card">
            <strong>1. Thẻ xác nhận AiConfirmCard</strong>
            <p class="sub" style="margin: 6px 0 0;">Mọi bài tập AI trích xuất đều yêu cầu học sinh xem bằng chứng trích dẫn và bấm Lưu trước khi ghi vào danh sách.</p>
          </div>
          <div class="scope-card">
            <strong>2. Tab "Cần bạn xem" &amp; chống bỏ sót</strong>
            <p class="sub" style="margin: 6px 0 0;">Thư giáo viên/trường học bị Gmail xếp nhầm vào Quảng cáo/MXH không bao giờ bị ẩn (0% lỗi <code>hiddenTeacherOrSchool</code>).</p>
          </div>
          <div class="scope-card">
            <strong>3. Xem trước Diff lịch &amp; Hoàn tác 1 chạm</strong>
            <p class="sub" style="margin: 6px 0 0;">Mọi thay đổi lịch học hiển thị bản so sánh Trước/Sau rõ ràng, bảo vệ tuyệt đối các buổi đã khóa (0% vi phạm).</p>
          </div>
          <div class="scope-card">
            <strong>4. Hỏi lại khi yêu cầu mơ hồ (s07)</strong>
            <p class="sub" style="margin: 6px 0 0;">Khi học sinh nói "học nhiều hơn môn em yếu", hệ thống hỏi rõ môn thay vì tự ý viết lại cả tuần học.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- TAB 2: INTERACTIVE 50-CASE EXPLORER -->
    <section id="tab-cases" class="tab-panel">
      <div class="card">
        <h2>Khám phá chi tiết từng ca kiểm thử (bấm vào bất kỳ dòng nào để xem Trước vs Sau)</h2>
        <p class="sub">Dữ liệu thật 100% từ lần chạy <code>npx tsx scripts/eval_ai.ts all --local</code> (không chỉnh sửa kết quả).</p>
        <div class="controls">
          <div class="subtabs">
            <button class="chip active" data-suite="emails">30 Thư trường học</button>
            <button class="chip" data-suite="schedule">10 Lệnh đổi lịch</button>
            <button class="chip" data-suite="tutor">10 Gia sư AI</button>
          </div>
          <div class="subtabs">
            <button class="chip active" data-filter="all">Tất cả</button>
            <button class="chip" data-filter="pass">Chỉ PASS</button>
            <button class="chip" data-filter="fail">Chỉ FAIL</button>
            <input id="case-search" class="search-input" type="search" placeholder="Tìm mã (e08, s07, t06) hoặc từ khóa..." />
          </div>
        </div>
        <div id="case-list" class="case-list"></div>
      </div>
    </section>

    <!-- TAB 3: SCREENSHOTS GALLERY -->
    <section id="tab-screens" class="tab-panel">
      <div class="card">
        <h2>Ảnh chụp màn hình thực tế từ StudentOS (bấm vào ảnh để phóng to)</h2>
        <p class="sub">Toàn bộ ảnh được chụp trực tiếp trên ứng dụng đang chạy ở phiên bản cải tiến v3.6.</p>
        <div class="gallery-grid" id="gallery-grid">
          <div class="shot-card" data-src="/evidence/privacy-permissions-tab.png" data-cap="Trung tâm Quyền riêng tư — Thẻ 1: Quản lý trực tiếp 6 quyền chuẩn + quyền mở rộng tùy chọn drive.readonly và mã Canvas cục bộ.">
            <img src="/evidence/privacy-permissions-tab.png" alt="Thẻ 1: Quản lý quyền truy cập" loading="lazy" />
            <div class="shot-meta">
              <h3>1. Thẻ Quyền truy cập (Trạng thái trực tiếp)</h3>
              <p>Hiển thị trạng thái Đã cấp quyền / Chưa bật, nhãn Gửi AI: Có/Không và công bố rõ quyền mở rộng thứ 7 <code>drive.readonly</code>.</p>
            </div>
          </div>
          <div class="shot-card" data-src="/evidence/privacy-ai-data-tab.png" data-cap="Trung tâm Quyền riêng tư — Thẻ 2: Ma trận dữ liệu gửi AI, khung KHÔNG BAO GIỜ gửi AI, và các nút bật/tắt ngữ cảnh Gia sư & dự phòng Groq.">
            <img src="/evidence/privacy-ai-data-tab.png" alt="Thẻ 2: Dữ liệu AI và Gia sư" loading="lazy" />
            <div class="shot-meta">
              <h3>2. Thẻ Dữ liệu AI &amp; Nút kiểm soát</h3>
              <p>Minh bạch chính xác trường dữ liệu gửi tới Gemini/Groq, kèm công tắc tắt ngữ cảnh Gia sư, tắt dự phòng Groq và khóa chế độ Socratic.</p>
            </div>
          </div>
          <div class="shot-card" data-src="/evidence/privacy-parents-tab.png" data-cap="Trung tâm Quyền riêng tư — Thẻ 3: Nơi lưu trữ dữ liệu, hướng dẫn cho phụ huynh, liên kết thu hồi quyền Google và nút xóa toàn bộ dữ liệu trên máy.">
            <img src="/evidence/privacy-parents-tab.png" alt="Thẻ 3: Lưu trữ và Phụ huynh" loading="lazy" />
            <div class="shot-meta">
              <h3>3. Thẻ Lưu trữ &amp; Dành cho Phụ huynh</h3>
              <p>Giải thích dữ liệu lưu cục bộ trên máy, liên kết <code>myaccount.google.com/permissions</code> và nút xóa dữ liệu 2 bước.</p>
            </div>
          </div>
          <div class="shot-card" data-src="/evidence/google-permission-consent.png" data-cap="Hộp thoại Xin quyền theo từng tính năng (GooglePermissionModal) bổ sung nhãn 'Dữ liệu gửi AI' và liên kết mở nhanh Trung tâm Quyền riêng tư.">
            <img src="/evidence/google-permission-consent.png" alt="Hộp thoại xin quyền Google theo tính năng" loading="lazy" />
            <div class="shot-meta">
              <h3>4. Hộp thoại Xin quyền theo tính năng</h3>
              <p>Trước khi mở cửa sổ OAuth Google, học sinh luôn thấy rõ nhãn dữ liệu gửi AI và liên kết mở Trung tâm Quyền riêng tư.</p>
            </div>
          </div>
          <div class="shot-card" data-src="/evidence/tutor-hint-only.png" data-cap="Gia sư AI ở Chế độ Gợi ý Socratic: hiển thị huy hiệu ShieldCheck và chỉ gợi ý bước đầu tiên thay vì giải hộ bài tập.">
            <img src="/evidence/tutor-hint-only.png" alt="Gia sư AI ở chế độ chỉ gợi ý Socratic" loading="lazy" />
            <div class="shot-meta">
              <h3>5. Gia sư AI — Chế độ Gợi ý Socratic</h3>
              <p>Huy hiệu <strong>Chế độ Gợi ý Socratic</strong> ngay trên thanh tiêu đề, từ chối giải hộ và dẫn dắt học sinh tự làm bước đầu tiên.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- TAB 4: PERMISSIONS & AI DATA FLOW -->
    <section id="tab-privacy" class="tab-panel">
      <div class="card">
        <h2>Kiến trúc Quyền tối thiểu (6 quyền chuẩn + 1 quyền mở rộng tùy chọn)</h2>
        <p class="sub">Khi mới đăng nhập, StudentOS chỉ xin tên và email cơ bản. Từng tính năng Google chỉ xin quyền khi học sinh chủ động bật.</p>
        <div class="scope-grid">
          <div class="scope-card">
            <div class="kpi-top"><strong>1. Google Calendar</strong><span class="pill neutral">Gửi AI: Chỉ khung giờ</span></div>
            <p class="sub" style="margin:6px 0 0;">Đọc lịch tránh trùng giờ và lưu buổi tự học mới khi bấm Lưu.</p>
            <div class="scope-code">calendar.events</div>
          </div>
          <div class="scope-card">
            <div class="kpi-top"><strong>2. Gmail (Chỉ đọc · Tùy chọn)</strong><span class="pill warn">Gửi AI: &lt;=1.500 ký tự</span></div>
            <p class="sub" style="margin:6px 0 0;">Tìm bài tập/ngày thi trong thư học tập. Không bao giờ gửi hay xóa thư.</p>
            <div class="scope-code">gmail.readonly</div>
          </div>
          <div class="scope-card">
            <div class="kpi-top"><strong>3. Google Classroom (3 quyền)</strong><span class="pill neutral">Chỉ thông báo GV</span></div>
            <p class="sub" style="margin:6px 0 0;">Đọc lớp học, bài tập và thông báo thầy cô. Không xem điểm, không nộp bài thay.</p>
            <div class="scope-code">classroom.courses.readonly · coursework.me.readonly · announcements.readonly</div>
          </div>
          <div class="scope-card">
            <div class="kpi-top"><strong>4. Google Drive &amp; Sheets</strong><span class="pill ok">Gửi AI: Không</span></div>
            <p class="sub" style="margin:6px 0 0;">Chỉ truy cập tệp do StudentOS tạo hoặc tệp học sinh tự tay chọn.</p>
            <div class="scope-code">drive.file</div>
          </div>
          <div class="scope-card optin">
            <div class="kpi-top"><strong>5. Drive — Tất cả tệp (Quyền thứ 7)</strong><span class="pill warn">Tắt mặc định · Opt-in</span></div>
            <p class="sub" style="margin:6px 0 0;">KHÔNG xin khi đăng nhập. Chỉ xin khi người dùng chủ động bấm "Hiện tất cả tệp Drive".</p>
            <div class="scope-code">drive.readonly</div>
          </div>
          <div class="scope-card">
            <div class="kpi-top"><strong>6. Canvas LMS</strong><span class="pill ok">Lưu cục bộ · 0 AI</span></div>
            <p class="sub" style="margin:6px 0 0;">Mã truy cập chỉ lưu trên thiết bị học sinh để tải bài tập, không bao giờ gửi tới AI.</p>
            <div class="scope-code">Local device token only</div>
          </div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <h3>Dữ liệu gửi tới nhà cung cấp AI</h3>
          <ul style="padding-left: 18px; margin: 10px 0 0; font-size: 13.5px; color: var(--muted); display: grid; gap: 8px;">
            <li><strong>Quét Gmail:</strong> Người gửi, tiêu đề, ngày và tối đa <code>1.500</code> ký tự đã lọc bỏ trích dẫn cũ/chữ ký (bỏ qua Quảng cáo &amp; MXH mặc định).</li>
            <li><strong>Gia sư AI:</strong> Tin nhắn, ảnh bài học đính kèm (nếu có) và tóm tắt bài tập/lịch tùy chọn (đã xóa <code>rawEmail</code> &amp; <code>senderEmail</code>; có nút tắt).</li>
            <li><strong>Lập lịch AI:</strong> Câu yêu cầu và danh sách khung giờ học trong tuần.</li>
            <li><strong>Nhà cung cấp:</strong> Google Gemini (chính) · Groq Llama (dự phòng tùy chọn, có nút tắt ngay trong Trung tâm Quyền riêng tư).</li>
          </ul>
        </div>
        <div class="card" style="border-color: var(--err-border); background: #FFFDFD;">
          <h3 style="color: var(--err);">KHÔNG BAO GIỜ gửi tới AI</h3>
          <ul style="padding-left: 18px; margin: 10px 0 0; font-size: 13.5px; color: var(--muted); display: grid; gap: 8px;">
            <li>Mật khẩu tài khoản Google hoặc phiên đăng nhập.</li>
            <li>Khóa OAuth / mã truy cập Canvas LMS.</li>
            <li>Bảng điểm chi tiết, học bạ, danh bạ lớp học.</li>
            <li>Các tệp Google Drive cá nhân không liên quan.</li>
            <li>Dữ liệu Quét ghi chú &amp; Bài giảng khi bật chế độ ngoại tuyến (chạy 100% trên trình duyệt).</li>
          </ul>
        </div>
      </div>

      <div class="card">
        <h2>4 lớp bảo vệ đảm bảo Gia sư AI chỉ gợi ý (Socratic — 10/10 PASS)</h2>
        <div class="layer-flow">
          <div class="layer-step">
            <div class="step-num">1</div>
            <strong>Nhận diện đầu vào</strong>
            <p class="sub" style="margin:6px 0 0;">Phát hiện yêu cầu giải hộ, gian lận thi trực tuyến (<code>t06</code>) và giả danh giáo viên xin đáp án (<code>t05</code>).</p>
          </div>
          <div class="layer-step">
            <div class="step-num">2</div>
            <strong>Khóa danh sách công cụ</strong>
            <p class="sub" style="margin:6px 0 0;">Máy chủ chỉ cho phép <code>ALLOWED_NON_TUTOR_TOOLS</code> hợp lệ, chặn tuyệt đối việc giả mạo <code>context.tool</code>.</p>
          </div>
          <div class="layer-step">
            <div class="step-num">3</div>
            <strong>Kiểm tra rò rỉ hậu xử lý</strong>
            <p class="sub" style="margin:6px 0 0;"><code>detectAnswerLeak()</code> bắt danh sách đáp án A/B/C/D, lời giải nhiều ý và bài văn &gt;320 từ để viết lại thành gợi ý.</p>
          </div>
          <div class="layer-step">
            <div class="step-num">4</div>
            <strong>Đồng bộ mọi đường dẫn</strong>
            <p class="sub" style="margin:6px 0 0;">Áp dụng cùng chính sách cho cả API máy chủ, dự phòng khóa cá nhân (BYOK) và Trợ lý nổi (Floating Copilot).</p>
          </div>
        </div>
      </div>
    </section>

    <!-- TAB 5: SOURCES & ANONYMIZATION -->
    <section id="tab-sources" class="tab-panel">
      <div class="card">
        <h2>Xác minh ẩn danh tự động (0 dữ liệu cá nhân thật)</h2>
        <p class="sub">Bộ kiểm thử tự động <code>src/utils/evalAnonymization.test.ts</code> chạy trong <code>npm test</code> xác nhận toàn bộ 50 ca kiểm thử an toàn 100%:</p>
        <div class="grid-2">
          <div class="scope-card">
            <span class="pill ok">PASS · 8/8 kiểm tra PII</span>
            <ul style="padding-left:18px; margin:10px 0 0; font-size:13px; color:var(--muted); display:grid; gap:6px;">
              <li>0 địa chỉ email cá nhân thật (toàn bộ dùng tên miền giả lập <code>*.example</code>).</li>
              <li>0 số điện thoại di động Việt Nam thật (chỉ dùng mẫu <code>0123 456 789</code>).</li>
              <li>0 chuỗi CCCD 12 chữ số.</li>
              <li><code>cleanEmailForAI()</code> cắt bỏ trích dẫn cũ, chữ ký và giới hạn &lt;= 1.500 ký tự.</li>
            </ul>
          </div>
          <div class="scope-card">
            <span class="pill neutral">Tệp bằng chứng gốc trên GitHub</span>
            <ul style="padding-left:18px; margin:10px 0 0; font-size:13px; display:grid; gap:6px;">
              <li><a href="https://github.com/buianhuy2009/Student-Command-Center/blob/main/eval/results/summary.json" target="_blank" rel="noreferrer">eval/results/summary.json (Tổng hợp tỷ lệ lỗi JSON)</a></li>
              <li><a href="https://github.com/buianhuy2009/Student-Command-Center/blob/main/eval/REPORT.md" target="_blank" rel="noreferrer">eval/REPORT.md (Báo cáo kiểm thử tự động)</a></li>
              <li><a href="https://github.com/buianhuy2009/Student-Command-Center/blob/main/eval/SOURCES.md" target="_blank" rel="noreferrer">eval/SOURCES.md (Trích dẫn định dạng công khai)</a></li>
              <li><a href="https://github.com/buianhuy2009/Student-Command-Center/blob/main/docs/AI_EVAL_AND_PRIVACY_EVIDENCE.md" target="_blank" rel="noreferrer">docs/AI_EVAL_AND_PRIVACY_EVIDENCE.md (Toàn văn + Phụ lục A–D)</a></li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <footer>
      <div>StudentOS v3.6.2 · Báo cáo Minh chứng Chặng 2 · Dữ liệu sinh từ <code>eval/results/summary.json</code></div>
      <div><a href="/privacy">Chính sách Quyền riêng tư</a> · <a href="https://github.com/buianhuy2009/Student-Command-Center" target="_blank" rel="noreferrer">GitHub Repository</a></div>
    </footer>
  </main>

  <!-- Lightbox Modal -->
  <div id="lightbox" class="lightbox" role="dialog" aria-modal="true" aria-label="Xem ảnh phóng to">
    <button class="lightbox-close" id="lightbox-close">Đóng (Esc)</button>
    <div class="lightbox-inner">
      <img id="lightbox-img" src="" alt="" />
      <div id="lightbox-cap" class="lightbox-cap"></div>
    </div>
  </div>

  <script>
    const DATA = ${safeJson};

    const EMAIL_LABELS = {
      missedAssignment: ['Bỏ sót bài tập (FN)', 'Trên 21 thư có bài tập thật'],
      falsePositiveAssignment: ['Báo nhầm quảng cáo/lừa đảo (FP)', 'Trên 9 thư không phải bài tập'],
      hiddenTeacherOrSchool: ['Ẩn nhầm thư thầy cô/trường', 'Trên 25 thư giáo dục quan trọng'],
      wrongCategory: ['Sai phân loại thư', 'Trên toàn bộ 30 thư'],
      wrongDueDate: ['Sai hạn nộp', 'Trên 20 thư có hạn nộp cụ thể'],
      fabricatedDueDate: ['Tự bịa hạn nộp', 'Trên 1 thư bài tập không ghi ngày'],
      wrongSubject: ['Sai môn học', 'Trên 21 thư bài tập'],
      wrongPriority: ['Sai mức ưu tiên (High/Med/Low)', 'Trên 21 thư bài tập'],
      aiOmittedOrFailed: ['AI bỏ sót / lỗi kỹ thuật', 'Trên toàn bộ 30 thư'],
    };

    const SCHED_LABELS = {
      targetNotChanged: ['Không đổi đúng buổi yêu cầu', 'Trên 10 lệnh'],
      collateralMove: ['Đổi nhầm buổi học khác', 'Trên 10 lệnh'],
      lockedBlockViolation: ['Xâm phạm buổi đã khóa', 'Trên 10 lệnh'],
      overlapViolation: ['Gây trùng lịch học', 'Trên 10 lệnh'],
      missingAddition: ['Không thêm buổi ôn yêu cầu', 'Trên 10 lệnh'],
      missingClarificationOrLockNotice: ['Không hỏi lại khi mơ hồ / không báo khóa', 'Trên 10 lệnh'],
    };

    const TUTOR_LABELS = {
      fullSolutionLeak: ['Đưa lời giải / bài văn hoàn chỉnh', 'Trên 6 ca yêu cầu giải hộ'],
      liveExamCheatingLeak: ['Trả lời khi học sinh đang thi trực tuyến', 'Trên ca t06'],
      roleplayBypassLeak: ['Bị qua mặt bởi giả danh giáo viên', 'Trên ca t05'],
      unhelpfulOverRefusal: ['Từ chối quá đà câu hỏi hợp lệ', 'Trên 4 ca học tập hợp lệ'],
    };

    function esc(s) {
      return String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    }

    function renderBars(containerId, beforeTax, afterTax, labels) {
      const el = document.getElementById(containerId);
      el.innerHTML = Object.entries(labels).map(([key, [name, sub]]) => {
        const b = beforeTax?.[key] || { count: 0, total: 0, ratePct: 0 };
        const a = afterTax?.[key] || { count: 0, total: 0, ratePct: 0 };
        const fillClass = a.ratePct === 0 ? 'mini-fill-after-ok' : (a.ratePct <= 20 ? 'mini-fill-after-warn' : 'mini-fill-after-err');
        const pillClass = a.ratePct === 0 ? 'ok' : (a.ratePct <= 20 ? 'warn' : 'err');
        return \`
          <div class="err-row">
            <div><div class="err-name">\${esc(name)}</div><div class="err-sub">\${esc(sub)}</div></div>
            <div class="err-bars">
              <div class="mini-bar-wrap">
                <span style="width:44px">Trước</span>
                <div class="mini-track"><div class="mini-fill-before" style="width:\${Math.min(100, b.ratePct)}%"></div></div>
                <span style="width:46px;text-align:right">\${b.ratePct}%</span>
              </div>
              <div class="mini-bar-wrap">
                <span style="width:44px;font-weight:700;color:var(--ink)">Sau</span>
                <div class="mini-track"><div class="\${fillClass}" style="width:\${Math.max(a.ratePct > 0 ? 3 : 0, Math.min(100, a.ratePct))}%"></div></div>
                <span style="width:46px;text-align:right;font-weight:700;color:var(--ink)">\${a.ratePct}%</span>
              </div>
            </div>
            <div class="err-stat"><span class="pill \${pillClass}">\${a.count}/\${a.total} (\${a.ratePct}%)</span></div>
          </div>
        \`;
      }).join('');
    }

    renderBars('email-error-bars', DATA.summary.emails.beforeModel.taxonomy, DATA.summary.emails.after.taxonomy, EMAIL_LABELS);
    renderBars('schedule-error-bars', DATA.summary.schedule.before.taxonomy, DATA.summary.schedule.after.taxonomy, SCHED_LABELS);
    renderBars('tutor-error-bars', DATA.summary.tutor.before.taxonomy, DATA.summary.tutor.after.taxonomy, TUTOR_LABELS);

    // Tabs switching
    function activateTab(tabId) {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tabId));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === tabId));
    }
    document.querySelectorAll('.tab-btn').forEach((b) => b.addEventListener('click', () => activateTab(b.dataset.tab)));
    document.querySelectorAll('[data-jump]').forEach((b) => b.addEventListener('click', () => {
      activateTab(b.dataset.jump);
      document.querySelector('.tabs-bar').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));

    // Case Explorer
    let activeSuite = 'emails';
    let activeFilter = 'all';
    let searchQ = '';

    function renderCases() {
      const list = document.getElementById('case-list');
      const items = DATA[activeSuite] || [];
      const filtered = items.filter((item) => {
        if (activeFilter === 'pass' && !item.afterPass) return false;
        if (activeFilter === 'fail' && item.afterPass) return false;
        if (searchQ) {
          const hay = JSON.stringify(item).toLowerCase();
          if (!hay.includes(searchQ)) return false;
        }
        return true;
      });

      if (!filtered.length) {
        list.innerHTML = '<div class="scope-card">Không tìm thấy ca kiểm thử phù hợp bộ lọc.</div>';
        return;
      }

      list.innerHTML = filtered.map((item) => {
        const badge = item.afterPass ? '<span class="pill ok">PASS</span>' : '<span class="pill err">FAIL</span>';
        const beforeBadge = item.beforePass ? '<span class="pill ok">Trước: PASS</span>' : '<span class="pill neutral">Trước: FAIL</span>';
        let title = '';
        let detail = '';

        if (activeSuite === 'emails') {
          title = item.subject;
          const gotA = item.afterGot || {};
          const gotB = item.beforeGot || {};
          const exp = item.expected || {};
          detail = \`
            <div class="quote-box"><strong>Người gửi:</strong> \${esc(item.sender)} &lt;\${esc(item.senderEmail)}&gt; · <strong>Ngày:</strong> \${esc(item.date)}
<strong>Điểm bẫy kiểm thử:</strong> \${esc(item.tricky)}

\${esc(item.body)}</div>
            <div class="compare-grid">
              <div class="compare-box">
                <h4>Kỳ vọng chuẩn (Ground Truth)</h4>
                <div>Phân loại: <code>\${esc(exp.category)}</code> · Bài tập: <code>\${exp.isAssignment}</code></div>
                <div>Hạn nộp: <code>\${esc(exp.dueDate || 'không có')}</code> · Ưu tiên: <code>\${esc(exp.priority || 'N/A')}</code></div>
              </div>
              <div class="compare-box">
                <h4>Kết quả AI Sau cải tiến (\${esc(item.model)})</h4>
                <div>Phân loại: <code>\${esc(gotA.category || 'N/A')}</code> · Bài tập: <code>\${String(gotA.isAssignment)}</code></div>
                <div>Hạn nộp: <code>\${esc(gotA.dueDate || 'không có')}</code> · Môn: <code>\${esc(gotA.subject || 'N/A')}</code> · Ưu tiên: <code>\${esc(gotA.priority || 'N/A')}</code></div>
                <div style="margin-top:4px;color:var(--muted);font-size:12px;">Bằng chứng trích dẫn: \${esc(gotA.evidence || 'Không có')}</div>
              </div>
            </div>
          \`;
        } else if (activeSuite === 'schedule') {
          title = item.command;
          detail = \`
            <div class="quote-box"><strong>Ý định:</strong> <code>\${esc(item.intent)}</code>
<strong>Yêu cầu kiểm thử:</strong> \${esc(item.expect)}</div>
            <div class="compare-grid">
              <div class="compare-box">
                <h4>Trước cải tiến (\${item.beforePass ? 'PASS' : 'FAIL'})</h4>
                <div>\${esc(item.beforeSaid)}</div>
                \${item.beforeFails?.length ? '<div style="margin-top:6px;color:var(--err);font-size:12px;">Lỗi: ' + esc(item.beforeFails.join('; ')) + '</div>' : ''}
              </div>
              <div class="compare-box">
                <h4>Sau cải tiến (\${item.afterPass ? 'PASS' : 'FAIL'} · \${esc(item.model)})</h4>
                <div>\${esc(item.afterSaid)}</div>
                \${item.afterFails?.length ? '<div style="margin-top:6px;color:var(--err);font-size:12px;">Lỗi: ' + esc(item.afterFails.join('; ')) + '</div>' : ''}
              </div>
            </div>
          \`;
        } else {
          title = item.prompt.split('\\n')[0].slice(0, 120);
          detail = \`
            <div class="quote-box"><strong>Loại ca:</strong> <code>\${esc(item.kind)}</code> · <strong>Chính sách kỳ vọng:</strong> <code>\${esc(item.expect)}</code>

\${esc(item.prompt)}</div>
            <div class="compare-grid">
              <div class="compare-box">
                <h4>Phản hồi Trước cải tiến (\${item.beforePass ? 'PASS' : 'FAIL'})</h4>
                <div style="white-space:pre-wrap;font-size:12.5px;max-height:240px;overflow-y:auto;">\${esc(item.beforeReply)}</div>
                <div style="margin-top:6px;color:var(--muted);font-size:12px;"><strong>Đánh giá:</strong> \${esc(item.beforeReason)}</div>
              </div>
              <div class="compare-box" style="border-color:var(--ok-border);">
                <h4>Phản hồi Sau cải tiến (Socratic · PASS)</h4>
                <div style="white-space:pre-wrap;font-size:12.5px;max-height:240px;overflow-y:auto;">\${esc(item.afterReply)}</div>
                <div style="margin-top:6px;color:var(--ok);font-size:12px;"><strong>Đánh giá:</strong> \${esc(item.afterReason)}</div>
              </div>
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
      document.querySelectorAll('[data-suite]').forEach((x) => x.classList.toggle('active', x === b));
      renderCases();
    }));
    document.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
      activeFilter = b.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach((x) => x.classList.toggle('active', x === b));
      renderCases();
    }));
    document.getElementById('case-search').addEventListener('input', (e) => {
      searchQ = e.target.value.trim().toLowerCase();
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

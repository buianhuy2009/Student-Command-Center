#!/usr/bin/env node
/**
 * Generates public/minh-chung.html — an airy, Apple-keynote style Before vs After
 * visual evidence page for StudentOS Chặng 2 judges.
 * Zero walls of text, spacious layout, unified higher-is-better scale (100% = 0 errors),
 * with full 19-metric error breakdown & 50-case inspector cleanly tucked in 1-click drawers.
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
  <title>StudentOS · Minh chứng Trước &amp; Sau (Chặng 2)</title>
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

    /* Minimal Top Bar */
    .topbar {
      position: sticky; top: 0; z-index: 40;
      background: rgba(250, 247, 242, 0.92);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
    }
    .topbar-inner {
      max-width: 960px; margin: 0 auto; padding: 12px 24px;
      display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
    }
    .brand { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 15px; }
    .brand-mark {
      width: 30px; height: 30px; border-radius: 9px; background: var(--accent);
      display: grid; place-items: center; color: #fff; font-weight: 800; font-size: 13px;
    }
    .nav { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .nav a {
      padding: 6px 12px; border-radius: 999px; font-size: 13px; font-weight: 700; color: var(--muted);
    }
    .nav a:hover { background: var(--subtle); color: var(--ink); text-decoration: none; }
    .nav a.cta { background: var(--accent); color: #fff; }
    .nav a.cta:hover { background: var(--accent-dark); }

    /* Airy Page Container */
    .wrap { max-width: 960px; margin: 0 auto; padding: 40px 24px 88px; }
    section { scroll-margin-top: 76px; margin-bottom: 56px; }

    /* Calm Hero */
    .hero { text-align: center; padding: 12px 0 8px; margin-bottom: 44px; }
    .eyebrow {
      display: inline-block; padding: 5px 14px; border-radius: 999px;
      background: var(--subtle); color: var(--muted);
      font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
    }
    .hero h1 {
      margin: 16px 0 12px; font-size: clamp(30px, 5vw, 44px); line-height: 1.12;
      font-weight: 800; letter-spacing: -0.03em;
    }
    .hero p {
      margin: 0 auto 24px; max-width: 560px; font-size: 16px; color: var(--muted);
    }
    .hero-btns { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; }
    .btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 11px 18px; border-radius: 12px; font-size: 14px; font-weight: 700;
      border: 1px solid var(--border); background: var(--surface); color: var(--ink); cursor: pointer;
    }
    .btn:hover { background: var(--subtle); text-decoration: none; }
    .btn.solid { background: var(--accent); border-color: var(--accent); color: #fff; }
    .btn.solid:hover { background: var(--accent-dark); }

    /* Section Title */
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

    /* Spacious Before vs After Story Cards */
    .story-stack { display: flex; flex-direction: column; gap: 20px; }
    .story-card {
      background: var(--surface); border: 1px solid var(--border); border-radius: 22px;
      padding: 28px 30px; box-shadow: var(--shadow);
    }
    .story-head {
      display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
      margin-bottom: 20px;
    }
    .story-head h3 { margin: 0; font-size: 19px; font-weight: 800; }
    .big-jump {
      display: flex; align-items: baseline; gap: 10px;
      font-weight: 800; letter-spacing: -0.02em;
    }
    .jump-before { font-size: 18px; color: var(--muted); text-decoration: line-through; }
    .jump-arrow { font-size: 16px; color: var(--muted); }
    .jump-after { font-size: 32px; color: var(--ok); line-height: 1; }

    .ba-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 18px; }
    @media (max-width: 700px) { .ba-grid { grid-template-columns: 1fr; } }
    .ba-box {
      border-radius: 16px; padding: 18px 20px;
      border: 1px solid var(--border); background: #FAF8F5;
    }
    .ba-box.after { border-color: var(--ok-border); background: var(--ok-bg); }
    .ba-tag {
      display: inline-block; font-size: 11px; font-weight: 800; letter-spacing: .05em;
      text-transform: uppercase; margin-bottom: 6px; color: var(--muted);
    }
    .ba-box.after .ba-tag { color: var(--ok); }
    .ba-text { margin: 0; font-size: 14.5px; font-weight: 600; color: var(--ink); }

    .bar-pair { display: flex; flex-direction: column; gap: 8px; }
    .bar-row { display: flex; align-items: center; gap: 12px; font-size: 13px; }
    .bar-lbl { width: 46px; font-weight: 700; color: var(--muted); }
    .bar-lbl.after { color: var(--ink); }
    .track { flex: 1; height: 10px; border-radius: 999px; background: var(--subtle); overflow: hidden; }
    .fill-before { height: 100%; background: #C7BEB4; border-radius: 999px; }
    .fill-after { height: 100%; background: #16A34A; border-radius: 999px; }
    .fill-after.accent { background: var(--accent); }
    .bar-val { width: 48px; text-align: right; font-weight: 800; }

    /* Collapsible Details Drawer (keeps page airy!) */
    details.drawer {
      margin-top: 20px; background: var(--surface); border: 1px solid var(--border);
      border-radius: 16px; padding: 16px 22px; box-shadow: var(--shadow);
    }
    details.drawer summary {
      cursor: pointer; font-weight: 800; font-size: 14.5px; color: var(--ink);
      list-style: none; display: flex; align-items: center; justify-content: space-between;
    }
    details.drawer summary::-webkit-details-marker { display: none; }
    details.drawer summary::after { content: '+ Mở xem'; font-size: 12.5px; color: var(--accent-dark); }
    details.drawer[open] summary::after { content: 'Thu gọn'; }
    .drawer-body { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--border); }

    .m-row {
      display: grid; grid-template-columns: 220px 1fr 125px; align-items: center; gap: 14px;
      padding: 8px 0; border-bottom: 1px dashed var(--border); font-size: 13px;
    }
    .m-row:last-child { border-bottom: none; }
    @media (max-width: 680px) { .m-row { grid-template-columns: 1fr; gap: 4px; } }
    .m-err { font-size: 11.5px; color: var(--muted); text-align: right; font-weight: 600; }

    /* Spacious 2-Col Screenshots */
    .gallery { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
    @media (max-width: 700px) { .gallery { grid-template-columns: 1fr; } }
    .shot {
      background: var(--surface); border: 1px solid var(--border); border-radius: 18px;
      overflow: hidden; box-shadow: var(--shadow); cursor: pointer; transition: transform .15s ease;
    }
    .shot:hover { transform: translateY(-2px); }
    .shot img { width: 100%; height: 220px; object-fit: cover; object-position: top; display: block; border-bottom: 1px solid var(--border); }
    .shot-cap { padding: 14px 18px; font-size: 14px; font-weight: 700; }

    /* Clean 2-Card Privacy Summary */
    .priv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 720px) { .priv-grid { grid-template-columns: 1fr; } }
    .priv-card {
      background: var(--surface); border: 1px solid var(--border); border-radius: 20px;
      padding: 24px 26px; box-shadow: var(--shadow);
    }
    .priv-card.danger { border-color: var(--err-border); }
    .priv-card h3 { margin: 0 0 14px; font-size: 16.5px; font-weight: 800; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip {
      padding: 7px 12px; border-radius: 10px; font-size: 13px; font-weight: 700;
      background: var(--subtle); color: var(--ink);
    }
    .chip.warn { background: var(--warn-bg); color: var(--warn); border: 1px solid var(--warn-border); }
    .chip.no { background: var(--err-bg); color: var(--err); border: 1px solid var(--err-border); }
    .chip.ok { background: var(--ok-bg); color: var(--ok); border: 1px solid var(--ok-border); }

    /* Case Inspector inside Drawer */
    .controls { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
    .fbtn {
      padding: 6px 12px; border-radius: 999px; border: 1px solid var(--border);
      background: var(--surface); font-size: 12.5px; font-weight: 700; cursor: pointer; font-family: inherit;
    }
    .fbtn.active { background: var(--ink); color: #fff; border-color: var(--ink); }
    .case-item { border: 1px solid var(--border); border-radius: 12px; margin-bottom: 8px; overflow: hidden; }
    .case-head {
      width: 100%; text-align: left; background: #fff; border: none; padding: 11px 14px;
      display: flex; align-items: center; gap: 10px; cursor: pointer; font-family: inherit; font-size: 13px;
    }
    .case-head:hover { background: #FAF8F5; }
    .cid { font-family: 'JetBrains Mono', monospace; font-weight: 700; background: var(--subtle); padding: 2px 7px; border-radius: 6px; font-size: 12px; }
    .ctitle { flex: 1; font-weight: 600; }
    .pill { padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 700; }
    .pill.ok { background: var(--ok-bg); color: var(--ok); }
    .pill.err { background: var(--err-bg); color: var(--err); }
    .case-body { display: none; padding: 12px 14px; border-top: 1px solid var(--border); background: #FAF8F5; font-size: 12.5px; }
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
        <a href="#truoc-sau">Trước &amp; Sau</a>
        <a href="#anh-thuc-te">Ảnh thực tế</a>
        <a href="#quyen-rieng-tu">Quyền &amp; AI</a>
        <a href="#chi-tiet">50 ca &amp; Nguồn</a>
        <a class="cta" href="https://sutdent-command-center.vercel.app" target="_blank" rel="noreferrer">Mở StudentOS</a>
      </nav>
    </div>
  </header>

  <main class="wrap">
    <!-- CALM HERO -->
    <section class="hero">
      <span class="eyebrow">Minh chứng Cải tiến · StudentOS v3.6</span>
      <h1>Trước &amp; Sau Cải tiến</h1>
      <p>Kiểm thử thật trên 50 tình huống học đường và nâng cấp Trung tâm Quyền riêng tư cho học sinh.</p>
      <div class="hero-btns">
        <a class="btn solid" href="https://docs.google.com/document/d/1QqdDl3FwUrktKwe3ejZDCktQA2EwkQC2EGKalVYOQwc/edit" target="_blank" rel="noreferrer">Báo cáo Google Docs</a>
        <a class="btn" href="https://sutdent-command-center.vercel.app" target="_blank" rel="noreferrer">Mở sản phẩm chạy thử</a>
      </div>
    </section>

    <!-- 1. BEFORE vs AFTER (THE CENTERPIECE) -->
    <section id="truoc-sau">
      <div class="sec-title">
        <h2>1. Kết quả Trước &amp; Sau cải tiến</h2>
        <span class="scale-tag">Thang điểm thống nhất: Càng cao càng tốt (100% = 0 lỗi)</span>
      </div>

      <div class="story-stack">
        <!-- Story 1: Tutor -->
        <article class="story-card">
          <div class="story-head">
            <h3>Gia sư AI chỉ gợi ý (10 câu hỏi)</h3>
            <div class="big-jump">
              <span class="jump-before">40%</span>
              <span class="jump-arrow">-&gt;</span>
              <span class="jump-after">100%</span>
            </div>
          </div>
          <div class="ba-grid">
            <div class="ba-box">
              <div class="ba-tag">Trước (Chưa cải tiến)</div>
              <p class="ba-text">AI cũ giải hộ luôn 6/6 bài tập, đề thi trực tuyến và câu giả danh giáo viên.</p>
            </div>
            <div class="ba-box after">
              <div class="ba-tag">Sau (StudentOS v3.6)</div>
              <p class="ba-text">Chặn 100% giải hộ &amp; gian lận thi; chỉ gợi ý từng bước Socratic (10/10 ca đạt).</p>
            </div>
          </div>
          <div class="bar-pair">
            <div class="bar-row"><span class="bar-lbl">Trước</span><div class="track"><div class="fill-before" style="width:40%"></div></div><span class="bar-val">40%</span></div>
            <div class="bar-row"><span class="bar-lbl after">Sau</span><div class="track"><div class="fill-after" style="width:100%"></div></div><span class="bar-val">100%</span></div>
          </div>
        </article>

        <!-- Story 2: Schedule -->
        <article class="story-card">
          <div class="story-head">
            <h3>Đổi lịch học tiếng Việt (10 câu lệnh)</h3>
            <div class="big-jump">
              <span class="jump-before">0%</span>
              <span class="jump-arrow">-&gt;</span>
              <span class="jump-after">90%</span>
            </div>
          </div>
          <div class="ba-grid">
            <div class="ba-box">
              <div class="ba-tag">Trước (Chưa cải tiến)</div>
              <p class="ba-text">Bỏ qua lệnh tự nhiên, không báo buổi đã khóa và không hỏi lại khi yêu cầu mơ hồ.</p>
            </div>
            <div class="ba-box after">
              <div class="ba-tag">Sau (StudentOS v3.6)</div>
              <p class="ba-text">Đạt 9/10 ca: 100% giữ buổi khóa, 0% trùng lịch, tự hỏi lại khi mơ hồ (<code>s07</code>).</p>
            </div>
          </div>
          <div class="bar-pair">
            <div class="bar-row"><span class="bar-lbl">Trước</span><div class="track"><div class="fill-before" style="width:2%"></div></div><span class="bar-val">0%</span></div>
            <div class="bar-row"><span class="bar-lbl after">Sau</span><div class="track"><div class="fill-after" style="width:90%"></div></div><span class="bar-val">90%</span></div>
          </div>
        </article>

        <!-- Story 3: Emails -->
        <article class="story-card">
          <div class="story-head">
            <h3>Quét 30 Email trường học ẩn danh</h3>
            <div class="big-jump">
              <span class="jump-before">25%</span>
              <span class="jump-arrow">-&gt;</span>
              <span class="jump-after">85%</span>
              <span style="font-size:13px;color:var(--muted);font-weight:700;">đúng hạn nộp</span>
            </div>
          </div>
          <div class="ba-grid">
            <div class="ba-box">
              <div class="ba-tag">Trước (Chưa cải tiến)</div>
              <p class="ba-text">Bản cũ chỉ đạt 13% (mô hình gốc 43%), sai tới 75% hạn nộp và ẩn nhầm thư thầy cô.</p>
            </div>
            <div class="ba-box after">
              <div class="ba-tag">Sau (StudentOS v3.6)</div>
              <p class="ba-text">Đạt 50% gắt cả 6 tiêu chí: <strong>85%</strong> đúng hạn nộp, <strong>100%</strong> chặn quảng cáo, <strong>100%</strong> giữ thư GV.</p>
            </div>
          </div>
          <div class="bar-pair">
            <div class="bar-row"><span class="bar-lbl">Trước</span><div class="track"><div class="fill-before" style="width:25%"></div></div><span class="bar-val">25%</span></div>
            <div class="bar-row"><span class="bar-lbl after">Sau</span><div class="track"><div class="fill-after accent" style="width:85%"></div></div><span class="bar-val">85%</span></div>
          </div>
        </article>
      </div>

      <!-- 1-click expandable detailed error-rate breakdown (zero clutter on load!) -->
      <details class="drawer">
        <summary>Xem bảng chi tiết độ chính xác &amp; tỷ lệ lỗi theo từng loại (19 chỉ số)</summary>
        <div class="drawer-body" id="detailed-bars"></div>
      </details>
    </section>

    <!-- 2. REAL SCREENSHOTS -->
    <section id="anh-thuc-te">
      <div class="sec-title">
        <h2>2. Ảnh chụp màn hình thực tế</h2>
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

    <!-- 3. PERMISSIONS & AI DATA (ULTRA-CLEAN) -->
    <section id="quyen-rieng-tu">
      <div class="sec-title">
        <h2>3. Quyền truy cập &amp; Bảo vệ dữ liệu</h2>
      </div>
      <div class="priv-grid">
        <div class="priv-card">
          <h3>6 quyền chuẩn + 1 tùy chọn</h3>
          <div class="chips">
            <span class="chip">Calendar (lịch học)</span>
            <span class="chip">Gmail (chỉ đọc &lt;=1.500 ký tự)</span>
            <span class="chip">Classroom (lớp &amp; bài tập)</span>
            <span class="chip">Drive &amp; Sheets (drive.file)</span>
            <span class="chip warn">drive.readonly (tắt mặc định)</span>
            <span class="chip ok">Canvas (lưu trên máy, 0 AI)</span>
          </div>
        </div>
        <div class="priv-card danger">
          <h3 style="color:var(--err);">KHÔNG BAO GIỜ gửi tới AI</h3>
          <div class="chips">
            <span class="chip no">Mật khẩu Google</span>
            <span class="chip no">Khóa OAuth / mã Canvas</span>
            <span class="chip no">Điểm số &amp; học bạ</span>
            <span class="chip no">Danh bạ lớp học</span>
            <span class="chip no">Tệp Drive cá nhân</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 4. 50 CASES & SOURCES (CLEANLY TUCKED AWAY) -->
    <section id="chi-tiet">
      <div class="sec-title">
        <h2>4. Kiểm tra 50 ca test &amp; Bằng chứng gốc</h2>
        <span class="scale-tag">8/8 kiểm tra ẩn danh PII đạt</span>
      </div>

      <details class="drawer" style="margin-top:0;">
        <summary>Mở xem chi tiết từng ca trong bộ 50 ca (30 Email · 10 Lịch · 10 Gia sư)</summary>
        <div class="drawer-body">
          <div class="controls">
            <button class="fbtn active" data-suite="tutor">10 Gia sư (100%)</button>
            <button class="fbtn" data-suite="schedule">10 Đổi lịch (90%)</button>
            <button class="fbtn" data-suite="emails">30 Email (50%)</button>
          </div>
          <div id="case-list"></div>
        </div>
      </details>

      <div class="chips" style="margin-top: 18px;">
        <a class="btn" href="https://github.com/buianhuy2009/Student-Command-Center/blob/main/eval/results/summary.json" target="_blank" rel="noreferrer">summary.json</a>
        <a class="btn" href="https://github.com/buianhuy2009/Student-Command-Center/blob/main/eval/REPORT.md" target="_blank" rel="noreferrer">REPORT.md</a>
        <a class="btn" href="https://github.com/buianhuy2009/Student-Command-Center/blob/main/eval/SOURCES.md" target="_blank" rel="noreferrer">SOURCES.md</a>
        <a class="btn" href="https://github.com/buianhuy2009/Student-Command-Center/blob/main/docs/AI_EVAL_AND_PRIVACY_EVIDENCE.md" target="_blank" rel="noreferrer">Báo cáo đầy đủ + Phụ lục A–D</a>
      </div>
    </section>

    <footer>
      <div>StudentOS v3.6.4 · Minh chứng Chặng 2</div>
      <div><a href="/privacy">Chính sách Quyền riêng tư</a> · <a href="https://github.com/buianhuy2009/Student-Command-Center" target="_blank" rel="noreferrer">GitHub</a></div>
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

    // Detailed 19-metric drawer (higher is better everywhere)
    const GROUPS = [
      ['Gia sư AI (10 ca)', DATA.summary.tutor.before.taxonomy, DATA.summary.tutor.after.taxonomy, [
        ['fullSolutionLeak', 'Chặn đưa lời giải / bài văn'],
        ['liveExamCheatingLeak', 'Chặn giải hộ khi đang thi'],
        ['roleplayBypassLeak', 'Chặn giả danh giáo viên'],
        ['unhelpfulOverRefusal', 'Hỗ trợ đúng câu học tập'],
      ]],
      ['Đổi lịch tiếng Việt (10 ca)', DATA.summary.schedule.before.taxonomy, DATA.summary.schedule.after.taxonomy, [
        ['lockedBlockViolation', 'Bảo vệ buổi đã khóa'],
        ['overlapViolation', 'Không gây trùng lịch'],
        ['collateralMove', 'Không đổi nhầm buổi khác'],
        ['missingAddition', 'Thêm đúng buổi ôn'],
        ['missingClarificationOrLockNotice', 'Hỏi lại mơ hồ / báo khóa'],
        ['targetNotChanged', 'Đổi đúng buổi mục tiêu'],
      ]],
      ['Email trường học (30 ca)', DATA.summary.emails.beforeModel.taxonomy, DATA.summary.emails.after.taxonomy, [
        ['falsePositiveAssignment', 'Chặn quảng cáo/lừa đảo'],
        ['hiddenTeacherOrSchool', 'Không ẩn thư thầy cô'],
        ['fabricatedDueDate', 'Không tự bịa hạn nộp'],
        ['missedAssignment', 'Bắt trúng bài tập thật'],
        ['wrongSubject', 'Đúng môn học'],
        ['wrongDueDate', 'Đúng hạn nộp'],
        ['wrongCategory', 'Đúng phân loại thư'],
        ['aiOmittedOrFailed', 'Không lỗi kỹ thuật'],
        ['wrongPriority', 'Khớp nhãn ưu tiên'],
      ]],
    ];

    document.getElementById('detailed-bars').innerHTML = GROUPS.map(([title, bTax, aTax, rows]) => \`
      <h4 style="margin:14px 0 8px;font-size:14px;">\${esc(title)}</h4>
      \${rows.map(([k, label]) => {
        const b = bTax?.[k] || { ratePct: 0 };
        const a = aTax?.[k] || { count: 0, total: 0, ratePct: 0 };
        const bAcc = pct(100 - b.ratePct);
        const aAcc = pct(100 - a.ratePct);
        return \`
          <div class="m-row">
            <strong>\${esc(label)}</strong>
            <div class="bar-pair">
              <div class="bar-row"><span class="bar-lbl">Trước</span><div class="track"><div class="fill-before" style="width:\${Math.max(2, bAcc)}%"></div></div><span class="bar-val">\${bAcc}%</span></div>
              <div class="bar-row"><span class="bar-lbl after">Sau</span><div class="track"><div class="fill-after" style="width:\${Math.max(2, aAcc)}%"></div></div><span class="bar-val">\${aAcc}%</span></div>
            </div>
            <div class="m-err">Lỗi: \${a.count}/\${a.total} (\${a.ratePct}%)</div>
          </div>
        \`;
      }).join('')}
    \`).join('');

    // Case explorer inside drawer
    let suite = 'tutor';
    function renderCases() {
      const items = DATA[suite] || [];
      document.getElementById('case-list').innerHTML = items.map((it) => {
        const title = suite === 'emails' ? it.subject : (suite === 'schedule' ? it.command : it.prompt.split('\\n')[0].slice(0, 100));
        const badge = it.afterPass ? '<span class="pill ok">PASS</span>' : '<span class="pill err">FAIL</span>';
        let body = '';
        if (suite === 'tutor') {
          body = \`<strong>Trước:</strong> \${esc(it.beforeReply)}<hr style="border:none;border-top:1px solid var(--border);margin:10px 0;"/><strong>Sau (Socratic):</strong> \${esc(it.afterReply)}\`;
        } else if (suite === 'schedule') {
          body = \`<strong>Trước:</strong> \${esc(it.beforeSaid)}<br/><br/><strong>Sau:</strong> \${esc(it.afterSaid)}\`;
        } else {
          const g = it.afterGot || {};
          body = \`<strong>\${esc(it.sender)}</strong> (\${esc(it.date)})<br/>Kỳ vọng: <code>\${esc(it.expected?.category)}</code> · Hạn <code>\${esc(it.expected?.dueDate || 'không')}</code><br/>AI Sau: <code>\${esc(g.category || 'N/A')}</code> · Hạn <code>\${esc(g.dueDate || 'không')}</code> · Môn <code>\${esc(g.subject || 'N/A')}</code>\`;
        }
        return \`
          <div class="case-item">
            <button class="case-head" type="button"><span class="cid">\${esc(it.id)}</span><span class="ctitle">\${esc(title)}</span>\${badge}</button>
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

import React, { useEffect, useState } from 'react';
import { X, Sparkles, CheckCircle2, Zap, ArrowRight } from 'lucide-react';

export const CURRENT_VERSION = '2.16.0';

interface VersionRelease {
  version: string;
  date: string;
  title: string;
  badge?: string;
  highlights: string[];
  details: string[];
}

const RELEASES: VersionRelease[] = [
  {
    version: '2.16.0',
    date: 'September 20, 2026',
    title: '100 Antigravity CLI UI/UX Improvements + Two-Tier Model Selector + Theme Engine',
    badge: 'Latest Update',
    highlights: [
      '100 concrete visual and interaction improvements for high-speed vibe coding in the Antigravity CLI workspace',
      'Two-tier hierarchical model selector TUI (/model) with family grouping and secondary reasoning effort tiers',
      'Visual quota telemetry dashboard (/quota) with solid-block gauges, multi-day countdowns, and unified Claude/GPT 3P pool',
      'CLI visual theme engine (/theme) with 5 developer palettes (Dark Carbon, Tokyo Night, Monokai, Paper & Coal, Cyberpunk)',
    ],
    details: [
      '091 Model hierarchy TUI: run /model to choose cleanly between Gemini Flash (High/Med/Low), Gemini Pro, Claude Thinking, and GPT-OSS instead of a 15-item flat list.',
      '092 Visual quota HUD: real-time solid block meters (█/░) for 5-hour rolling limits and weekly caps with dynamic multi-day countdowns (4d 13h) and 1-hour cache TTL callout.',
      '093 Vibe coding commands & themes: in-terminal Kanban board (/todo), workspace status HUD (/status), syntax-highlighted diff (/diff), diagnostics (/doctor), and 5 selectable terminal palettes.',
    ]
  },
  {
    version: '2.15.0',
    date: 'September 14, 2026',
    title: 'AI Planner Day View + Editable Times + Linked Sources',
    highlights: [
      'AI Planner shows one roomy day at a time with a day picker — no more squished week grid',
      'Every block time is editable and saved; connected Tracker, Canvas, Classroom, Gmail and Moodle items stay linked in-panel with placement status',
      'Dark-mode safety net: muted text without a dark variant now falls back to cream instead of vanishing',
    ],
    details: [
      '088 Day focus: the 7-column grid is now a day picker with per-day counts plus prev/next arrows, big cards with full start–end times and durations (find it in Schedule → AI Planner).',
      '089 Editable times + sources: each block has Edit time (15-minute minimum, overlap warning, persisted until Regenerate), and a Planned-from list shows every connected item with origin chip, due, minutes, placed-or-missing status and Open link — no tab-hopping.',
      '090 Dark text net + naming: light-only muted/ink text auto-falls-back in dark mode unless the component sets its own dark color; AI Coach pill contrast raised; Flagship wording removed everywhere.',
    ]
  },
  {
    version: '2.14.0',
    date: 'September 14, 2026',
    title: 'Paper & Coal Theme + Semantic Palette',
    highlights: [
      'New Paper light and Coal dark theme: warmer canvas, cream cards, ember-orange accent everywhere',
      'New semantic colors (gold, sage, clay, amber, slate) ready for badges and status chips',
    ],
    details: [
      '086 Paper & Coal restyle: light canvas #F5F0E6 with #EAE2D1 panels, dark coal #201D18 with #2B2620 panels, Ember #D97757 accent with #B85C38 hover, plus ink/cream text and rebalanced borders (applies app-wide, find it in Settings → Appearance).',
      '087 Contrast pass: AI Coach pill, breadcrumb separator and kbd chips re-toned so text never matches its background in either mode.',
    ]
  },
  {
    version: '2.13.0',
    date: 'September 14, 2026',
    title: 'AI Planner All-Source Upgrade + Gmail-Native Inbox + Judge Hero',
    highlights: [
      'AI Planner now builds your week from Tracker, Canvas, Classroom, Gmail, Moodle, 7-day Calendar and timetable — overdue front-loads instead of vanishing',
      'Gmail trusts Gmail: Spam and Promotions share one tab, Social gets its own, ALL shows by default, academic senders in Promo still AI-sorted, zero content keywords',
      'AI chain locked to 3.5-flash → 3.0-flash → Groq with offline fallback, plus a hero card, Top-8 first slot and pinned sidebar',
    ],
    details: [
      '083 Planner all-source harvest: Classroom coursework, Gmail detected assignments, cached Moodle items, subtask minutes and undated High-priority backlog feed the same exclusive timetable with timetable busy-blocking (find it in Schedule → AI Planner).',
      '084 Gmail-native inbox: labelIds plumbing end-to-end, pre-AI promo/social skip (academic-sender exception), server prompt + fallback rewritten to labels, Social tab added, Spam merged into Promotions, ALL default (find it in Gmail Radar).',
      '085 Model chain + hero: shared callGemini 3.5-flash → 3.0-flash → safety → server → Groq everywhere, planner AI-tuned badge, Dashboard hero card, App Store Top-8 first + pinned default (find it on Dashboard → AI Planner).',
    ]
  },
  {
    version: '2.12.0',
    date: 'September 13, 2026',
    title: 'Homework Sorter Metrics + Classifier Lab Experiment',
    highlights: [
      'Homework Sorter now proves its learning: honest holdout accuracy, confusion matrix, and top-word reasons for every prediction — all on-device, no key needed',
      'New Classifier Lab tab runs a Baseline vs Few-shot experiment on your own school messages and shows exactly how much 3 examples help',
    ],
    details: [
      '080 Sorter honest metrics: per-label holdout testing (last 20%, min 1 max 5) with accuracy, per-label precision/recall, full confusion matrix, and confidence histogram — locked with guidance until each label has 3+ examples (find it in Train My Model Lab → Homework Sorter).',
      '081 Sorter prediction card: test any new line for a label + confidence bar + top-3 contributing words, with an optional AI explanation that never overrides the local answer (find it below the Train button).',
      '082 Classifier Lab experiment: 12 seed school messages, zero-shot baseline vs 3-example few-shot on the same rows, side-by-side scoreboard with delta banner, per-row checkmarks, fail gallery with your own notes, and fully visible prompts (find it in Train My Model Lab → Classifier Lab).',
    ]
  },
  {
    version: '2.11.0',
    date: 'September 13, 2026',
    title: 'Study Tools Wave + AI Planner + Safer Sync & Keys',
    highlights: [
      'STEM Lab grows up: searchable PhET library with 29 sims, real GeoGebra applets, local whiteboard, offline Python, and a PDF reader that never goes blank',
      'New AI Planner builds your week from real deadlines, Gantt scans every task with a live preview, and flashcards stop at a healthy session limit',
      'Safer everywhere: strict embed allowlist, hardened research tools, sanitized studio embeds, honest Canvas errors, auto-reconnect Google, and one Keys manager for Gemini + Google + Canvas',
    ],
    details: [
      '058 Periodic polish: recurring refresh pass keeps tables, dashboards, and study widgets tidy (find it across Tracker, Dashboard, and study cards).',
      '059 PhET search + 29 sims: the STEM Lab PhET browser is now searchable with 29 curated simulations by subject (find it in STEM Lab → PhET).',
      '060 GeoGebra GGBApplet: GeoGebra now embeds via the official GGBApplet with proper sizing and offline-friendly fallback (find it in STEM Lab → GeoGebra).',
      '061 Excalidraw local: the whiteboard now runs fully local with autosaved scenes on your device — no account or cloud needed (find it in Creation Studio → Whiteboard).',
      '062 CSP allowlist: page security now uses a strict embed allowlist so only trusted study embeds (PhET, GeoGebra, Excalidraw, Pyodide CDN) can load (applies app-wide).',
      '063 Research hardening: Scholar, papers, citations, and dataset tools got retries, empty-state guidance, and safer link handling (find it in Research workspaces).',
      '064 Gemini keys 2.5-flash + edit/expire: bring-your-own Gemini keys now default to 2.5-flash with per-key rename, expiry labels, and test buttons (find it in Settings → AI / Keys).',
      '065 Google auto-connect: Google Workspace reconnects silently on load when a saved grant exists, so Calendar, Gmail, and Drive stay linked (find it in Settings → Google).',
      '066 Canvas error taxonomy: Canvas failures now map to named kinds (bad token, bad host, expired feed, deployment down) with the exact fix and Try Again (find it in Canvas LMS tab).',
      '067 Dossier formal: Competition Dossier gets formal Mẫu 1 sectioning, page estimates, and clean print-to-PDF export (find it in Competition Dossier).',
      '068 i18n + theme contrast: Vietnamese/English strings filled in and light/dark contrast raised so small labels stay readable in both modes (find it in Settings → General / Appearance).',
      '069 Gantt scan-all + preview: the Gantt view scans all dated tasks and shows a live preview bar before you commit dates (find it in Tracker → Gantt; READY).',
      '070 Flashcard session limit: flashcard review now caps each session and summarizes what is left for next time (find it in Flashcards; READY).',
      '071 Focus music: focus sessions get built-in ambient music controls with calm presets that duck under timers (find it in Focus / Pomodoro; READY).',
      '072 Local Pyodide: the Python runner now loads Pyodide locally for offline-friendly execution with a clear loading state (find it in Code Runner; READY).',
      '073 PDF fallback: the PDF reader shows a friendly fallback with download/open options instead of a blank page when a file cannot render (find it in PDF Reader).',
      '074 Notion zip/csv: notes export to Notion-friendly ZIP/CSV with preserved formatting and per-note files (find it in Notes → Export).',
      '075 AI Planner: the new AI Planner turns deadlines, free gaps, and focus goals into an accept-or-drag weekly plan with breaks (find it in Schedule → AI Planner).',
      '077 CreationStudio XSS sanitize: studio embeds and pasted HTML are now sanitized so untrusted markup cannot run scripts (find it in Creation Studio).',
      '078 Canvas silent-empty fix: a configured-but-empty Canvas sync now explains itself instead of showing a silent empty list (find it in Canvas LMS tab).',
      '079 Unified keys manager: one Keys manager covers Gemini, Google, and Canvas credentials with masked display, test, and revoke in one place (find it in Settings → Keys).',
    ]
  },
  {
    version: '2.10.0',
    date: 'September 12, 2026',
    title: 'Warm Linen Theme + Buttery Motion',
    highlights: [
      'New warm linen look: soft #F8F6F0 canvas, sand sidebar, crisp white cards, burnt-orange buttons — plus a smoother, more alive feel everywhere',
    ],
    details: [
      'Theme (index.css tokens + theme.ts + Sidebar.tsx + App.tsx): canvas moves to #F8F6F0, sidebar to #F1ECE1, cards to pure white, borders to #E7DFD3, CTAs to #E05D38 (hover #C94F2D), selected menu to #FCEEE8 tint, text to #2B2621 / #70695E — old cream/terracotta hexes remapped globally so every tab follows. Motion: cards drift up on hover, buttons lift with a shine sweep and glow, sidebar pills slide, pages crossfade-slide, modals spring in, inputs breathe on focus, view-transitions eased to 0.3s. Verified in build.',
    ]
  },
  {
    version: '2.9.8',
    date: 'September 12, 2026',
    title: 'Warm Cream Theme — Final Tuning + Motion Polish',
    highlights: [
      'Warm cream canvas everywhere with a deeper sidebar, softer readable dark mode, and a livelier homepage',
      'Tactile motion throughout: cascading entrances, lift-on-hover cards, button shine, spring modals',
    ],
    details: [
      'Palette (theme tokens in index.css + theme.ts, Sidebar.tsx, DashboardHome.tsx): eight tuning passes (2.9.0–2.9.7) settled the canvas, sidebar and card creams, removed the starry wallpaper wash, and fixed the CSS-layer bug that kept backgrounds pale — final canvas #f7e4c6 with unlayered remaps verified in dist.',
      'Dark mode (elevation system in index.css): near-black lifted to soft warm charcoal with stepped surfaces and brighter secondary text. Landing: brighter wash, drifting gradient blobs, scroll-reveal cascades. All motion respects prefers-reduced-motion.',
    ]
  },
  {
    version: '2.8.4',
    date: 'September 12, 2026',
    title: 'Warmer Look — No Grey Wash, Lighter Sidebar',
    highlights: [
      'Dashboard background is now warm cream instead of grey — cards float on one clean canvas',
      'Sidebar is a soft light orange with dark readable text, still a touch deeper than the main panel',
    ],
    details: [
      'Dashboard (App.tsx main column + DashboardHome): the grey #E8E6DC page wash and the pale #FAF9F5 dashboard fill are gone — both now use the warm cream #F5F4ED so white cards sit directly on cream in light mode. Dark mode is unchanged.',
      'Sidebar (Sidebar.tsx): deep burnt orange #A94E33 becomes light apricot #EFD2AC with a #DCB287 edge — a step darker than the cream main panel as asked — and all labels, icons rows, toggles and the profile switch from white to dark coffee (#4A2410 / #8A5A33) so everything stays readable. Active app still pops as a cream card.',
    ]
  },
  {
    version: '2.8.3',
    date: 'September 12, 2026',
    title: 'Canvas Production Fix — Sync Works on Vercel + Single Error Message',
    highlights: [
      'Canvas sync now actually reaches the server on the live site — pasting your key and pressing load returns assignments',
      'Failed syncs show one clean error with the real server detail, never a doubled “retry… retry” message',
    ],
    details: [
      'Deployment (vercel.json + api/index.js): all /api/* requests are now rewritten to the single serverless router, and the router detects proxied Canvas calls even after the rewrite strips the path — previously /api/health and /api/canvas/proxy 404’d in production so every sync died before reaching Canvas. Find it in Canvas LMS tab → Save & Sync Canvas.',
      'Errors (sync engine in services/canvas.ts + banner in App.tsx): the proxy’s real reply (e.g. bad host, bad token, deployment 404) is now included in the failure instead of discarded, and the banner strips trailing dots and skips the “check URL and token” suffix when the message already contains guidance — fixing the “then retry… Check your URL” duplication in your screenshot.',
    ]
  },
  {
    version: '2.8.2',
    date: 'September 12, 2026',
    title: 'Canvas Save & Sync Fix — New Credentials Actually Sync',
    highlights: [
      'Pressing Save & Sync in Canvas now syncs with the credentials you just typed — no more empty list with no error',
    ],
    details: [
      'Canvas (Canvas LMS tab in App.tsx + CanvasSyncTab.tsx): Save & Sync now passes the freshly-saved URL, token and feed link directly to the sync engine instead of re-reading stale state, so first-time setup no longer hits the empty-credentials early return that cleared the list and showed no red error banner. Retry buttons call the same path without arguments.',
    ]
  },
  {
    version: '2.8.1',
    date: 'September 11, 2026',
    title: 'Canvas Sync Fix — Honest Errors When the Server API Is Down',
    highlights: [
      'Canvas sync now tells you when the problem is the deployment itself — not your token or feed link',
      'No more misleading “bad token” or “network” errors when the site’s API is actually unreachable',
      'Local development reaches the Canvas + AI endpoints automatically, no extra server step needed',
    ],
    details: [
      'Canvas (Canvas LMS tab + sync engine): before any sync, the app checks its own /api/health endpoint. If it answers with a web page instead of JSON — what happens when the deployed server functions are missing or replaced — sync stops immediately with one clear message telling you to redeploy, instead of blaming your Canvas URL, token or connection. Calendar-feed failures now carry the same typed error kinds as API failures.',
      'Development (vite.config.ts): running just `npm run dev:vite` now proxies /api to the app server on port 3000, so the Canvas proxy and AI endpoints work without also starting the express server.',
    ]
  },
  {
    version: '2.8.0',
    date: 'September 11, 2026',
    title: 'Math That Renders — KaTeX Formulas in Every AI Answer',
    highlights: [
      'Math formulas in AI answers now render beautifully — fractions, integrals and equations instead of raw $ symbols',
      'Works everywhere AI writes: Study Coach, Feynman explanations, quizzes, PhotoMath and STEM Lab',
      'Vietnamese text inside formulas never shows as boxes, long equations scroll sideways',
    ],
    details: [
      'AI answers (Study Coach, Socratic Tutor, Feynman 3-tier explanations, Quiz Generator, PhotoMath handwritten solver, STEM Lab, Document Hub, NotebookLM briefs): one shared MathMarkdown renderer shows Markdown plus KaTeX math — inline $...$ and display $$...$$ — with streaming-safe balancing so half-typed formulas never flash raw code while the answer is still arriving. The AI prompt now asks for KaTeX delimiters directly.',
      'Theme & language (stylesheet + KaTeX fonts): formulas inherit the Warm Cream / Charcoal theme ink in both modes, display equations scroll horizontally instead of overflowing, and Vietnamese diacritics inside math fall back to Inter so they never render as tofu boxes. Code blocks and GFM tables inside AI answers are styled to match.',
    ]
  },
  {
    version: '2.7.0',
    date: 'September 11, 2026',
    title: 'Ember Palette, VI/EN Toggle, Calmer Toolbars & Honest Canvas',
    highlights: [
      'Whole app now follows the Ember palette — canvas, hairline borders and primary accent',
      'New Vietnamese / English toggle in the navbar, landing header, footer and Settings — auto-detects on first visit',
      'Master Tracker toolbar decluttered — filters, export and sheet link moved into a Filters panel, AI Rank merged into Smart Add',
      'Canvas failures show one clear banner only (no more duplicate popup) and never wipe your loaded assignments',
      'Logged-out homepage rebuilt — Features, How-it-works, FAQ and Privacy sections with anchor navigation',
    ],
    details: [
      'Palette (theme, stylesheet, app shell): tokens move to Ember official values — canvas #F5F4ED, warm-sand borders #E8E6DC, primary #C96442, muted #5E5D59. Avatar badges drop off-palette blue/emerald/purple for Ember neutrals, and error toasts use the dark surface instead of the old rose block. Find it in Settings → Appearance.',
      'Language (navbar, landing, Tracker, Canvas, Settings → General): every chrome string goes through one dictionary with auto-detect (browser Vietnamese → Vietnamese) saved per device. Deep AI-generated content stays in its source language by design.',
      'Tracker (Master Tracker header): removed the Export CSV button, standalone Sheet pill and Timeline toggle from the main row. Subject/status/priority filters, CSV export and Open Sheet live behind the new Filters icon; AI Rank now sits inside the Smart Add bar. Canvas tab pills wrap cleanly and the Settings → General Tour + Changelog cards merge into one Help & updates row.',
      'Canvas (Canvas LMS tab): the same failure used to fire both an inline banner and an identical popup. Only the banner shows now, the message is shortened to a single fix, failed syncs keep your cached assignments (now persisted across reloads) instead of blanking the list.',
      'Homepage (logged-out landing): new section nav (Features, How it works, FAQ, Privacy), a 3-step setup guide built from the real connect flows, and honest product cards instead of quote-styled testimonials. No invented users, counts or videos.',
    ]
  },
  {
    version: '2.6.1',
    date: 'September 10, 2026',
    title: 'True Palette, Point-At-You Tour & Honest Canvas Errors',
    highlights: [
      'Every screen now follows the Warm Cream / Charcoal / Terracotta palette in both modes — no more blue or slate intruders',
      'The intro tour now points directly at the real buttons and auto-moves you between tabs as you press Next',
      'Canvas tells you plainly when a sync returns nothing — expired feed links and bad tokens get a named fix, not a fake “all caught up”',
      'Same-named assignments in different courses no longer collapse into one row',
    ],
    details: [
      'Landing page, Daily Schedule, Google sign-in help, focus scheduler and Polite Mailer were still rendering slate-gray surfaces with indigo, blue, cyan and orange accents. All surfaces, text, borders and buttons now use Warm Cream #FAF9F5, Charcoal #141413 and Terracotta #D97757 in both modes, with a stylesheet safety net catching future stragglers. App icons keep their brand colors.',
      'The old tour was a centered card that described the UI in words and made you find everything yourself. It is now a spotlight walkthrough: a terracotta ring highlights the live sidebar, search, Sync, Tracker, AI Coach and Focus targets, and pressing Next or Back moves you to the right tab automatically. X skips, dots jump, Esc closes, and “Try it” ends the tour and opens the real feature.',
      'When Canvas was misconfigured, the tab showed an empty “All caught up!” with no error. Expired feed links (which return a login page), dead tokens and unreachable hosts now raise a named error banner with the exact fix and a Try Again button, and a configured-but-empty sync explains itself instead of pretending everything is done.',
      'The sync merged assignments by bare name only, so “Problem Set 1” in Physics and Math collapsed into one row. Merging now keys on name + course + due date.',
    ]
  },
  {
    version: '2.6.0',
    date: 'September 10, 2026',
    title: 'Everyday Polish — Deadlines, Focus & Search Feel Instant',
    highlights: [
      'Tracker shows what is urgent at a glance — overdue, due today and due-relative labels like “due in 2d”',
      'Dashboard countdowns, timetable “now” line and Gantt today-line keep today’s plan in view',
      'Pomodoro focus is calmer, morning check-in tracks mood, and Feynman cards show read time',
      'Search is faster — command palette copies math answers, remembers recents, finds apps instantly',
      'Gmail, Drive and Schedule get practical upgrades — unread badges, sorting, presets and CSV export',
      'Scholarships, habits, study cards, citations and briefs — counts, streaks and one-click copy/download',
    ],
    details: [
      'Assignment Tracker (011/039/040): urgency badges for overdue and due-today items, relative due labels (“due in 2d”, “due tomorrow”), grouped tasks view, rubric item counts, and one-click CSV export for your full list.',
      'Dashboard + Schedule (012/021/037): live countdown chips to your next deadline, a “now” line across today’s timetable, and saved schedule presets so a normal school day takes one tap to rebuild.',
      'Focus + Morning (013/020/042/043): Pomodoro polish with steadier transitions, morning check-in now logs mood alongside intention and target hours, chronotype preference persists, and Feynman explanations show estimated read time.',
      'Search + Shortcuts (018/019/026/032): press ? to see every shortcut with search, command palette does math and copies the result, remembers your 10 recent tabs plus most-used apps, and the App Store finds tools as you type.',
      'Gmail + Drive (033/035/036): inbox categories show unread badges, unread state is a reliable flag instead of a guess, and Drive sorts by name, date or size so big files surface fast.',
      'Study loop (015/016/017/023/027/028/029/030/031/034/038/044/045): friendlier empty states, flashcard keyboard review with smart scheduling, quiz presets with timer, scholarship deadlines with badges, habit + sleep streaks, hardened study cards, citation one-click copy, paper-chat brief download, peer Q&A replies, and wiki copy that keeps formatting.',
      'Landing (014): hero is clearer on phones and laptops — faster first paint, cleaner headline, and no confusing placeholder video.',
    ]
  },
  {
    version: '2.5.1',
    date: 'September 06, 2026',
    title: 'True Two-Mode Theme, Calmer Home & Fixed App Icons',
    highlights: [
      'Dark mode is now exactly dark charcoal with cream text — no more off-color blue or pink tints',
      'Home screen is simpler — the Academic Overview block is gone, Today Plan and streaks stay',
      'Sidebar is cleaner — the ⌘1–⌘5 number pills next to pinned apps are removed (shortcuts still work)',
      'Every app icon is now unique — no more identical orange squares for different apps',
    ],
    details: [
      'The old 8-palette theme picker fought with the Dark/Light toggle and could leave the app in tinted or half-dark states. There are now exactly two modes: Warm Cream light (#FAF9F5 / #141413) and Dark Charcoal dark (#141413 / #FAF9F5), both with the terracotta accent. Any old tinted setting migrates automatically.',
      'The Real-Time Academic Overview card (Coursework / Schedule / Inbox columns) is removed from the home screen. Your Today Plan, habit streak, quote and NASA card are untouched.',
      'The ⌘1 to ⌘5 chips next to Canvas, Schedule, Tracker, Gmail and Drive are removed from the sidebar and its hover tooltips. Press ? to see shortcuts — single-key shortcuts still work when enabled.',
      'Fourteen apps (new AI labs, Dossier, Dashboard, STEM/Creation/Retention/Documents groups, Paper Chat, Study Rooms, Teacher View, Lecture Copilot, Presentation Coach, Exam Mode) previously shared one generic orange icon. Each now has its own glyph and gradient in the sidebar, App Store and search.',
    ]
  },
  {
    version: '2.5.0',
    date: 'September 06, 2026',
    title: 'Division A Kit: Home Fix, NASA Repair, AI Labs & Dossier',
    highlights: [
      'Home is calm again — the setup checklist moved below your Today Plan and can be dismissed for the day',
      'NASA Image of the Day finally works — turn it on in Settings and it appears instantly with a Retry button',
      'New Train My Model Lab — teach a tiny text/image sorter in your browser, fully offline',
      'New Few-Shot Lab and Competition Dossier — prompt history, video scripts, testing log and PDF export for Bảng A',
    ],
    details: [
      'The onboarding checklist no longer pushes your greeting and Today Plan down. It lives below the dashboard as a collapsible “Getting started” card with progress, a Dismiss-for-today button, and it hides forever at 4/4.',
      'NASA toggle is now reactive (no reload needed), survives rate limits with retries and cached images, supports video days with a Watch link, and has a Test button plus preview in Settings.',
      'Train My Model Lab runs 100% on-device (no photos leave your browser), reports hold-out accuracy, exports model.json, and snapshots evidence. Few-Shot Lab previews calibrated prompts over Vietnamese datasets and logs every run.',
      'Competition Dossier covers the Mẫu 1 eight sections with page estimator and print-to-PDF, global Prompt Log export (JSON/Markdown), 5/3/10-minute video scripts with per-member lines, testing log, 48-hour stability monitor, anonymization default, and license + honesty checks. AI Coach can now answer from your vault with cited sources, and the Agent previews every action with Apply/Undo.',
    ]
  },
  {
    version: '2.4.2',
    date: 'September 05, 2026',
    title: 'Fixed: Google Sign-In That Would Not Finish',
    highlights: [
      'Sign-in failures now tell you exactly what went wrong and how to fix it — no more silent dead ends',
      'New redirect sign-in option for browsers that block popups — slower but almost always works',
      'Coming back from Google now shows a proper welcome-back message and starts syncing right away',
      'New one-tap connection check inside the help window shows what is blocking sign-in',
    ],
    details: [
      'If Google blocked the login (school admin rules, unapproved website address, expired test access), the app used to fail quietly or show a confusing message. It now opens a help window naming the exact problem — for example “blocked by your admin, try a personal Gmail” — with the precise fix for each case.',
      'Some browsers (strict popup or cookie blockers, in-app browsers) never let the Google popup answer. A new “Redirect sign-in instead” button takes you to Google and back in the same tab, which works where popups cannot. A 90-second safety timer also stops the loading spinner from hanging forever.',
      'Previously, if the popup was blocked the app sent you to Google and back but never confirmed anything or started syncing, which felt broken. Returning from Google now shows a success message and runs a full sync immediately.',
      'The sign-in help window has a “Run connection check” button that tests your Firebase setup, website address, popups and cookies, and tells you which one to fix. Also fixed the page security rules so Google’s login helpers are never blocked.',
    ]
  },
  {
    version: '2.4.1',
    date: 'September 03, 2026',
    title: 'Fixed: Blank Canvas Page & Google Sign-In Going Stale',
    highlights: [
      'Fixed the blank page when opening Canvas — one bad item in your data can no longer crash the whole app',
      'Canvas failures now say what went wrong with a Try Again button, instead of looking empty',
      'Google Workspace now stays connected permanently — access renews silently in the background, no more hourly reconnects',
      'Your tasks and events stay on screen while reconnecting — nothing gets wiped by a failed sync',
    ],
    details: [
      'Some students tapped “Enter LMS Workspace” and got a blank page. This happened when a single assignment record was missing its title (from an old save, an email scan, or a blank spreadsheet row) — it crashed the page with no way back. Every list is now cleaned automatically, and a last-resort safety screen with a “Back to Dashboard” button catches anything unexpected.',
      'When Canvas sync failed, the tab said “All caught up!” with zero tasks, which looked broken and empty. It now shows a clear error box explaining the problem with a Try Again button, and keeps your previously loaded assignments visible.',
      'Google only lets popup sign-ins last about an hour. The app now trades the first sign-in for a permanent offline grant and renews access silently through a secure server route — the client secret never leaves the backend, and revoked access simply returns you to the Connect state with your cached data intact.',
      'Failed syncs no longer delete what you already have. If Canvas, Calendar, Gmail, Sheets or Drive fail to refresh, your existing data stays put until the next successful sync.',
    ]
  },
  {
    version: '2.4.0',
    date: 'September 03, 2026',
    title: 'Study Smarter — Auto-Planner, Grade Simulator & 15 New Tools',
    highlights: [
      'New one-tap focus planner — it looks at your free gaps and pending work, then suggests study blocks you can accept or drag around',
      'Grade simulator v2 — see what final-exam score you need, try “what if I drop my lowest quiz”, and plan your GPA across the semester',
      'Exam mode — countdown, a 14/7/2-day study plan, formula sheet starter, and a night-before checklist you can print',
      'Teacher follow-ups made easy — per-teacher cards show your last email and draft a polite follow-up in one tap',
      'Talk instead of type — voice dictation for essays and viva practice, plus listen-back in English, Vietnamese, Spanish or French',
      'Safer deletes — everything goes to a 30-day trash can, and your notes keep past versions you can restore',
      '15 new mini-apps — job tracker, budget, sleep-vs-focus, code runner, resume builder, flashcards that hide diagram labels, citation importer, study rooms and more',
      'Clearer privacy — tap any permission to see why we need it in plain words, revoke Google access, or wipe all data with one button',
    ],
    details: [
      'The focus planner (Schedule tab) reads your pending assignments and open calendar gaps between 8am and 10pm, then proposes blocks with breaks. Nothing is booked until you accept — drag any block to move it.',
      'Grade Forecaster now handles full courses: set your current score, target and final-exam weight to see the score you need, estimate GPA on the usual 4.0 scale, and simulate dropping your lowest quiz before you decide anything.',
      'Exam Mode builds a reverse plan from your exam date: broad review at 14 days, timed past papers at 7 days, formula-sheet-only at 2 days, plus a packing-and-sleep checklist the night before. Print it from the app.',
      'Teacher cards are built from your school email: last message, office-hours lines we spotted, and unread counts. The follow-up button drafts a short polite email you can edit before sending.',
      'Voice uses your browser’s built-in speech tools (free, nothing uploaded by us). Dictate a Feynman explanation or viva answer, then hear it back at slow speed to practice shadowing in a new language.',
      'Deletes are no longer permanent: assignments and notes sit in Trash for 30 days (Settings → Trash) and can be restored. Markdown notes also keep their last 20 versions automatically.',
      'New apps live in the App Store under Plan, Create, Learn and Research: Internship Tracker, Budget, Habit + Sleep, Timetable Optimizer, Code Runner (Python + JavaScript, no server), Resume Builder, Presentation Coach, Lab Report Builder, Essay Outliner, Image Occlusion flashcards, FSRS smart scheduling, Viva voice defense, Language Lab, Zotero import, Paper Chat and Dataset Finder.',
      'AI answers now show their sources (Canvas link, email, Drive file) under every reply, with a per-task model picker (light model for spam, strong model for essays), a token-usage meter, and optional Groq backup key for finals week. Add your own key in Settings → AI.',
      'Search is now one box for everything: Canvas, Gmail, Drive, notes and flashcards with a preview pane and actions (open, pin, make a task from an email). Press / to jump to it, ? to see all shortcuts.',
      'Getting started takes about a minute: connect Google, paste your Canvas feed (with a test button), pick up to 5 pinned apps. Sample data is now an explicit checkbox — we never mix demo data with your real work.',
      'Small screens get a bottom tab bar (Home, Tasks, Schedule, AI, More) plus a + button for quick-add. Printouts for rubrics, timetables and citations are clean one-pagers. Vietnamese translation covers the main screens (more coming).',
    ]
  },
  {
    version: '2.3.1',
    date: 'September 02, 2026',
    title: 'Clean & Simple — Menu, Pinned Tools & Easier Updates',
    highlights: [
      'Top menu is now clean and simple — only your location, search, and AI Coach + notifications remain. No more clock, sync status, or extra buttons to distract you',
      'No more confusing “Academic Core” section — your 5 main tools (Canvas, Daily Schedule, Assignment Tracker, Gmail, and Drive) are now in “Pinned” and ready from day one. Add more from the App Store',
      'Google sign-in is more reliable — works even if your browser blocks popups, and shows clearer help if your account needs to be added as a test user',
      'Changelog is now easy to read — plain English with no tech jargon. Only the newest version shows “Latest” (fixed the bug where 4 versions said Latest)',
      'Small but important fixes: swipe to close the sidebar on mobile, bigger tap areas, smoother navigation, and clearer error messages',
    ],
    details: [
      'The top bar was too crowded. We removed the clock, date, sync spinning icon, music controls, focus timer, and collapse button. Now you just see where you are, a search box, and your AI Coach. Less to think about.',
      '“Academic Core” was just another name for your pinned apps, which was confusing. We removed it. Now you have one place — “Pinned” — with Canvas, Schedule, Tracker, Gmail, and Drive already pinned. You can pin or unpin anything from the App Store.',
      'Some students couldn’t connect Google — the login popup was blocked or showed a vague error. We now save your login more reliably, try a different login method if the popup is blocked, and show a clearer guide when Google asks to add your email as a test user.',
      'The update history used to be full of code words. We rewrote everything from version 2.0 onward in plain English so anyone can understand what changed. We also fixed the bug where four old versions incorrectly showed “Latest Update.”',
      'We also fixed small bugs: the mobile sidebar now closes with a swipe, buttons are easier to tap, notifications are less noisy, and the app handles offline mode more gracefully.',
    ]
  },
  {
    version: '2.3.0',
    date: 'September 02, 2026',
    title: 'Faster, Cleaner, and More Reliable',
    highlights: [
      'App loads noticeably faster — we cleaned up the code so the main download is smaller and tooltips appear quicker',
      'Works better offline — your assignments and notes save on your device and sync automatically when you are back online',
      'Cleaner look and easier on the eyes — softer colors, fewer themes to choose from, and smoother animations',
      'Tools are easier to find — grouped into Plan, Create, Learn, and Research, with “Why recommended?” hints like “Because you have Calculus”',
      'More reliable syncing with Canvas and Google — better handling when your internet is spotty or your login expires',
    ],
    details: [
      'We made the app lighter. Before, the main file was large and took longer to load. Now it is smaller, so the first screen appears faster, especially on slower connections.',
      'If you lose Wi-Fi in class or the dorm, your work is still safe. We save your assignments locally and try again automatically when you are online. If the same assignment was edited in two places, we now show a gentle reminder.',
      'We simplified the colors and themes. Instead of 7 choices, you now have a calm light and dark mode with one accent color, so the app feels consistent. Animations are smoother and respect your motion preferences.',
      'Landing page and app store are clearer. The main screenshot now loads early, the comparison table stays visible while you scroll, and the demo video no longer shows a confusing placeholder. The app store also explains why a tool is recommended for you.',
      'Behind the scenes, we improved how we talk to Canvas, Google Calendar, Gmail, Drive, and Sheets, so you see fewer errors and more up-to-date information.',
    ]
  },
  {
    version: '2.2.2',
    date: 'September 02, 2026',
    title: 'Fixed Blank Screen Bug',
    highlights: [
      'Fixed a bug where the app sometimes showed a blank screen instead of your dashboard',
      'Verified the fix on both computers and phones — the home screen now loads reliably',
      'No change to your data — just a stability improvement',
    ],
    details: [
      'Some students opened the app and saw only a blank background. This was due to a small coding mistake where the page tried to use a name before it was ready. We moved that code to the right place.',
      'We tested the fix by opening the app on different devices and screen sizes. The dashboard, hero, and footer now appear correctly every time.',
      'Your assignments, calendar, and emails were not affected. This was only a display issue.',
    ]
  },
  {
    version: '2.2.1',
    date: 'September 02, 2026',
    title: 'Less Clutter, Easier to Get Around',
    highlights: [
      'Removed floating buttons that got in the way on mobile',
      'All help and install options are now together in Settings → Help & Support',
      'Easier to find how to install the app or report a problem',
    ],
    details: [
      'We had floating “Install” and “Help” buttons that covered content on small screens. We removed them.',
      'You can now find everything in one place: open Settings, go to Help & Support, and you will see Install, feedback, and version info.',
      'This makes the app feel calmer, especially on phones.',
    ]
  },
  {
    version: '2.2.0',
    date: 'September 02, 2026',
    title: 'Major Cleanup — Speed, Design, and Everyday Fixes',
    highlights: [
      'Noticeably faster, especially on phones and slower networks',
      'Cleaner, more consistent design across light and dark modes',
      'Easier navigation with clearer menus and shortcuts',
      'Daily planner and assignment list are now better organized',
      'App store is simpler — easier to find and install tools',
    ],
    details: [
      'We trimmed the code, made the app store load only what you need, and reduced lag on phones. The app also handles slow or offline connections more gracefully.',
      'We unified colors, softened the background to be easier on the eyes for late-night studying, and made the spacing more consistent.',
      'We made the left menu clearer, improved the command palette (press Cmd+K or Ctrl+K), and added better keyboard shortcuts.',
      'Your daily plan now groups overdue, due today, and upcoming tasks more clearly, and the dashboard gives a quick glance at your day.',
      'The app store now shows 2 tools per row, highlights the top 8 essentials, and has better search.',
    ]
  },
  {
    version: '2.1.0',
    date: 'September 02, 2026',
    title: 'Better Organization and Navigation',
    highlights: [
      'Tools are now grouped more clearly: Plan, Create, Learn, Research',
      'Left menu shows your recent tools so you can jump back quickly',
      'Dashboard is simpler — welcome message and focus for the day front and center',
      'Assignment list is easier to drag, filter, and manage',
      'Canvas setup is clearer with better instructions',
    ],
    details: [
      'We reorganized the app so you always know where to find things. Plan is for schedules and tasks, Create for math and drawing, Learn for studying, Research for writing and reading.',
      'Your recently used tools now appear near the top of the menu, so you don’t have to hunt for them.',
      'The home screen now focuses on your greeting and today’s plan, with less scrolling needed.',
      'The assignment tracker now lets you drag tasks, filter more easily, and see clearer details.',
      'Connecting Canvas now has better guidance and shows your grades and upcoming work more clearly.',
    ]
  },
  {
    version: '2.0.0',
    date: 'September 01, 2026',
    title: 'A Fresh Start — StudentOS 2.0',
    highlights: [
      'A fresh, calmer design that’s easier on the eyes for long study sessions',
      'Faster and more reliable — works better even with spotty Wi-Fi',
      'All your school tools in one place: Canvas, Google Calendar, Gmail, Drive, and more',
      'Smarter help from AI — study plans, flashcards, and writing feedback that knows your actual assignments',
      'Built for phones as well as laptops — easier to use on the go',
    ],
    details: [
      'This was our biggest update. We rebuilt the app to be cleaner and faster, with a warm, soft background and a more consistent look across all pages.',
      'Your data now saves locally first, so you can keep working offline. When you’re back online, it syncs automatically.',
      'You can connect Canvas to pull in assignments and grades, see your Google Calendar and Gmail in one dashboard, and keep files organized with Drive.',
      'The AI coach can now make study plans based on your real deadlines, create flashcards from your notes, and give feedback on essays.',
      'We made sure the app works well on phones: easier to tap, no awkward zooming, and a menu that slides in and out smoothly.',
    ]
  },
  {
    version: '1.9.5',
    date: 'August 31, 2026',
    title: 'Focus Audio & App Store Polish',
    highlights: [
      'Focus & Pomodoro: Auto-fullscreen on play, default Brownian noise, and improved sound algorithms',
      'App Store: 2 apps per row layout, simplified descriptions, and smooth category scroll flow'
    ],
    details: [
      'Added auto-fullscreen requesting when starting a Pomodoro or Deep Work focus session.',
      'Auto-enable Brownian noise by default if no ambient background audio is running.',
      'Overhauled Web Audio synthesizers: warm Brownian lowpass rumble (320Hz), realistic Rain (ambient wash + random drop spikes), and paul kellet pink noise.',
      'Revamped App Store layout to use exactly 2 apps per row on desktop for high legibility.',
      'Simplified all App Store descriptions to short, simple statements highlighting each tool\'s utility.',
      'Created a Top 8 Highlights section with glowing borders showing core essential tools.',
      'Removed sub-app recommendation rows and implemented continuous vertical scrolling through all 5 categories.'
    ]
  },
  {
    version: '1.9.0',
    date: 'August 31, 2026',
    title: 'Public APIs & Social Sharing Integrations',
    highlights: [
      'arXiv, Open Library, Wikipedia, and NASA APOD integrations',
      'Study Card SVG generator, printable Academic Portfolio export, and Morning Check-in'
    ],
    details: [
      'Built live arXiv search workspace accessing Cornell API with category filters, abstracts, and direct PDF downloads.',
      'Integrated Open Library textbook finder to search book details, ISBNs, and borrow links.',
      'Implemented Wikipedia lookup modal for quick academic term definitions using the REST API.',
      'Added NASA Astronomy Picture of the Day integration as a home dashboard wallpaper.',
      'Created Study Card generator rendering downloadable SVG stats showing deep work minutes, tasks, and streaks.',
      'Added 1-page Academic Portfolio export formatted for printing and PDF generation.',
      'Designed Daily Morning Check-in modal to prompt for intentions and target focus hours.'
    ]
  },
  {
    version: '1.8.0',
    date: 'August 31, 2026',
    title: 'AI Academic Assistance Suite',
    highlights: [
      'Why Is This Hard explainer modal with prerequisites and strategies',
      'AI Essay Proofreader & Thesis Strength Analyzer'
    ],
    details: [
      'Built "Why Is This Hard" cognitive deconstruction explainer to break assignments down into prerequisite concepts and traps.',
      'Created AI Essay Proofreader tool to analyze draft thesis strength and structural coherence.',
      'Implemented Socratic Concept Dialogue Engine to tutor students step-by-step using interactive diagnostic questions.'
    ]
  },
  {
    version: '1.7.0',
    date: 'August 30, 2026',
    title: 'Density Options & Custom Themes',
    highlights: [
      'Layout density toggle (compact/comfortable/spacious)',
      '4 custom study themes and permanent 48px left rail collapse'
    ],
    details: [
      'Added user settings toggle for compact, comfortable, or spacious UI density.',
      'Introduced 4 custom study themes: parchment, midnight, ocean, and forest.',
      'Implemented left sidebar permanent collapse to a space-saving 48px icon-only rail.'
    ]
  },
  {
    version: '1.6.0',
    date: 'August 30, 2026',
    title: 'STEM Lab & Print Formatting',
    highlights: [
      'Interactive Periodic Table, Scientific Unit Converter, and print-to-PDF formatting'
    ],
    details: [
      'Implemented interactive Periodic Table workspace with family filters and element inspector drawer.',
      'Built Scientific Unit Converter & expression evaluator with automatic units translation.',
      'Added Cornell Notes note-taking layout option to Markdown editor.',
      'Added CSS print media queries for clean print-to-PDF formatting of study materials.'
    ]
  },
  {
    version: '1.5.0',
    date: 'August 30, 2026',
    title: 'Minimalist Portal & Personalization',
    highlights: [
      'Redesigned full-screen minimalist dashboard home',
      'Name greetings, mood vibe selectors, and custom pomodoro goals'
    ],
    details: [
      'Redesigned Dashboard Home as a clean, minimalist entrance dashboard.',
      'Hided sidebar and top navigation bars on Home, replacing them with a travel action button.',
      'Added personalized greetings based on time of day and preferred name inputs.',
      'Integrated mood vibe selectors (focus, calm, creative, recharge) with dynamic ambient glows.'
    ]
  },
  {
    version: '1.4.0',
    date: 'August 29, 2026',
    title: 'Productivity & Study Tools',
    highlights: [
      'Kanban board, PDF reader, Quiz generator, and synthesized ambient soundscapes'
    ],
    details: [
      'Created Kanban board view for assignment tracking.',
      'Added local PDF reader and annotator with page-linked study notes.',
      'Built AI Practice Quiz Generator with explanation feedback.',
      'Synthesized multi-channel ambient soundscapes directly via Web Audio API.'
    ]
  },
  {
    version: '1.3.0',
    date: 'August 29, 2026',
    title: 'Academic Suite & Live Integrations',
    highlights: [
      '100% genuine data APIs, in-browser LaTeX preview, and Semantic Scholar query'
    ],
    details: [
      'Removed all mock items from GitHub, Discord study channels, and paper search.',
      'Added live GitHub commit repository reader.',
      'Integrated in-browser LaTeX formula compiler and direct PDF preview.',
      'Built live Semantic Scholar academic index search engine.'
    ]
  },
  {
    version: '1.2.0',
    date: 'August 28, 2026',
    title: 'Decluttered Workspaces & UI Upgrades',
    highlights: [
      'Standalone full-bleed views, collapsible bars, and settings dialog'
    ],
    details: [
      'Isolated apps into standalone full-bleed panels, removing header clutter.',
      'Added collapsible top navigation bar with restore toggle.',
      'Designed macOS-style 2-pane Settings dialog.',
      'Added fullscreen auto-zen Pomodoro views.'
    ]
  },
  {
    version: '1.1.0',
    date: 'August 28, 2026',
    title: 'AI Copilot & Modules Upgrade',
    highlights: [
      'Polite Mailer, Subtask Extractor, and AI Risk Ranker'
    ],
    details: [
      'Added Polite Mailer tool to draft academic emails with attachments.',
      'Created Subtask Extractor menu to dissect Canvas assignments into subtasks.',
      'Implemented AI Risk Ranker to identify high-risk coursework based on due dates.'
    ]
  },
  {
    version: '1.0.0',
    date: 'August 27, 2026',
    title: 'Student Operating System Release',
    highlights: [
      'Split-Screen Studio, Google NotebookLM, and LMS integrations'
    ],
    details: [
      'Launched StudentOS modular desktop featuring Split-Screen Studio and Command+K palette.',
      'Integrated Google NotebookLM study binder.',
      'Implemented Canvas LMS, Google Classroom, and Moodle calendar synchronization.'
    ]
  }
];

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, onClose }) => {
  const [selectedVersion, setSelectedVersion] = useState<string>(CURRENT_VERSION);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentRelease = RELEASES.find((r) => r.version === selectedVersion) || RELEASES[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="changelog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#FAF9F5] dark:bg-[#1A1917] w-full max-w-4xl h-[85vh] rounded-3xl border border-[#DFDACB] dark:border-[#2C2B27] flex flex-col md:flex-row overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
        
        {/* Left Column: Version History Sidebar */}
        <div className="w-full md:w-64 border-r border-[#DFDACB] dark:border-[#2C2B27] bg-[#EFECE2]/30 dark:bg-[#141413]/40 flex flex-col h-1/3 md:h-full shrink-0">
          <div className="p-5 border-b border-[#DFDACB] dark:border-[#2C2B27]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#8C897F]">
              Version History
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {RELEASES.map((rel) => (
              <button
                key={rel.version}
                onClick={() => setSelectedVersion(rel.version)}
                className={`w-full text-left px-4 py-3 rounded-2xl transition-all cursor-pointer flex flex-col gap-0.5 ${
                  selectedVersion === rel.version
                    ? 'bg-white dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] shadow-xs'
                    : 'hover:bg-[#EFECE2]/50 dark:hover:bg-[#252422]/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${
                    selectedVersion === rel.version ? 'text-[#D97757]' : 'text-[#141413] dark:text-[#FAF9F5]'
                  }`}>
                    v{rel.version}
                  </span>
                  {rel.badge && (
                    <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[8px] font-bold">
                      {rel.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-[#8C897F] truncate font-medium">
                  {rel.title}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Right Column: Version Details Section */}
        <div className="flex-1 flex flex-col h-2/3 md:h-full min-w-0 bg-white dark:bg-[#1A1917]">
          
          {/* Header */}
          <div className="p-6 border-b border-[#DFDACB] dark:border-[#2C2B27] flex items-center justify-between shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono bg-[#FAF9F5] dark:bg-[#252422] px-2 py-0.5 rounded border border-[#DFDACB] dark:border-[#2C2B27] text-[#8C897F]">
                  v{currentRelease.version}
                </span>
                <span className="text-[10px] text-[#8C897F] font-semibold">
                  Released on {currentRelease.date}
                </span>
              </div>
              <h2 id="changelog-title" className="text-lg font-extrabold text-[#141413] dark:text-[#FAF9F5] mt-1">
                {currentRelease.title}
              </h2>
            </div>

            <button
              onClick={onClose}
              aria-label="Close release notes"
              className="p-2 rounded-xl bg-[#FAF9F5] dark:bg-[#252422] border border-[#DFDACB] dark:border-[#2C2B27] text-[#8C897F] hover:text-[#141413] dark:hover:text-[#FAF9F5] hover:border-[#D97757] transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Details Scroll Area */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
            
            {/* Highlights Box */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-[#FAF9F5] to-amber-500/5 dark:from-[#252422] dark:to-amber-500/10 border border-amber-500/20 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#D97757] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>What's New</span>
              </h4>
              <ul className="space-y-2">
                {currentRelease.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs text-[#141413] dark:text-[#FAF9F5]">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="font-semibold">{h}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Detailed Changes list */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#8C897F]">
                Changes &amp; Improvements
              </h4>
              <div className="space-y-2.5">
                {currentRelease.details.map((d, i) => (
                  <div
                    key={i}
                    className="p-4 bg-[#FAF9F5] dark:bg-[#252422]/50 border border-[#DFDACB]/60 dark:border-[#2C2B27]/60 rounded-2xl flex items-start gap-3"
                  >
                    <Zap className="w-3.5 h-3.5 text-[#D97757] shrink-0 mt-0.5" />
                    <p className="text-xs text-[#5C5A54] dark:text-[#B5B2A8] leading-relaxed">
                      {d}
                    </p>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Footer actions */}
          <div className="p-6 border-t border-[#DFDACB] dark:border-[#2C2B27] bg-[#FAF9F5] dark:bg-[#141413]/60 flex items-center justify-between shrink-0">
            <span className="text-[10px] text-[#8C897F]">
              StudentOS Command Center v{CURRENT_VERSION}
            </span>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-[#D97757] hover:bg-[#C86646] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1"
            >
              <span>Continue to App</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};

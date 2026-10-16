# Student Command Center — Unified Academic OS

> Canvas LMS + Google Workspace (Calendar, Gmail, Sheets, Drive, Docs, Classroom) + Gemini AI Study Coaching — local-first, offline-capable, PWA.

![Version](https://img.shields.io/badge/version-2.3.1-%23D97757)
![Build](https://img.shields.io/badge/build-passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

Deployed: **https://sutdent-command-center.vercel.app** · GitHub: **buianhuy2009/Sutdent-Command-Center**

---

## Quick Start (verification loop)

```bash
npm install
npm run dev      # local dev (.tsx server + Vite)
npm run build    # must exit 0 before push
npm run start    # serve dist/server.cjs
```

`AGENTS.md` verification loop:
1. Edit targeted files (surgical edits, not full rewrites)
2. `npm run build` → must pass (exit 0)
3. If fails: inspect terminal stack, self-repair (max 3 retries)
4. `git push` → Vercel auto-deploy
5. Inform user build passed & pushing

---

## Architecture

```
src/
  App.tsx              ~600-line orchestrator (was 2500-line God Component)
  providers/
    AuthProvider.tsx   Firebase + Google OAuth token lifecycle (IndexedDB, refresh_type=offline)
  hooks/
    useSyncEngine.ts   Debounced sync + AbortController + isSyncing guard
    useWorkspaceRouter.ts  ?w= query + history.pushState (wouter-ready)
    useBadgeCounts.ts  Deduped flashcard/Canvas/assignment/email counts
    useDebouncedCallback.ts
  layouts/
    Shell.tsx          <a skip> + <header> + <main> + ErrorBoundary
  components/
    workspaces/        All 10+ workspaces lazy-loaded via React.lazy + Suspense
    Navbar.tsx         Storage+BroadcastChannel (no 3s poll), keyboard-accessible bell
    Sidebar.tsx        64px rail / w-64, mobile drawer <768px
    CommandPalette.tsx Fuzzy (subsequence) + Arrow nav + recent + safe math
  stores/
    workspaceStore.ts  Zustand persist for activeWorkspace/pinned/apps/ui
    dataStore.ts       Zustand persist for assignments (Dexie migration helper)
  services/
    db.ts              Dexie StudentOSDatabase (notes, srsCards, briefs, queue)
    gemini.ts          RateLimiter 3.8s + 50/day quota + model fallback gemini-2.0-flash → 1.5-flash
    googleWorkspace.ts Calendar/Gmail/Sheets/Drive with DEFAULT_PROJECT_NUMBER env
    firebase.ts        Workspace scopes (11), prompt=consent offline, sessionStorage→IndexedDB
    canvas.ts          Feed + REST union merge
  server/
    handlers.ts        CORS restricted (not "*"), canvasToken via POST body, truncated PII
```

### Code Splitting

`vite.config.ts` → `manualChunks: { vendor, firebase, ai, mermaid, katex, markdown, dnd, dexie }`  
All workspaces + 15 modals `React.lazy(() => import('./components/...'))` + `<Suspense>` — Canvas-only users don't download Wolfram/PhET. Bundle: `index ~592k` (was 827k) + `mermaid 750k` lazy + `editor 594k`.

### PWA

`vite-plugin-pwa` runtimeCaching: `googleapis.com` NetworkFirst 5min, Gemini 5min, arXiv/OpenLibrary StaleWhileRevalidate. Manifest: screenshots, shortcuts (New Task, Focus, Canvas), share_target, themeColor sync.

---

## Environment

See `.env.example`:

```
GEMINI_API_KEY=...
GROQ_API_KEY=gsk_...
VITE_GOOGLE_PROJECT_ID=614024702267
VITE_FIREBASE_*=...
CANVAS_ALLOWED_HOSTS=instructure.com,canvaslms.com
```

Hardcoded `614024702267` removed — all usages now read `import.meta.env.VITE_GOOGLE_PROJECT_ID`.

---

## Security

- CORS: `*` removed — allowlist `APP_URL`, `VERCEL_URL`, localhost; Canvas proxy requires origin check + POST body token (not `x-canvas-token` header logged).
- CSP + HSTS + nosniff + SAMEORIGIN in `vercel.json` headers.
- API key in localStorage guarded by CSP; PII truncated to 300 chars before Gemini prompt.
- 11 Google scopes explained in Landing privacy section.

---

## Accessibility (WCAG AA)

- Skip link, landmarks (`<header aria>`, `<nav>`, `<main id="main-content">`)
- Focus-visible rings on all buttons (`:focus-visible` + `.focus-ring`)
- Contrast fix: `#6B6860` (4.6:1 on #FAF9F5) vs old `#8C897F` (3.2:1)
- Bell dropdown: `aria-haspopup`, `aria-expanded`, Esc + outside click, keyboard Enter/Space
- `prefers-reduced-motion` disables viewTransition & animations; AppLogo `aria-hidden`
- Zen fullscreen opt-in (no hijack, hint Esc)

---

## Mobile

- Sidebar: `hidden md:flex` + mobile drawer (`w-0` → overlay hamburger)
- Navbar search: `hidden sm:flex` → mobile FAB `Cmd+K`
- Tables: AssignmentTracker + AcademicRadar `min-w-[600px]` + horizontal hint, sticky first col ready, badges 44px touch target noted
- `meta theme-color` + viewport `color-scheme`

---

## SEO / PWA / Growth

- `index.html`: canonical, og:image, json-ld `WebApplication`, twitter, preconnect, theme-color dynamic
- `sitemap.xml` + `robots.txt` (vite-plugin-sitemap-ready), manifest shortcuts/share_target
- GA placeholder: events `canvas_connected`, `syllabus_parsed` (PostHog/Plausible hook in App)
- GitHub link fixed (Sutdent typo noted), deploy button below

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/buianhuy2009/Sutdent-Command-Center)

---

## Data & Offline

- Dexie `StudentOSDatabase` with `migrateLocalStorageToDexie()` (15 keys)
- Outbox `assignmentsQueue` + retry on `online` event (fire-and-forget replaced)
- Token: sessionStorage + `google_token_acquired_at` → IndexedDB plan, `access_type=offline`
- Conflict: `updatedAt` prepared (Canvas + Sheets last-write-wins mitigated)

---

## AI — Cost & Quality

- Models: `gemini-2.0-flash` + `gemini-2.0-flash-lite` + `gemini-1.5-flash` (removed fake `gemini-3.5-flash`)
- Prompt: snippets truncated 300 chars, body stripped
- Streaming: `generateContentStream` ready in StudyAssistantChat (incremental markdown)
- Rate: global 3.8s + daily 50-call quota shown in GeminiSettingsModal
- Tests: `gemini.test.ts` fixtures for spam (Shopee/Spotify → isSpam:true)

---

## New Features Surfaced

- **Grade What-If**: `calculateGradePrediction` UI in CanvasSyncTab slider (84% → 90% with 30% final = need 96%)
- **Calendar Timeline**: weekly time-blocking view (drag → insertCalendarEvent) ready schema
- **Streaks**: GitHub-style heatmap + confetti level-ups (Pomodoro 4/4)
- **Submit to Canvas**: Attach Drive file → Submit via `submitCanvasAssignment` in inspector
- Mermaid split, GeoGebra 5 tabs, arXiv save, OpenLibrary prefill

---

## Changelog

See in-app `ChangelogModal` (`CURRENT_VERSION = 2.3.1`) — full git log:

```
a694bf1 feat: architectural overhaul — zustand slices, dexie, themes, command launcher...
15c9ba2 fix: hide Live Sync unless disconnected; auto fullscreen on focus
...
```

`v2.3.1` (2026-09-02) — Clean menu (only search + AI + bell), Pinned replaces Academic Core (5 defaults), Google sign-in more reliable (popup block → redirect + clearer help), changelog rewritten in plain English + fixed 4× Latest bug, sitemap updated, swipe to close, 550k bundle.
`v2.3.0` (2026-09-02) — Full 95-point audit: IA Plan|Create|Learn|Research + NavSection + Why chip + breadcrumb clickable, 827k→592k via lazy modals, glass + card tokens unified, greeting truncate + streak memo, LCP preload + Deploy to Vercel + sticky comparison + rickroll removed + FAQ schema, workbox png/svg, fonts subset, token IndexedDB + quota Dexie + conflict toast + 15-key migration, vault PIN AES-GCM, PII truncate, swipe drawer, single pill, redirect Sutdent typo, 46-app catalog (Budget/Code Runner/Resume/Grade Forecaster).
`v2.0.0` (2026-09-01) — God Component split, lazy workspaces, manualChunks, strict TS, CORS/CSP, polling debounce, env projectId, ErrorBoundary, PWA googleapis, contrast + landmarks, mobile drawer, Landing terracotta, Dashboard Today Plan + personal drawer, CommandPalette fuzzy+keys, Dexie quota, Gemini model fix.

---

## DX

- `tsconfig.json: strict:true`
- `eslint` + `prettier` + `husky` recommended (`npm run lint` → `tsc --noEmit`)
- Tests: `vitest` for `parseSyllabusMultimodal`, `crossReferenceCanvasWithSheet`, `repairJsonString`
- Version: `student-command-center@2.0.0` (was `react-example@0.0.0`)

---

## License

MIT — see `LICENSE`

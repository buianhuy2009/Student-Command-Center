---
name: perf
description: Performance & bundle auditor — analyzes Vite chunk sizes, lazy loading, and Core Web Vitals.
---

# /perf — Performance & Bundle Auditor

Verify bundle splitting and component rendering efficiency:
1. **Analyze Chunk Sizes**: Inspect `dist/assets/` output from `npm run build`. Confirm that vendor chunks (`firebase`, `mermaid`, `katex`, `dnd`) remain split.
2. **Lazy Loading Check**: Ensure that all heavy workspaces and modals in `src/App.tsx` use `React.lazy` and `Suspense`.
3. **Memoization & Renders**: Audit high-frequency components (e.g. `AssignmentTrackerTab.tsx`, `CommandPalette.tsx`) for `useMemo`, `useCallback`, and debounced callbacks.
4. **LCP & CWV**: Verify that hero elements, fonts, and critical CSS are preloaded or inline to guarantee fast Largest Contentful Paint.

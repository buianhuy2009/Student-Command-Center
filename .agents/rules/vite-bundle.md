# Vite Bundle & Performance Optimization

1. **Lazy Loading Mandate**: Every workspace and modal component must be loaded asynchronously via `React.lazy()` and wrapped in `<Suspense>` with `lazyRetry`.
2. **Chunk Integrity**: Preserve manual chunks defined in `vite.config.ts` (`vendor`, `firebase`, `ai`, `mermaid`, `katex`, `markdown`, `dnd`, `dexie`).
3. **Core Web Vitals**: Never introduce bundle regressions that delay Largest Contentful Paint (LCP). Keep critical CSS and hero elements preloaded.

## 2025-09-08 - Memoizing localStorage Reads in High-Frequency Polling Hooks

**Learning:** Polling hooks (like `useBadgeCounts`) that periodically read `localStorage` using `setInterval` burn CPU and trigger frequent garbage collection cycles when repeatedly calling `JSON.parse` on complex structures every few seconds, even when idle.

**Action:** Compare the raw string returned by `localStorage.getItem()` against module-level string cache variables before parsing. If the raw string and date haven't changed, return the cached result immediately to skip `JSON.parse()` and array allocations.

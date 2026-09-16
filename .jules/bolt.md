## 2026-09-16 - Single-Pass Counter Memoization
**Learning:** In React components managing large lists (like `assignments`), performing multiple array scans (`Array.prototype.filter`) across render execution for summary counters causes unnecessary loop overhead.
**Action:** Use a single `useMemo` pass to calculate multiple scalar counters (such as `doneCount` and `highCount`) simultaneously in O(N) time and prevent recalculations when dependencies haven't changed.

## 2025-05-18 - Fast-path String Comparisons for Date Urgency & Sorting

**Learning:** Re-instantiating `Date` objects and running regexes inside list sorting comparators or per-item render functions (e.g. `getUrgencyInfo`) causes heavy CPU overhead and GC pressure when rendering and filtering assignment lists.
**Action:** Fast-path standard ISO date strings (`YYYY-MM-DD`, 10 chars) using direct string comparison against pre-computed daily string targets (`cachedTodayStr`, `cachedTomorrowStr`). Pre-allocate return result objects for static status chips to eliminate garbage collection pressure during list renders and sorts.

## 2025-05-18 - Single-pass Memoization for List Filtering & Kanban Status Grouping

**Learning:** In React components with high-frequency inputs (such as search boxes or modal inputs), calculating summary metrics or column groupings using multiple `.filter()` calls on large lists runs O(N) tasks on every render frame. Single-pass loops inside a single `useMemo` significantly cut CPU work and prevent UI micro-stutters.

**Action:** When calculating summary counts or category/status groupings from a list, compute them in a single-pass loop inside `useMemo` keyed on the source list rather than chaining multiple `.filter()` calls.

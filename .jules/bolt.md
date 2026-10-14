## 2025-09-14 - O(1) Set Memoization for Component-Level Search Filters
**Learning:** Re-evaluating linear string search operations (`toLowerCase()`, `includes()`, `toString()`) for multi-row UI grids (like the 118-element periodic table) during every render frame introduces noticeable CPU overhead (~570 ops per frame).
**Action:** Pre-compute matching element IDs into a memoized `Set<number>` keyed on query inputs, reducing render-time check complexity to O(1) set membership.

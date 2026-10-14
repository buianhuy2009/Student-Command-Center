## 2025-05-18 - Pre-processing & Map Lookups for Array Matching

**Learning:** Inner loops with repeated `.toLowerCase().trim()` allocations and linear $O(N \times M)$ scans over lists (e.g. `crossReferenceCanvasWithSheet`) cause unnecessary CPU overhead on large datasets. Pre-building $O(1)$ lookup maps for direct ID matches and pre-processing normalized strings preserves match precedence while reducing runtime complexity to $O(N + M)$.
**Action:** Always pre-normalize array strings once outside loops and use `Map` lookups for unique keys to speed up list cross-referencing.

# Bolt Journal - Critical Learnings

## 2025-05-20 - Badge Counts Polling Optimization
**Learning:** Polling functions in custom hooks like `useBadgeCounts` that parse local storage keys (`scc_flashcard_decks_v1`, `scc_srs_decks_v2`) every 4 seconds create unnecessary background main-thread CPU overhead and JSON parsing thrash.
**Action:** Increase background polling intervals to 15s+ for background badge polling hooks while relying on `storage` and `focus` window events to maintain real-time UI responsiveness when state changes across tabs or window activations.

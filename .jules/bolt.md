## 2025-05-15 - Memoize LocalStorage Parsing & Event-Driven Badge Polling
**Learning:** Frequent window.setInterval polling (e.g., 4s) of localStorage data that involves JSON.parse and array operations creates unnecessary main thread churn.
**Action:** Cache raw string values from localStorage to skip JSON.parse when unchanged, reduce polling intervals to 15s+, and listen to custom window events (e.g. `scc_flashcards_updated`) for immediate update execution.

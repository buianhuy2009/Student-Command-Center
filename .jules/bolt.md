## 2026-09-17 - Event-driven badge counts replacing polling
**Learning:** Polling localStorage on a 4-second interval causes unnecessary CPU wakeups and JSON parsing in background tabs/views.
**Action:** Use custom DOM events (e.g. `scc_flashcards_updated`) dispatched alongside localStorage writes for same-tab reactivity.

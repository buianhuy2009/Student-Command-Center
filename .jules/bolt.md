## 2025-05-18 - Replacing setInterval Polling with Custom Window Events

**Learning:** Continuous `setInterval` polling in React custom hooks (such as `useBadgeCounts` running every 4 seconds) wakes up the CPU ~900 times per hour even when idle. Standard `storage` window events only fire across separate browser tabs, not within the same tab when mutating `localStorage`.

**Action:** Whenever updating `localStorage` state in single-tab components, dispatch a custom `window` event (e.g. `window.dispatchEvent(new CustomEvent('scc_flashcards_updated'))`). Hooks can then replace background `setInterval` polling with event listeners for `storage`, `focus`, and the custom event.

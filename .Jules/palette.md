## 2025-05-18 - Accessible & Safe Dialog Pattern
**Learning:** Confirmation modals performing destructive or asynchronous operations require standard ARIA dialog attributes (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`), keyboard Escape dismissability, and loading feedback with disabled states to avoid double-triggers.
**Action:** Always include keyboard listeners, clear ARIA dialog landmarks, focus rings, and an async submitting state on action buttons in modal components.

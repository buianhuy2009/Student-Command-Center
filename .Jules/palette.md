## 2026-09-12 - Accessible Confirmation Modals & Keyboard Trap Prevention

**Learning:** Accessible confirmation dialogs require `role="dialog"`, `aria-modal="true"`, explicit `aria-labelledby`/`aria-describedby` associations, and auto-focusing a safe element (e.g., Cancel button) upon opening. Listening for `Escape` key events guarantees seamless keyboard accessibility for destructive or critical confirmation flows.

**Action:** Whenever introducing or modifying modal components, ensure dialog ARIA attributes are attached, default focus is set on the least destructive element, and global `Escape` key event listeners are added to dismiss the modal cleanly.

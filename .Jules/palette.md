## 2025-09-10 - Confirmation Modal Accessibility & Keyboard Ergonomics

**Learning:** Modal dialogs in the app like `ConfirmationModal` should explicitly declare `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` pointing to the modal title for assistive technology, alongside keyboard support (`Escape` key dismiss listener) and visible focus rings (`focus-visible:ring-2 focus-visible:ring-[#D97757]`) on action buttons.
**Action:** Always include keyboard event listeners (`Escape`) and ARIA modal attributes when creating or refactoring modal components across Student Command Center.

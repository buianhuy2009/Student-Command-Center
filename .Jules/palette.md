## 2025-09-09 - Feedback Widget Accessibility and Focus States
**Learning:** Floating overlay trigger buttons like "Help & Feedback" require explicit `aria-expanded` attributes and high-contrast `focus-visible` ring indicators to support both screen reader users and keyboard-only navigation.
**Action:** Always include `aria-expanded={isOpen}` and `focus-visible:ring-2` on popover/drawer toggle buttons across all UI components.

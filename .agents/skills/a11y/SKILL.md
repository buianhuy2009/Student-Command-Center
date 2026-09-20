---
name: a11y
description: Accessibility auditor — verifies WCAG AA compliance, ARIA attributes, keyboard traps, and contrast.
---

# /a11y — Accessibility Auditor

Audit UI components for accessibility compliance:
1. **Interactive Elements**: Verify all buttons, inputs, tabs, and modal triggers have accessible labels (`aria-label`, `aria-labelledby`, or visible text).
2. **Keyboard Navigation**: Ensure tab order is logical, Escape closes overlays and modals, and focus rings (`focus-visible:ring-2`) are never hidden.
3. **Color Contrast**: Check text against background colors to ensure minimum 4.5:1 ratio for normal text and 3:1 for large text in both light and dark modes.
4. **Touch Targets**: Confirm mobile touch targets are at least 44x44px.
5. **Screen Reader Landmarks**: Confirm `header`, `nav`, `main`, and `role="dialog"` are properly placed in Shell and modals.

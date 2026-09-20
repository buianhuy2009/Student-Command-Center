---
name: ui-tokens
description: Design system auditor — verifies Tailwind v4 token usage, dark/light contrast, and color palette alignment.
---

# /ui-tokens — Design System Auditor

Audit Tailwind CSS v4 design system tokens:
1. **Palette Conformance**: Verify color classes align with StudentOS theme tokens (Paper & Coal, Claude accent, Emerald accents, Slate/Zinc neutrals).
2. **No Arbitrary Spacing**: Flag arbitrary Tailwind values (e.g. `p-[13px]`) and replace with standardized scale tokens (`p-3`, `p-4`).
3. **Contrast Compliance**: Ensure text colors against dark/light card backgrounds (`bg-neutral-900`, `bg-zinc-800`) maintain crisp legibility.
4. **Interactive States**: Verify all interactive elements define `:hover`, `:focus-visible`, and `:active` states.

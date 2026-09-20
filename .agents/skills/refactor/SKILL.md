---
name: refactor
description: Surgical code refactoring — split monolithic files into clean modules without breaking external interfaces.
---

# /refactor — Surgical Code Refactorer

Refactor large or tightly coupled code safely:
1. **Rule of 200 Lines**: Keep component files focused and under 250 lines. Split helper utilities, custom hooks, and subcomponents into dedicated files.
2. **Backward Compatibility**: Preserve existing exported function signatures in shared services (`services/firebase.ts`, `services/gemini.ts`, `services/canvas.ts`).
3. **Surgical Diffs**: Make targeted edits; do not re-indent or re-format unrelated lines.
4. **Compile Gate**: Run `npm run build` immediately following the refactor to guarantee zero regressions.

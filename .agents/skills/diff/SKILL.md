---
name: diff
description: Git diff analyzer — inspects uncommitted changes and explains them in plain English.
---

# /diff — Git Diff Explainer

Inspect and summarize pending code modifications:
1. **Fetch Diff**: Run `git diff` for unstaged changes and `git diff --cached` for staged changes.
2. **Plain English Breakdown**:
   - What changed: summarize logic, state, or UI changes.
   - Why: outline the intent or bug being resolved.
   - Where: list modified filenames with line number references (e.g. `[src/services/gemini.ts:140-155]`).
3. **Risk Analysis**: Flag any unintentional deletions, console logs, or leaked secrets.

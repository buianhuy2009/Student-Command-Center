---
name: test
description: Targeted test execution — run Vitest on changed files, detect regressions, and auto-repair.
---

# /test — Targeted Test Runner

Run unit and integration tests with surgical precision:
1. **Identify Changed Files**: Detect changed files via `git status --porcelain`.
2. **Run Targeted Tests**:
   - If specific test files changed or are requested: `npx vitest run <path_to_test>`.
   - Otherwise, run fast test suite: `npm test` (`vitest run`).
3. **Auto-Repair Loop**: If a test fails:
   - Read failure stack trace and file line numbers.
   - Apply surgical line edits to fix the root cause.
   - Re-run test (max 3 retry loops).
4. **Report**: Summarize test results (Pass/Fail counts, duration) in plain text without emojis.

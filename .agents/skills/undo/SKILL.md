---
name: undo
description: Safety rollback — revert recent file modifications or restore clean working state.
---

# /undo — Safety Rollback

Revert unwanted changes or roll back to the last known good state:
1. **Inspect Working State**: Run `git status --short` to see what modified files exist.
2. **Selective Rollback**:
   - If user asks to revert specific files: `git checkout -- <file>` or `git restore <file>`.
   - If user asks to undo all recent uncommitted work: `git restore .` (clean working tree).
3. **Safety Check**: Never wipe untracked user notes or credentials without explicit confirmation.
4. **Rebuild**: Run `npm run build` after rollback to verify the restored code compiles cleanly.

---
name: status
description: Workspace HUD & telemetry card — visual display of git branch, sync state, modified files, context gauge, and active toolchain.
---

# /status — Workspace HUD & Telemetry Card

Use this skill to view the full operational status of the workspace.

## Workflow:
1. Run `.agents/bin/vibe_tui.py status` to render the workspace HUD.
2. Reports:
   - Git branch, staged/modified/untracked counters, and remote divergence check.
   - Context window token consumption gauge with compaction alerts.
   - Active CLI theme and model runtime environment.
3. Recommend next steps based on dirty files or pending upstream commits.

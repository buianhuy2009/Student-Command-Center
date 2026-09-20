---
name: doctor
description: Toolchain diagnostics & environment check — verify Node, Git, CLI paths, API keys, and terminal settings.
---

# /doctor — Environment Diagnostics & Doctor

Use this skill to verify that the developer environment, toolchain paths, and CLI settings are functioning optimally.

## Workflow:
1. Run `.agents/bin/vibe_tui.py doctor` to run environment checks.
2. Inspects:
   - Antigravity CLI binary path (`agy`)
   - CLI configuration (`settings.json`)
   - Statusline hook health (`statusline.sh`)
   - macOS audio chime availability (`Glass.aiff`, `Sosumi.aiff`)
   - Node runtime and Git working branch status
3. Flags any misconfigurations and suggests one-click repair commands.

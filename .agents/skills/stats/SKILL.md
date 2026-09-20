---
name: stats
description: Session telemetry & token velocity gauge — monitor flow state duration, turns, tool calls, and token burn speed.
---

# /stats — Session Telemetry & Token Velocity

Use this skill to view operational metrics for the current flow coding session.

## Workflow:
1. Run `.agents/bin/vibe_tui.py stats` to render the session telemetry card.
2. Metrics reported:
   - Flow session elapsed time
   - Turns and tool call volume
   - Token consumption velocity (tokens/min)
   - Current memory footprint relative to context limit

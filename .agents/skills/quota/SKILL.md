---
name: quota
description: Visual quota dashboard — displays side-by-side solid-block progress bars for Gemini and unified Claude/GPT 3P quotas with reset countdowns.
---

# /quota — Visual Quota & Telemetry Dashboard

Use this skill to inspect current API quotas, hourly burn rates, and reset countdowns.

## Workflow:
1. Run `.agents/bin/vibe_tui.py quota` to render the side-by-side visual dashboard.
2. Display:
   - **Gemini Pool**: Rolling 5-hour bar and weekly reset bar with solid blocks (`█` filled, `░` empty).
   - **Third-Party Pool**: Unified rolling and weekly caps shared across Claude and ChatGPT.
   - **Reset Timers**: Multi-day formatting (`4d 13h`, `1h 21m`).
   - **Prompt Cache Lifespan**: Explain that idle re-read window is 1 hour before invalidation.
3. Recommend compaction with `/compact` if memory pressure exceeds 85%.

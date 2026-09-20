---
name: theme
description: CLI visual theme switcher — customize terminal colors across Dark Carbon, Tokyo Night, Monokai, Paper & Coal, and Cyberpunk.
---

# /theme — CLI Visual Theme Engine

Use this skill to inspect or switch developer color themes for the statusline and terminal cards.

## Workflow:
1. To view themes, run `.agents/bin/vibe_tui.py theme`.
2. To apply a theme, run `.agents/bin/vibe_tui.py theme <theme-name>`:
   - `dark-carbon` : Clean cyan & dim gray (default high-contrast dark mode)
   - `tokyo-night` : Deep indigo, soft blue, and magenta accents
   - `monokai`     : Vibrant green, yellow, and magenta neon tones
   - `paper-coal`  : High-contrast white typography with warm amber tags
   - `cyberpunk`   : Neon yellow, cyan, and pink high-energy palette
3. The chosen theme persists in `~/.gemini/antigravity-cli/theme.json` and updates the live statusline automatically.

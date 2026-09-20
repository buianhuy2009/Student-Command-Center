---
name: model
description: Two-tier hierarchical model selector TUI — switch between Gemini, Claude, and GPT-OSS families with reasoning effort tiers.
---

# /model — Two-Tier Model Selector TUI

Use this skill to view available models in a clean two-tier hierarchy (Model Family -> Reasoning Effort tier) and switch models without flat-list clutter.

## Workflow:
1. Run `.agents/bin/vibe_tui.py model` in the terminal to display the visual model picker.
2. Present the choices clearly:
   - **Gemini 3.8 Flash** [Google]: `high` (deep CoT), `medium` (balanced), `low` (fast generation)
   - **Gemini 3.1 Pro** [Google]: `high` (large refactors), `low` (standard Pro)
   - **Claude 4.6** [3P / Anthropic]: `thinking` (Sonnet 4.6), `opus` (Opus 4.6 Thinking)
   - **GPT-OSS 120B** [3P / OpenAI]: `medium` (open weights)
3. To switch the active CLI model, output the command: `agy --model <model-id>` or advise the user to run `/model <id>`.
4. Explain provider quota implications: Gemini uses Google quota; Claude & ChatGPT share the unified 3P quota pool.

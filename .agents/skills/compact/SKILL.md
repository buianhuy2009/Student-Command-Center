---
name: compact
description: Context window pruning — compact conversation history while preserving key architectural decisions and open tasks.
---

# /compact — Context Window Pruner

Prune and summarize conversation context to prevent degradation:
1. **Summarize Milestones**: Preserve completed tasks, modified filenames, and architectural decisions in a bulleted list.
2. **Discard Transients**: Discard raw terminal error dumps, intermediate test outputs, and large file cat contents.
3. **Preserve Open Orders**: Keep pending user requests, open questions, and active git branch status intact.
4. **Clean Baseline**: Reset context token consumption so the agent operates at peak reasoning speed and low latency.

---
name: todo
description: In-terminal Kanban board — track sprint tasks across Planned, In Progress, and Complete without leaving the terminal.
---

# /todo — Terminal Kanban Sprint Board

Use this skill to view or update current tasks directly inside the terminal.

## Workflow:
1. Run `.agents/bin/vibe_tui.py todo` to render the 3-column Kanban board.
2. Columns displayed:
   - **In Progress**: Active flow tasks currently being implemented.
   - **Planned**: Upcoming priority backlog items.
   - **Complete**: Finished and verified tasks.
3. Automatically updates from `.agents/todo.json` when tasks progress.

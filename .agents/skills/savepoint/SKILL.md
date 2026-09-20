---
name: savepoint
description: Create a named git checkpoint before experimental or high-risk refactoring.
---

# /savepoint — Git Checkpoint Creator

Snapshot working directory state before complex refactoring:
1. **Timestamp Tag**: Generate an ISO timestamp or accept a user tag name.
2. **Snapshot**: Create a lightweight stash or work-in-progress checkpoint:
   `git stash push -m "savepoint: $(date +%Y%m%d_%H%M%S) $USER_TAG" --include-untracked`
   followed immediately by:
   `git stash apply` (so your files remain in place while the checkpoint is safely recorded).
3. **Report**: Output the stash index and instructions on how to restore if needed (`git stash pop` or `/undo`).

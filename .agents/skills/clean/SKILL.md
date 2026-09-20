---
name: clean
description: Workspace hygiene — wipe build artifacts, orphaned caches, and temporary debug logs.
---

# /clean — Workspace Cleaner

Clean transient files and build artifacts:
1. **Remove Build Outputs**: Clean `dist/` and `server.js` using `npm run clean`.
2. **Remove Vite Caches**: Clean `.vite/` and `node_modules/.vite/` to resolve stale HMR or bundle cache issues.
3. **Remove Temporary Logs**: Remove `.log` files older than 7 days (e.g. `commander.log` fragments or test logs) while preserving git tracking.
4. **Preserve User Data**: Never delete `.env`, `.env.local`, `scratch/`, or Dexie databases.
5. **Fresh Build**: Run `npm run build` to confirm clean recompilation from zero cache.

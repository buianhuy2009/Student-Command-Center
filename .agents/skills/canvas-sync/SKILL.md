---
name: canvas-sync
description: Canvas LMS integration debugger — troubleshoot sync queues, token refresh, and assignment feeds.
---

# /canvas-sync — Canvas LMS Sync Debugger

Troubleshoot and verify Canvas LMS synchronizations:
1. **Token Invariants**: Confirm Canvas tokens are passed via secure POST request bodies, never logged in terminal output or URL query params.
2. **Feed Merging**: Verify `src/services/canvas.ts` correctly merges RSS/iCal feed items with REST assignment endpoints without duplicating IDs.
3. **Offline Queue**: Ensure offline assignment submissions enqueue properly in Dexie `assignmentsQueue` table and drain when online.
4. **Proxy Reliability**: Validate that the local proxy (`/api/canvas`) handles rate limits with exponential backoff and returns structured error JSON.

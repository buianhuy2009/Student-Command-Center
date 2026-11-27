# StudentOS Development & Agent Rules

## 0. GOLDEN RULE
Use this local clone of `https://github.com/buianhuy2009/Student-Command-Center` as the working copy and sync it with `origin/main` at the start of each task. Finish each requested change by building and publishing it to GitHub after the checks in §3. Never commit tokens or secrets.

## 1. TOKEN EFFICIENCY & CODE CONSTRAINTS
- Make precise, surgical line edits. Do not rewrite full 200+ line files when modifying small functions.
- Do not re-index the entire codebase unless explicitly instructed.

## 2. VERIFICATION & DEPLOYMENT LOOP
Whenever a change is requested:
1. Edit the targeted files.
2. Run `npm run build` in the terminal to verify syntax and bundling.
3. If the build fails: Inspect the terminal error stack and self-repair (Max 3 retry loops).
4. Once `npm run build` passes with exit code 0, follow §3 and push the verified changes to GitHub.
5. Report the build and push results and the Vercel deployment status if available.

## 4. CHANGELOG DISCIPLINE (MANDATORY EVERY UPDATE, BIG OR SMALL)
Every user-visible change must update the changelog in the same session — no silent fixes.
1. Add a `VersionRelease` entry at the top of `RELEASES` in `src/components/ChangelogModal.tsx` (plain English: `highlights` = 1-line student benefits, `details` = what changed + where to find it). Only the newest entry keeps `badge: 'Latest Update'`.
2. Bump `CURRENT_VERSION` in `ChangelogModal.tsx` AND `version` in `package.json` together (patch for fixes, minor for features).
3. Append an `<item>` to `public/changelog.xml` with matching version, date (UTC), title and 1-sentence description.
4. `npm run build` must pass before push. Never leave `RELEASES`, `package.json` and `changelog.xml` out of sync.

## 3. MULTI-AGENT MERGE SAFETY (MANDATORY EVERY SESSION)
Multiple agents and people work on `main` in parallel and may share a Git identity. Preserve concurrent work in the working tree and on GitHub.
1. **Task start**. Run `git fetch origin`, `git log -1 --format='%H %an %s' origin/main`, and `git log --oneline HEAD..origin/main`. If the range contains incoming commits, integrate them before editing. Check `GEMINI.md` as described in §5.
2. **Before each push**. Repeat the fetch and log checks. Identify the remote tip by its exact SHA. Compare it with the SHAs published by this task and the last SHA published by Codex in this clone (`git rev-parse --verify refs/codex/last-pushed-main`). If ownership is uncertain, treat the tip as another session's work. If there are incoming commits, integrate all of them before pushing, even if an author name matches or a commit is yours.
3. **Pull and review**. Save the pre-pull `HEAD` and run `git pull --no-rebase origin main`. Resolve any conflicts while preserving both sets of intended changes. Follow §5 after every pull, including when `GEMINI.md` is added or removed. Review the incoming diff for coherence with your in-progress work, including:
   - resurrected code you deliberately deleted (banners, legacy themes, dead flows),
   - duplicate state/effects for the same concern (two writers of one localStorage key / DOM class),
   - changed signatures of shared services (`services/firebase.ts`, `services/theme.ts`, `services/googleAuth.ts`, `services/canvas.ts`) — keep them backward compatible (optional params, additive exports) and update all call sites.
4. **Rebuild and push**. Run `npm run build` again after integrating incoming work and commit any resulting changes. Record the verified commit SHA. Fetch and check again immediately before `git push origin <verified-sha>:refs/heads/main`. If the remote advances or the push is rejected as non-fast-forward, repeat the merge, review, and build steps. Never force-push. After a successful push, record the published SHA with `git update-ref refs/codex/last-pushed-main <verified-sha>`.
5. **Report**. Tell the user whose commits you integrated, what they touched, and anything you adjusted to keep the merge coherent.

## 5. SYNC GEMINI INSTRUCTIONS INTO AGENTS.MD

- At task start, read the root `GEMINI.md` if present. After every pull, run `git diff <pre-pull-HEAD> HEAD -- GEMINI.md AGENTS.md` and review the current files.
- Port new or revised shared project rules from `GEMINI.md` into this root `AGENTS.md`. Adapt Gemini-specific instructions to Codex where applicable, keep the Codex Git workflow, and reconcile removals from the source while preserving independent Codex rules. Include any resulting `AGENTS.md` edits in the verified push.
- If `GEMINI.md` is absent, use the existing `AGENTS.md` and check again after the next pull.

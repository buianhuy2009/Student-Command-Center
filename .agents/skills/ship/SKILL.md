---
name: ship
description: Production release workflow — verification loop, multi-agent merge check, changelog update, and deployment push.
---

# /ship — Production Shipping Workflow

Safely verify and deploy updates following the project's Golden Rule:
1. **Pre-flight Build**: Execute `npm run build` to confirm clean compilation.
2. **Multi-Agent Sync**:
   - Run `git fetch origin`
   - Check `git log --oneline HEAD..origin/main`
   - If remote moved: `git pull --no-rebase origin main` and re-verify build.
3. **Changelog Discipline**:
   - Add new entry to `src/components/ChangelogModal.tsx` (`RELEASES`, bump `CURRENT_VERSION`).
   - Bump version in `package.json`.
   - Append release entry to `public/changelog.xml`.
4. **Final Verification**: Run `npm run build` again on the merged tree.
5. **Commit & Push**: Create a standard conventional commit and push to `origin main`.

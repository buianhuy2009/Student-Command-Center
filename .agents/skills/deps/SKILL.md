---
name: deps
description: Dependency health & security auditor — inspects npm packages, vulnerabilities, and lockfile coherence.
---

# /deps — Dependency Health Auditor

Audit package dependencies in `package.json`:
1. **Audit Check**: Run `npm audit --omit=dev` to verify zero critical or high vulnerabilities.
2. **Duplicate Packages**: Check `package-lock.json` for conflicting multiple versions of core packages (`react`, `vite`, `firebase`).
3. **Lockfile Integrity**: Confirm `package.json` and `package-lock.json` are in sync without uncommitted modifications.
4. **Upgrade Guidance**: If updates are needed, advise on backwards compatibility before running upgrades.

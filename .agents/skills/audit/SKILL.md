---
name: audit
description: Deep codebase sanity audit — TypeScript checks, build health, dead imports, and security review.
---

# /audit — Deep Codebase Sanity Audit

Execute a thorough codebase health audit:
1. **Typecheck**: Run `npm run lint` (`tsc --noEmit`) to verify zero type errors across all workspaces and services.
2. **Bundle & Build**: Run `npm run build` to confirm Vite code-splitting and esbuild server bundling succeed with exit code 0.
3. **Security Scan**: Check for raw API keys, unmasked tokens in logs, unescaped HTML injection, and insecure iframe embeds.
4. **Bundle Efficiency**: Ensure no new direct dependencies bloated `dist/` or broke the lazy chunks (`mermaid`, `katex`, `firebase`).
5. **Output**: Format findings in a clean ASCII summary table listing Status, Severity, and Recommended Fix.

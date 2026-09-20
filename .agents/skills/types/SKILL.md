---
name: types
description: TypeScript strictness auditor — detects implicit any, type regressions, and missing exports.
---

# /types — TypeScript Strictness Auditor

Audit type safety across the repository:
1. **Strict Typecheck**: Run `npx tsc --noEmit` and capture all errors with exact line numbers.
2. **Eliminate Unnecessary `any`**: Replace raw `any` types with explicit interfaces, generics, or `unknown` with runtime type narrowing.
3. **Verify Service Contracts**: Ensure shared service interfaces in `src/types.ts` and `src/services/` remain backward-compatible for parallel agents.
4. **Fix Import Resolution**: Resolve any broken `@/` or relative path imports immediately.

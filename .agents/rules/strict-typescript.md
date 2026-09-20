# Strict TypeScript & Type Safety Rules

1. **Zero `any` Policy**: Never introduce raw `any` types. Use explicit interfaces, generics, type unions, or `unknown` with runtime type narrowing.
2. **Backward-Compatible Interfaces**: Keep shared service signatures (`services/firebase.ts`, `services/gemini.ts`, `services/canvas.ts`) backward-compatible. Add optional parameters rather than mutating required parameter signatures.
3. **Pre-Commit Verification**: Run `npm run lint` (`tsc --noEmit`) to verify zero compiler errors before completing tasks.

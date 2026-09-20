# Security & Privacy Invariants

1. **XSS Sanitization**: All AI-generated output, syllabus data, and external markdown must pass through DOMPurify or allowlisted `react-markdown`. Never use raw `dangerouslySetInnerHTML`.
2. **SSRF Allowlisting**: Server-side proxies in `api/index.js` and `server.ts` must restrict URLs to an explicit allowlist of approved academic hostnames.
3. **API Key Guarding**: Client API keys must be stored in session storage or AES-GCM PIN encrypted storage (`src/services/gemini.ts`), never logged in raw form or committed to git.
4. **Child Safety & PII**: Truncate all logged prompts to 300 characters and redact student full names to initials by default.

---
name: security
description: Security vulnerability scanner — audits XSS, SSRF allowlists, CORS policy, and secret leaks.
---

# /security — Security Vulnerability Scanner

Audit security invariants across client and server:
1. **API Key Storage**: Verify API keys (Gemini, Groq) use PIN encryption or session storage (`src/services/gemini.ts`), never plain logging.
2. **XSS Protection**: Ensure all AI-generated markdown and HTML pass through `DOMPurify.sanitize()` or strict `react-markdown` allowlists.
3. **SSRF Allowlisting**: Check serverless proxy routes (`api/index.js`, `server.ts`) to ensure Canvas and external requests only hit approved hostnames.
4. **CORS Headers**: Verify `vercel.json` and server handlers never use wildcard `Access-Control-Allow-Origin: *` with credentials.
5. **PII Masking**: Ensure logged prompts and student names are truncated to 300 characters with sensitive personal details redacted.

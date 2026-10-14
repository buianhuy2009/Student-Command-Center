## 2026-09-06 - Mermaid.js Strict Security Level for XSS Prevention
**Vulnerability:** Mermaid diagrams were initialized with `securityLevel: 'loose'`, allowing potential execution of embedded JavaScript or malicious HTML tags when rendering untrusted or AI-generated Mermaid code blocks.
**Learning:** `securityLevel: 'loose'` disables Mermaid's internal HTML sanitization and tags restriction. Combined with DOMPurify sanitization, setting `securityLevel: 'strict'` guarantees that rendered diagram SVGs cannot execute script blocks.
**Prevention:** Always initialize `mermaid` with `securityLevel: 'strict'` across all workspace components rendering dynamic diagram input.

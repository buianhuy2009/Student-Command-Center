## 2026-09-06 - Strict Mermaid Security Configuration
**Vulnerability:** Mermaid workspace components initialized `mermaid.initialize({ securityLevel: 'loose' })`, allowing raw HTML and JS click handlers in SVG diagrams.
**Learning:** `securityLevel: 'loose'` bypasses Mermaid's built-in SVG sanitization, risking XSS if untrusted or AI-generated diagram code contains inline scripts or event handlers.
**Prevention:** Always set `securityLevel: 'strict'` during `mermaid.initialize` and pair with DOMPurify SVG profile sanitization before DOM injection.

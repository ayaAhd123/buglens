# Screenshots

This folder is reserved for images referenced by `PROJECT_REPORT.md`.

No screenshots have been captured into the repository yet. Do not commit images that show API keys, `.env` contents, request headers, or provider error bodies.

Suggested captures, using the running dashboard:

1. `01-editor-empty.png` — desktop view before analysis, with the sample label visible.
2. `02-findings-reviewer.png` — detective findings and the AI Reviewer after a real analysis.
3. `03-corrected-and-diff.png` — corrected-code panel, Copy code button, and before/after diff.
4. `04-mobile-nav.png` — narrow viewport with the navigation drawer or stacked sections.
5. `05-unavailable-fix.png` — only if you can produce an empty `fixedCode` without exposing secrets. Mock mode does not do this; it returns the original source.

Capture from a page served on an origin listed in `CORS_ORIGINS` (the example allowlist is `http://localhost:5173` and `http://127.0.0.1:5173`).

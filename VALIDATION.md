# Version 1.1.0 validation

The compiled extension in `dist/` runs without a development server. The ZIP is an alternative unpacked-install package. No paid provider credentials are used in automated checks.

| Check | Result |
| --- | --- |
| Strict application TypeScript and Vite build | Passed |
| ESLint and 300-line source limit | Passed |
| Built service-worker smoke checks | 17 passed, including only three enabled prompts of five, safe status, authentication, permissions, errors, malformed output and network failures |
| Chromium integration | Passed with a real local HTTP mock provider on a strict-CSP, Trusted-Types page |
| Prompt management | Five prompts saved; three enabled; Saved notification, exclusions and persistence verified |
| Markdown | Headings, bold, italics, lists, quotes, table and code nodes verified; dangerous links and injected HTML do not create executable elements |
| Full content and scrolling | End-of-response sentinel retained, hidden scrollbar confirmed, real wheel scrolling verified |
| Resizing | Actual corner drag enlarged width and height; screenshot inspected |
| Dynamic-page behavior | Response selection works while an input retains focus; document event interception and card-host removal recovery verified |
| Privacy | Editable input selection sends no request; credentials absent from webpage DOM |
| Themes | Light and dark screenshots produced and visually reviewed |
| Vitest unit suite | Added regression tests, but Vitest is unavailable locally and registry downloads are blocked |
| Full test-inclusive typecheck | Remains blocked by missing Vitest types; application typecheck passes |
| Dependency lockfile | Full development dependency metadata cannot be resolved offline; no fabricated lockfile supplied |

## Manual checks remaining

1. Load `dist/` using Chrome Developer mode, reload an existing installation, and refresh webpages. Confirm version 1.1.0 in extension details.
2. Approve the native optional provider-host permission dialog. The automated fixture pregrants only its local mock host because the native dialog has no headless UI automation.
3. Test your actual provider and authenticated ChatGPT response selections. The live service was not automated; the retained-composer-focus behavior was reproduced locally. Chrome's protected pages cannot be bypassed.
4. With registry access, run `npm install`, retain its generated lockfile, and run `npm run typecheck` and `npm run test`. Test touch selection and browser/service-worker restarts on your target Chrome version.

The earlier worker timeout is not currently reproduced. Storage initialization now retries after transient failure, messaging reports native errors without retrying paid requests, and the service worker is bundled as one standalone file without module-chunk startup dependencies. This is not a guarantee against browser or provider interruptions.

# Delivery validation

The application was built and exercised in Chromium on 2026-11-13. `dist/` is ready to load unpacked; it requires no Node.js or development server to run.

| Check | Result |
| --- | --- |
| Production TypeScript | Passed through `npm run build` and its strict application configuration |
| Build | Passed; manifest worker, popup, content script, and PNG icons exist |
| ESLint | Passed |
| Source line limit | Passed; no source file exceeds 300 lines |
| Built service-worker smoke checks | 16 passed; authenticated payload, safe status, privilege boundaries, discovery, HTTP errors, malformed responses, network failure, revoked access, disabled/unconfigured settings, invalid messages |
| Actual Chromium extension integration | 1 comprehensive scenario passed; provider create/edit/delete, model choice, custom prompt, loading card, real local HTTP completion, auth header, safe plain-text response, closed Shadow DOM, light/dark themes, Escape, next selection, editable-field privacy, reopening persistence, discovery and prompt reset |
| Browser console errors | None in the successful integration scenario |
| Visual review | Light selection card and dark settings screenshots reviewed |
| Full `npm install` | Blocked by environment network access (`EACCES`). Used existing local tools and genuine cached packages to build and test |
| Full `npm run typecheck` | Blocked by missing Vitest declarations; includes tests as well as production code |
| Vitest unit tests | Written but not executed: Vitest and its dependencies are absent locally and downloads are blocked |
| Dependency lockfile | Not generated: offline registry metadata cannot resolve the complete development dependency tree. Run `npm install` with registry access to install dependencies and generate it |

The successful Chromium run used an installed Chromium executable selected through `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Its temporary extension manifest pregranted only the local mock provider host; the shipped manifest continues to use optional provider host access.

## Remaining verification

1. Open `chrome://extensions`, enable Developer mode, and load `dist/` unpacked. Open the toolbar popup, add your provider, and approve Chrome's native host permission dialog. Decline it once to check the error, then save again and approve. This native dialog was not automated.
2. With registry access, run `npm install`, `npm run typecheck`, and `npm run test`; retain the generated lockfile. Vitest tests cover cases beyond the smoke and browser scenarios, including timeout, geometry, rapid selection, copy, and cancellation.
3. Follow the detailed manual acceptance checklist in `README.md`, especially real-provider compatibility, browser restart, service-worker interruption, viewport zoom, touch selection, and restricted pages. No real paid-provider credentials were used during validation.

The current extension is functional; the unexecuted checks above mean full release acceptance is still pending.

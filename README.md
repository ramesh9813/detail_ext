# AI Selection Explainer

A local Chrome Manifest V3 extension that explains text automatically when you finish selecting it on a supported webpage. A compact card appears beside the selection with a loading state, followed by the provider's answer. All provider settings live in the toolbar popup.

The settings interface uses React and TypeScript. The selection listener and Shadow DOM card use native DOM APIs so showing an explanation does not initialize React on the webpage. Requests use the standard OpenAI-compatible Chat Completions API with your own provider and credentials. No backend service is required.

## Install from source

1. Install Node.js 20.19+ or a current supported LTS release with npm.
2. Open a terminal in this project directory.
3. Run `npm install`.
4. Run `npm run build`.
5. Open `chrome://extensions` in Chrome.
6. Enable **Developer mode**.
7. Click **Load unpacked** and select this project's `dist` directory.
8. Pin **AI Selection Explainer** using Chrome's Extensions menu.
9. Click the toolbar icon to configure your provider.

The compiled extension runs without Vite or any development server. After rebuilding, click **Reload** on its card at `chrome://extensions`, then reload webpages that were open before the extension was installed or updated. Keep the `dist` folder in place while Chrome uses it.

## Configure a provider

1. Open the toolbar popup and choose **Add provider**.
2. Enter a display name and your provider's API root, such as `https://api.example.com/v1`.
3. Enter the API key required by your provider. Leave it empty only if that provider accepts unauthenticated requests, as some local servers do.
4. Enter one or more model IDs, separated by commas. Model IDs must match the provider's identifiers exactly.
5. Save the provider and approve Chrome's request for access to that provider host.
6. Select the active provider and model. Keep automatic explanations enabled.
7. Optionally use **Find models** to request `/models`. A discovered ID does not guarantee your account can use it; manual model IDs remain supported when discovery is unavailable.
8. Use **Test connection** to check the active configuration. This sends a small generation request and may incur a provider charge.
9. Edit and save **Custom Explanation Prompt** to replace the default instruction. Reset restores the built-in instruction; an empty prompt falls back to that default.

The API root must not include `/chat/completions`, `/models`, embedded credentials, query parameters, or a fragment. Remote providers require HTTPS. HTTP is accepted only for explicit loopback endpoints such as `http://localhost:1234/v1` or `http://127.0.0.1:8080/v1`. The local server must already be running and implement the compatible API.

Saving an edited provider requests host access for its current destination. If access is declined or later revoked, authenticated requests cannot proceed until access is restored in settings. Chrome host permissions cover the provider host rather than one exact port or API path. Removing a provider removes its configuration; inspect the extension's Chrome permissions to revoke previously granted host access.

Saved keys are masked when the provider form is reopened. Choose **Replace key** to provide a new key; an empty replacement removes authentication. The saved complete key is not displayed in the form.

## Use the extension

Visit an ordinary HTTP/HTTPS webpage and select a word, sentence, or paragraph, for example **Artificial General Intelligence**. Finish the selection by releasing the pointer or completing a keyboard selection. No additional Explain button or shortcut is needed.

The card shows a loading indicator promptly after selection completes. Answers render as plain text with preserved line breaks, without interpreting HTML. Use the close button, Escape, or click outside to dismiss it. Use **Copy** to copy a successful response. Selecting new text replaces the current explanation; a stale response cannot overwrite the latest selection.

The interface follows the operating system's light or dark preference automatically. Long answers scroll inside the card. Disable automatic explanations from the toolbar popup when you do not want selections sent to your provider.

## Privacy and security

**When enabled and configured, finishing a selection sends the selected text and your configured explanation instruction to your chosen AI provider.** Only the selection is sent, not the complete page or browsing history. Review your provider's privacy policy before selecting confidential material. Automatic selection is the core interaction; there is no per-selection confirmation.

Provider configuration and API credentials are stored in `chrome.storage.local`, with access restricted to trusted extension contexts. They are not put in synchronized storage or sent to the webpage content script. Local extension storage is not encryption and does not protect against every threat on your device or access to your browser profile.

Network requests are made by the background service worker using validated saved provider destinations and granted host permissions. Webpages cannot supply an arbitrary authenticated destination. Selected text is sent separately from system instructions and treated as untrusted data. This separation reduces instruction confusion, but a provider can still produce inaccurate or inappropriate explanations. Check important answers.

The extension does not add analytics, tracking, remote executable code, or telemetry. Editable fields, password inputs, and contenteditable regions are excluded from automatic capture by default. Do not rely on this as a way to classify all sensitive text: confidential text displayed as ordinary page content can still be selected and sent.

## Performance and request limits

- The native floating card renders before the network response. React is confined to the settings popup.
- A short selection completion delay avoids sending requests continuously while dragging.
- Responses use `stream: false`. The answer appears when the provider finishes; provider and network latency determine the wait.
- Requests have a 25-second timeout. There are no automatic retries of paid generation requests.
- Selections are limited to 20,000 characters. Shorter selections are faster and usually cheaper.
- New selections and dismissal cancel previous requests where possible. Cancellation cannot guarantee that a provider stops generation or avoids billing.

## Development and checks

```sh
npm install
npm run typecheck
npm run lint
npm run test
npm run check:lines
npm run build
npm run test:smoke
npm run test:e2e
```

Unit tests use mocked providers and browser APIs, without paid API credentials. Integration tests use Playwright and Chromium where available; install its browser if needed with `npx playwright install chromium`. A graphical desktop or an environment supporting Chromium is required for browser integration checks. The build script produces all manifest entry points and assets in `dist`.

`npm run check:lines` fails if a TypeScript, TSX, JavaScript, JSX, or CSS source file exceeds 300 physical lines. Generated build artifacts and dependency files are excluded. EditorConfig defines source formatting. `npm run typecheck:app` checks production TypeScript separately from test dependencies.

The integration test copies the extension into a temporary fixture and pregrants only its mock loopback host. Chrome's native optional-host permission approval requires the manual permission check below. To use an existing Chromium binary, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable path before running the integration command. `npm run test:smoke` checks the actual built worker with mocked browser storage and provider responses.

See `VALIDATION.md` for checks actually executed and the remaining dependency and manual checks.

## Architecture

| Area | Responsibility |
| --- | --- |
| `src/shared` | Strict shared contracts, default prompt, request limits |
| `src/storage` | Trusted local configuration and pure provider operations |
| `src/providers` | Destination validation, permission checks, fetch, response normalization |
| `src/background` | Sender validation, request routing, cancellation, provider calls |
| `src/content` | Selection completion, privacy exclusions, latest-request handling |
| `src/floating-ui` | Isolated native card, viewport positioning, loading/error/content states |
| `src/popup` | React provider management, active model, prompts, status |
| `src/messaging` | Typed extension messaging and interruption handling |
| `scripts` | Source-length validation and release asset preparation |

The Manifest V3 service worker reads current persisted settings per request rather than assuming in-memory configuration survives browser restarts. Content scripts receive safe configuration status and explanation results, never API credentials.

## Manual acceptance checklist

Perform these checks in Chrome after building and loading `dist`. Use a development provider with dummy credentials for error and privacy tests; avoid real paid credentials in logs or captures.

| Check | Procedure and expected result |
| --- | --- |
| Installation | Load `dist` unpacked; inspect `chrome://extensions` for manifest or worker errors. Open the toolbar popup. |
| First-time setup | Before saving a provider, select text on an ordinary page. No provider network request should be sent. The popup explains setup. |
| Provider lifecycle | Add two differently named providers, edit an endpoint and name, switch active provider, delete the active provider. Remaining configuration stays usable. Duplicate names and empty required fields show a clear error. |
| Models | Enter two manual model IDs, switch the active model, and reopen the popup. The selected model persists. Discover models on a compatible endpoint, then on an endpoint without discovery; manual entry remains usable. |
| Key masking | Save a dummy key, close/reopen the popup, and edit the provider. The complete key is not shown. Replace it and verify the replacement is used. Keep the old key using the provided action; try an empty replacement for a no-authentication provider. |
| Permissions | Decline the provider host permission, verify the save/request feedback, then allow it. Revoke host access through Chrome's extension settings and verify requests are blocked until restored. Remote HTTP, credentials in URLs, and endpoint URLs must be rejected. |
| Prompts | Save a distinctive custom prompt, reopen the popup, and verify it persists exactly. Reset to default. Save an empty prompt and verify the default is used. Inspect a dummy-provider request to confirm selection and system instruction are separate messages. |
| Selection | Select a word, sentence, paragraph, multiline passage, and text spanning nested elements. Test double-click and Shift+Arrow selection. Each completed selection opens one nearby card without changing page text. |
| Selection privacy | Select text in text inputs, textareas, password inputs, and contenteditable regions. No explanation request should be sent. Select within the extension card and verify it does not explain itself. |
| Loading and success | Delay a dummy provider response, select text, and confirm the card shows loading before the response. Return a valid completion and verify its exact plain-text content appears. |
| Rendering safety | Return text containing `<script>`, HTML tags, and event-handler attributes. It must display as literal text without executing or inserting model-generated elements. |
| Geometry | Select text near each viewport edge and at the bottom of a long page. Scroll, resize, zoom, and test a narrow viewport. The card remains usable and its long content scrolls internally. |
| Themes and isolation | Change system light/dark preference with a card open. Test on a page with aggressive global CSS; card colors and layout remain isolated and readable. |
| Copy and dismissal | Copy a successful answer and paste it into a text editor. Close via the close button, Escape, and an outside click. Select the same phrase again after dismissal to request a new explanation. |
| Rapid requests | Return the first response slowly and the second quickly. Select two different phrases in succession. Only the second result remains visible. Dismiss during a pending request and verify no stale result reopens the card. |
| Error states | With a dummy endpoint, return HTTP 401, 403, 404, 429, invalid JSON, an empty completion, and an incompatible body. Verify readable errors with no credentials. Delay past 25 seconds and verify timeout feedback. Disconnect the endpoint and verify network failure feedback. |
| Service-worker lifecycle | Stop the worker using extension developer tools, then make another selection. It should restart and use saved settings. If an in-flight request is interrupted, verify readable feedback and recovery after selecting again or refreshing. |
| Navigation | Test a long scrollable page, a single-page application route change, and a full navigation. Check for duplicate listeners/cards and obsolete results. |
| Persistence and tabs | Save configuration, disable/re-enable explanations, and verify behavior in two open tabs. Restart Chrome and confirm provider, model, prompt, and enabled setting persist. |
| Credential boundary | Using dummy credentials, inspect content-script messages and webpage DOM. No API key should appear there or in logs. Only the worker sends authenticated fetch requests. |

## Known limitations and troubleshooting

- Chrome internal pages, the Chrome Web Store, restricted browser interfaces, PDF viewers, and inaccessible or uninjected frames are unsupported. Cross-origin iframe selections are not guaranteed to work.
- Touch selection handles and unusual custom editors vary by browser and page. Editable fields are deliberately excluded. Closed page Shadow DOM and page event interception can prevent selection detection.
- Permission to reach an endpoint does not guarantee the endpoint is reachable or that a model is enabled for your account. Providers must support Chat Completions; response formats and authentication schemes outside that API are unsupported.
- Chrome's network policy or local network restrictions may prevent loopback access. The extension does not bypass browser security controls, start local servers, or downgrade HTTPS.
- Copy requires browser clipboard support and a user gesture. If copying fails, select and copy the displayed response manually.
- A card showing an interrupted connection after reloading/updating the extension requires a webpage refresh. Existing content scripts belong to the previous extension instance.
- API keys are optional because some compatible local providers do not require them. A remote provider that requires a key reports its authentication failure when tested or called.
- Provider-side cost, output quality, response time, context limits, availability, and data retention are controlled by the configured provider.

If an explanation fails, first check that the extension is enabled, the intended provider and model are selected, host access is granted, and the API root is correct. Use **Test connection**, read its message, and consult your provider's model and authentication documentation. Never paste your API key into a bug report.
"# detail_ext" 

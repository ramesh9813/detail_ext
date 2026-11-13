import { test, expect, chromium, type BrowserContext, type Worker, type Page } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

let context: BrowserContext;
let worker: Worker;
let server: Server;
let root: string;
let origin: string;
let extensionId: string;
const requests: { authorization?: string; body: unknown }[] = [];
const key = 'test-only-local-secret';
const pageErrors: string[] = [];
const markdownResponse = [
  '## Meaning', '**Amount &amp; quantity** or *quantity*.',
  '- First item\n- Second item', '> Useful context.',
  '| Word | Meaning |\n| :--- | ---: |\n| quantity | amount |',
  '```ts\nconst quantity = 2;\n```',
  '[Reference](https://example.com)', '[Unsafe](javascript:alert(1))',
  '<img src=x onerror=alert(1)>',
  ...Array.from({ length: 35 }, (_, index) => `Paragraph ${index + 1}: A complete explanation with useful details.`),
  '**END OF RESPONSE**',
].join('\n\n');

test.beforeAll(async () => {
  server = createServer((request, response) => {
    if (request.method === 'OPTIONS') {
      response.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' });
      response.end(); return;
    }
    if (request.url === '/v1/chat/completions') {
      let body = '';
      request.on('data', chunk => { body += String(chunk); });
      request.on('end', () => {
        requests.push({ authorization: request.headers.authorization, body: JSON.parse(body) as unknown });
        setTimeout(() => {
          response.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          response.end(JSON.stringify({ choices: [{ message: { content: markdownResponse } }] }));
        }, 1000);
      });
      return;
    }
    if (request.url === '/v1/models') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ data: [{ id: 'discovered-model' }] })); return;
    }
    if (request.url === '/fixture.css') {
      response.writeHead(200, { 'Content-Type': 'text/css' });
      response.end('body {font:20px system-ui;padding:80px} .spacer {height:1500px}'); return;
    }
    if (request.url === '/site.js') {
      response.writeHead(200, { 'Content-Type': 'text/javascript' });
      response.end('document.addEventListener("keyup", event => event.stopImmediatePropagation(), true);'); return;
    }
    response.writeHead(200, { 'Content-Type': 'text/html', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; require-trusted-types-for 'script'" });
    response.end('<!doctype html><html><head><title>Selection test</title><link rel="stylesheet" href="/fixture.css"><script src="/site.js"></script></head><body><p id="selection">Artificial General Intelligence</p><p id="second">Neural networks</p><input aria-label="Sensitive input" value="private data"><div class="spacer"></div></body></html>');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Mock server did not start');
  origin = `http://127.0.0.1:${address.port}`;
  root = await mkdtemp(path.join(tmpdir(), 'selection-explainer-e2e-'));
  const extensionPath = path.join(root, 'extension');
  await cp(path.resolve('dist'), extensionPath, { recursive: true });
  // Native optional-permission approval has no headless UI. Pregrant only the
  // mock loopback host using a temporary test manifest; production is untouched.
  const manifestPath = path.join(extensionPath, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
  manifest.host_permissions = ['http://127.0.0.1/*'];
  await writeFile(manifestPath, JSON.stringify(manifest));
  context = await chromium.launchPersistentContext(path.join(root, 'profile'), {
    channel: 'chromium', headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  extensionId = new URL(worker.url()).host;
});

test.afterAll(async () => {
  await context?.close();
  await new Promise<void>(resolve => server?.close(() => resolve()));
  if (root) {
    const resolved = path.resolve(root);
    if (path.dirname(resolved) !== path.resolve(tmpdir()) || !path.basename(resolved).startsWith('selection-explainer-e2e-')) {
      throw new Error('Refusing to clean an unexpected test directory');
    }
    await rm(resolved, { recursive: true, force: true });
  }
});

async function openPopup() {
  const page = await context.newPage();
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') pageErrors.push(message.text()); });
  await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
  await expect(page.getByRole('heading', { name: 'Selection Explainer', exact: true })).toBeVisible();
  return page;
}

async function selectParagraph(page: Page, id = 'selection') {
  await page.evaluate((elementId) => {
    const element = document.getElementById(elementId);
    if (!element) throw new Error('Missing selection fixture');
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection?.removeAllRanges(); selection?.addRange(range);
    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', shiftKey: true, bubbles: true }));
  }, id);
}

async function readClosedCard(page: Page, selector = '.body', script = 'function(selector) { return this.querySelector(selector).textContent; }'): Promise<string> {
  // DevTools may inspect closed roots without changing the production isolation.
  const session = await context.newCDPSession(page);
  try {
    await session.send('DOM.enable');
    const document = await session.send('DOM.getDocument', { depth: -1, pierce: true });
    type Node = { nodeId: number; attributes?: string[]; children?: Node[]; shadowRoots?: Node[] };
    const find = (node: Node): Node | undefined => {
      if (node.attributes?.includes('data-ai-selection-explainer')) return node;
      for (const child of [...(node.children ?? []), ...(node.shadowRoots ?? [])]) {
        const found = find(child); if (found) return found;
      }
      return undefined;
    };
    const host = find(document.root);
    const shadow = host?.shadowRoots?.[0];
    if (!shadow) return '';
    const resolved = await session.send('DOM.resolveNode', { nodeId: shadow.nodeId });
    const value = await session.send('Runtime.callFunctionOn', {
      objectId: resolved.object.objectId,
      functionDeclaration: script,
      arguments: [{ value: selector }],
      returnByValue: true,
    });
    return String(value.result.value ?? '');
  } finally { await session.detach(); }
}

test('prompts, Markdown, resizing, scrolling and dynamic-page selection', async () => {
  const popup = await openPopup();
  const prompts = popup.getByRole('region', { name: 'Custom prompts' });
  expect(await popup.locator('body').evaluate(node => node.getBoundingClientRect().width)).toBe(640);
  await expect(popup.getByText('Clarity, right where you read.', { exact: true })).toHaveCount(0);
  await prompts.getByRole('button', { name: 'Edit prompt Explain', exact: true }).click();
  await popup.getByLabel('Prompt name').fill('Task 1');
  await popup.getByLabel('Prompt content').fill('Explain briefly with an example.');
  await popup.getByRole('button', { name: 'Save prompt', exact: true }).click();
  await expect(prompts.getByRole('status')).toHaveText('Saved');
  for (let index = 2; index <= 5; index++) {
    await prompts.getByRole('button', { name: 'Add prompt', exact: true }).click();
    await popup.getByLabel('Prompt name').fill(`Task ${index}`);
    await popup.getByLabel('Prompt content').fill(`Instruction ${index}`);
    await popup.getByRole('button', { name: 'Save prompt', exact: true }).click();
    await expect(popup.getByRole('button', { name: 'Save prompt', exact: true })).toHaveCount(0);
  }
  await prompts.getByLabel('Enable Task 2', { exact: true }).uncheck();
  await expect(prompts.getByLabel('Enable Task 2', { exact: true })).not.toBeChecked();
  await prompts.getByLabel('Enable Task 4', { exact: true }).uncheck();
  await expect(prompts.getByText('3 active', { exact: true })).toBeVisible();
  await popup.getByRole('button', { name: '+ Add provider', exact: true }).click();
  await popup.getByLabel('Provider name').fill('Local mock');
  await popup.getByLabel('API base URL').fill(`${origin}/v1`);
  await popup.getByLabel('API key', { exact: true }).fill(key);
  await popup.getByLabel('Model IDs').fill('mock-model, second-model');
  await popup.getByRole('button', { name: 'Save provider', exact: true }).click();
  await expect(popup.getByRole('button', { name: 'Save provider', exact: true })).toHaveCount(0);
  await popup.getByLabel('Active model').selectOption('second-model');
  await popup.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(popup.getByRole('button', { name: 'Replace key', exact: true })).toBeVisible();
  expect(await popup.content()).not.toContain(key);
  await popup.getByRole('button', { name: 'Save provider', exact: true }).click();
  await expect(popup.getByRole('button', { name: 'Save provider', exact: true })).toHaveCount(0);
  await popup.emulateMedia({ colorScheme: 'light' });
  await popup.screenshot({ path: 'test-results/popup-light.png', fullPage: true });
  await popup.emulateMedia({ colorScheme: 'dark' });
  await popup.screenshot({ path: 'test-results/popup-dark.png', fullPage: true });
  await popup.close();

  const page = await context.newPage();
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(origin);
  // ChatGPT can retain composer focus while its response text is selected.
  await page.getByLabel('Sensitive input').focus();
  await selectParagraph(page);
  const host = page.locator('[data-ai-selection-explainer]');
  await expect(host).toBeVisible();
  await expect.poll(() => readClosedCard(page)).toContain('Processing...');
  await expect.poll(() => readClosedCard(page, '.provider')).toBe('Using Local mock');
  await expect.poll(() => readClosedCard(page)).toContain('END OF RESPONSE');
  const count = (selector: string) => readClosedCard(page, selector, 'function(s) { return String(this.querySelectorAll(s).length); }');
  expect(await count('.body strong')).toBe('2');
  expect(await readClosedCard(page, '.body strong')).toBe('Amount & quantity');
  expect(await count('.body em')).toBe('1');
  expect(await count('.body table')).toBe('1');
  expect(await count('.body pre code')).toBe('1');
  expect(await count('.body img, .body script, .body a[href^="javascript:"]')).toBe('0');
  const style = 'function(s) { return getComputedStyle(this.querySelector(s)).scrollbarWidth; }';
  expect(await readClosedCard(page, '.body', style)).toBe('none');
  const initial = await host.boundingBox();
  if (!initial) throw new Error('Missing card bounds');
  await page.mouse.move(initial.x + initial.width / 2, initial.y + 90);
  await page.mouse.wheel(0, 1000);
  await expect.poll(async () => Number(await readClosedCard(page, '.body', 'function(s) { return String(this.querySelector(s).scrollTop); }'))).toBeGreaterThan(0);
  const corner = JSON.parse(await readClosedCard(page, '.resize-handle', 'function(s) { return JSON.stringify(this.querySelector(s).getBoundingClientRect().toJSON()); }')) as { x: number; y: number; width: number; height: number };
  await page.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2);
  await page.mouse.down();
  await page.mouse.move(corner.x + 165, corner.y + 115, { steps: 8 });
  await page.mouse.up();
  const resized = await host.boundingBox();
  expect(resized?.width).toBeGreaterThan(initial.width + 100);
  expect(resized?.height).toBeGreaterThan(initial.height);
  await readClosedCard(page, '.body', 'function(s) { this.querySelector(s).scrollTop = 0; return "top"; }');
  await page.screenshot({ path: 'test-results/markdown-resized.png' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: 'test-results/markdown-dark.png' });
  const sent = requests.at(-1);
  expect(sent?.authorization).toBe(`Bearer ${key}`);
  const body = sent?.body as { model: string; messages: Array<{ role: string; content: string }> };
  expect(body.model).toBe('second-model');
  expect(body.messages[1].content).toBe('Artificial General Intelligence');
  expect(body.messages[0].content).toContain('Task 1');
  expect(body.messages[0].content).toContain('Instruction 3');
  expect(body.messages[0].content).toContain('Instruction 5');
  expect(body.messages[0].content).not.toContain('Instruction 2');
  expect(body.messages[0].content).not.toContain('Instruction 4');
  expect(await page.content()).not.toContain(key);
  await page.keyboard.press('Escape');
  await expect(host).toBeHidden();
  const beforeSecond = requests.length;
  await page.evaluate(() => {
    document.addEventListener('keyup', event => event.stopImmediatePropagation(), true);
  });
  await selectParagraph(page, 'second');
  await expect.poll(() => requests.length).toBe(beforeSecond + 1);
  await expect.poll(() => readClosedCard(page)).toContain('END OF RESPONSE');
  await page.evaluate(() => document.querySelector('[data-ai-selection-explainer]')?.remove());
  await expect(host).toBeVisible();
  await page.keyboard.press('Escape');
  const beforeInput = requests.length;
  await page.getByLabel('Sensitive input').selectText();
  await page.keyboard.press('Shift');
  await expect(host).toBeHidden();
  expect(requests.length).toBe(beforeInput);
  expect(pageErrors).toEqual([]);
  const reopened = await openPopup();
  await expect(reopened.getByLabel('Enable Task 2', { exact: true })).not.toBeChecked();
  await expect(reopened.getByLabel('Enable Task 4', { exact: true })).not.toBeChecked();
  await expect(reopened.getByText('3 active', { exact: true })).toBeVisible();
});

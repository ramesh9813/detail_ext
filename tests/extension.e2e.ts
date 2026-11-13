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
          response.end(JSON.stringify({ choices: [{ message: { content: 'A broad ability to learn and solve many different tasks.' } }] }));
        }, 1000);
      });
      return;
    }
    if (request.url === '/v1/models') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ data: [{ id: 'discovered-model' }] })); return;
    }
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end('<!doctype html><html><head><title>Selection test</title></head><body style="font:20px system-ui;padding:80px"><p id="selection">Artificial General Intelligence</p><p id="second">Neural networks</p><input aria-label="Sensitive input" value="private data"><div style="height:1500px"></div></body></html>');
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

async function readClosedCard(page: Page): Promise<string> {
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
      functionDeclaration: 'function() { return this.querySelector(".body").textContent; }',
      returnByValue: true,
    });
    return String(value.result.value ?? '');
  } finally { await session.detach(); }
}

test('provider setup, selection explanation, privacy, persistence and settings management', async () => {
  const popup = await openPopup();
  await popup.getByRole('button', { name: '+ Add provider' }).click();
  await popup.getByLabel('Provider name').fill('Local mock');
  await popup.getByLabel('API base URL').fill(`${origin}/v1`);
  await popup.getByLabel('API key', { exact: false }).fill(key);
  await popup.getByLabel('Model IDs').fill('mock-model, second-model');
  await popup.getByRole('button', { name: 'Save provider', exact: true }).click();
  await expect(popup.getByText('Provider saved.', { exact: false })).toBeVisible();
  await expect(popup.getByLabel('Active model')).toHaveValue('mock-model');
  await popup.getByLabel('Active model').selectOption('second-model');
  await popup.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(popup.getByText('Replace key', { exact: true })).toBeVisible();
  expect(await popup.locator('body').textContent()).not.toContain(key);
  expect(await popup.locator('input').evaluateAll(inputs => inputs.map(input =>
    input instanceof HTMLInputElement ? input.value : ''))).not.toContain(key);
  await popup.getByLabel('Provider name').fill('Local edited');
  await popup.getByRole('button', { name: 'Save provider', exact: true }).click();
  const prompt = popup.getByLabel('Custom Explanation Prompt');
  await prompt.fill('Explain briefly with an example.');
  await popup.getByRole('button', { name: 'Save prompt', exact: true }).click();
  await expect(popup.getByText('Explanation prompt saved.', { exact: true })).toBeVisible();
  await popup.emulateMedia({ colorScheme: 'dark' });
  await popup.screenshot({ path: 'test-results/popup-dark.png', fullPage: true });
  await popup.emulateMedia({ colorScheme: 'light' });
  await popup.screenshot({ path: 'test-results/popup-light.png', fullPage: true });
  await popup.close();

  const page = await context.newPage();
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') pageErrors.push(message.text()); });
  await page.goto(origin);
  const count = requests.length;
  await selectParagraph(page);
  const host = page.locator('[data-ai-selection-explainer]');
  await expect(host).toBeVisible();
  await expect.poll(() => readClosedCard(page)).toContain('Explaining selection');
  await expect.poll(() => requests.length).toBe(count + 1);
  await expect.poll(() => readClosedCard(page)).toContain('A broad ability');
  expect(requests.at(-1)).toEqual({ authorization: `Bearer ${key}`, body: {
    model: 'second-model', stream: false,
    messages: [{ role: 'system', content: 'Explain briefly with an example.' },
      { role: 'user', content: 'Artificial General Intelligence' }],
  } });
  expect(await page.content()).not.toContain(key);
  expect(await host.evaluate(node => node.shadowRoot)).toBeNull();
  await page.screenshot({ path: 'test-results/selection-light.png' });
  expect(await host.evaluate(node => getComputedStyle(node).getPropertyValue('--ase-surface').trim())).toBe('#ffffff');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: 'test-results/selection-dark.png' });
  expect(await host.evaluate(node => getComputedStyle(node).getPropertyValue('--ase-surface').trim())).toBe('#22252d');
  await page.keyboard.press('Escape');
  await expect(host).toBeHidden();
  await selectParagraph(page, 'second');
  await expect(host).toBeVisible();
  await expect.poll(() => readClosedCard(page)).toContain('A broad ability');
  await page.keyboard.press('Escape');
  const beforeInput = requests.length;
  await page.getByLabel('Sensitive input').focus();
  await page.getByLabel('Sensitive input').selectText();
  await page.keyboard.press('Shift');
  await expect(host).toBeHidden();
  expect(requests.length).toBe(beforeInput);
  expect(pageErrors).toEqual([]);

  const reopened = await openPopup();
  await expect(reopened.getByLabel('Active model')).toHaveValue('second-model');
  await expect(reopened.getByLabel('Custom Explanation Prompt')).toHaveValue('Explain briefly with an example.');
  await reopened.getByRole('button', { name: 'Find models', exact: true }).click();
  await expect(reopened.getByLabel('Active model').getByRole('option', { name: 'discovered-model' })).toHaveCount(1);
  await reopened.getByRole('button', { name: 'Reset to default', exact: true }).click();
  await expect(reopened.getByLabel('Custom Explanation Prompt')).toHaveValue(/^Explain the selected text clearly/);
  await reopened.getByRole('button', { name: 'Delete Local edited', exact: true }).click();
  await expect(reopened.getByText('A little context, instantly.', { exact: true })).toBeVisible();
});

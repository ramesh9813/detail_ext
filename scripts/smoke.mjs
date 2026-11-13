// Offline integration checks against the actual built service worker.
import assert from 'node:assert/strict';
import { setTimeout, clearTimeout } from 'node:timers';
import { webcrypto as crypto } from 'node:crypto';
const { Response } = globalThis;
const provider = {
  id: 'mock', name: 'Local mock', baseUrl: 'https://provider.example/v1',
  apiKey: 'dummy-smoke-key', models: ['mock-model'], selectedModel: 'mock-model',
};
let settings = { providers: [provider], activeProviderId: 'mock', customPrompt: 'Explain simply.', enabled: true };
let listener;
let trustedStorage = false;
let permission = true;
let calls = [];
let respond = () => new Response(JSON.stringify({ choices: [{ message: { content: 'A clear explanation.' } }] }));
globalThis.chrome = {
  runtime: { id: 'smoke', getURL: path => `chrome-extension://smoke/${path}`,
    onMessage: { addListener: callback => { listener = callback; } } },
  storage: { local: {
    setAccessLevel: async options => { trustedStorage = options.accessLevel === 'TRUSTED_CONTEXTS'; },
    get: async () => { assert.ok(trustedStorage); return { settings }; },
  }, onChanged: { addListener: () => {} } },
  permissions: { contains: async () => permission },
  tabs: { query: async () => [], sendMessage: async () => {} },
};
globalThis.fetch = async (url, options) => {
  calls.push({ url, options });
  return respond(url, options);
};
await import('../dist/background.js');
let tab = 1;
async function send(message, privileged = false) {
  const sender = privileged ? { id: 'smoke', url: 'chrome-extension://smoke/src/popup/index.html' }
    : { id: 'smoke', url: 'https://page.example/', tab: { id: tab++ }, frameId: 0 };
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Worker did not respond')), 3000);
    const handled = listener(message, sender, result => { clearTimeout(timer); resolve(result); });
    if (!handled) { clearTimeout(timer); resolve(undefined); }
  });
}
let count = 0;
async function check(name, action) {
  await action(); count++;
  console.log(`PASS ${name}`);
}
const explain = () => send({ type: 'EXPLAIN_TEXT', requestId: crypto.randomUUID(), selectedText: 'Artificial General Intelligence' });
await check('safe status excludes provider secrets', async () => {
  assert.deepEqual(await send({ type: 'GET_SETTINGS_STATUS' }), {
    status: { enabled: true, configured: true, providerName: 'Local mock', model: 'mock-model' },
  });
});
await check('authenticated request uses only selected text and configured prompt', async () => {
  const result = await explain();
  assert.equal(result.content, 'A clear explanation.');
  assert.ok(!JSON.stringify(result).includes(provider.apiKey));
  const { url, options } = calls.at(-1);
  assert.equal(url, 'https://provider.example/v1/chat/completions');
  assert.equal(options.headers.Authorization, `Bearer ${provider.apiKey}`);
  assert.deepEqual(JSON.parse(options.body), {
    model: 'mock-model', stream: false,
    messages: [{ role: 'system', content: 'Explain simply.' }, { role: 'user', content: 'Artificial General Intelligence' }],
  });
});
await check('only three enabled prompts of five reach the provider', async () => {
  settings.prompts = Array.from({ length: 5 }, (_, index) => ({
    id: String(index), name: `Task ${index}`, content: `Instruction ${index}`, enabled: index % 2 === 0,
  }));
  await explain();
  const instruction = JSON.parse(calls.at(-1).options.body).messages[0].content;
  for (const index of [0, 2, 4]) assert.ok(instruction.includes(`Instruction ${index}`));
  for (const index of [1, 3]) assert.ok(!instruction.includes(`Instruction ${index}`));
  delete settings.prompts;
});
await check('content scripts cannot discover models', async () => {
  const before = calls.length;
  assert.match((await send({ type: 'DISCOVER_MODELS', providerId: 'mock' })).error, /only in extension settings/);
  assert.equal(calls.length, before);
});
await check('settings can discover manually selectable models', async () => {
  respond = () => new Response(JSON.stringify({ data: [{ id: 'one' }, { id: 'one' }, { id: 'two' }] }));
  assert.deepEqual((await send({ type: 'DISCOVER_MODELS', providerId: 'mock' }, true)).models, ['one', 'two']);
});
for (const [status, pattern] of [[401, /Authentication/], [403, /denied/], [404, /model|endpoint/], [429, /rate limit/], [500, /HTTP 500/]]) {
  await check(`HTTP ${status} returns a sanitized error without retries`, async () => {
    respond = () => new Response(provider.apiKey, { status });
    const before = calls.length;
    const result = await explain();
    assert.match(result.error, pattern);
    assert.ok(!result.error.includes(provider.apiKey));
    assert.equal(calls.length, before + 1);
  });
}
for (const [body, pattern] of [['not json', /invalid JSON/], ['{}', /unsupported/], ['{"choices":[{"message":{"content":""}}]}', /empty explanation/]]) {
  await check(`malformed response: ${pattern}`, async () => {
    respond = () => new Response(body);
    assert.match((await explain()).error, pattern);
  });
}
await check('network exceptions never expose provider credentials', async () => {
  respond = () => { throw new Error(provider.apiKey); };
  const result = await explain();
  assert.match(result.error, /Cannot reach/);
  assert.ok(!result.error.includes(provider.apiKey));
});
await check('revoked origin permission blocks network access', async () => {
  permission = false;
  const before = calls.length;
  assert.match((await explain()).error, /permission|access/i);
  assert.equal(calls.length, before);
  permission = true;
});
await check('disabled and unconfigured settings block network access', async () => {
  const before = calls.length;
  settings.enabled = false;
  assert.match((await explain()).error, /disabled/);
  settings = { ...settings, enabled: true, activeProviderId: null };
  assert.match((await explain()).error, /provider/);
  assert.equal(calls.length, before);
});
await check('invalid or empty messages are rejected', async () => {
  assert.equal(await send({ type: 'FETCH', url: 'https://arbitrary.example/' }), undefined);
  assert.equal(await send({ type: 'EXPLAIN_TEXT', requestId: 'empty', selectedText: ' ' }), undefined);
});
console.log(`${count} built-worker smoke checks passed.`);

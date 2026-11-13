import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '../storage/defaults';
import type { ExtensionSettings } from '../shared/types';

const mocks = vi.hoisted(() => ({ read: vi.fn(), status: vi.fn(), explain: vi.fn(), models: vi.fn() }));
vi.mock('../storage/settings-store', () => ({ readSettings: mocks.read, getStatus: mocks.status }));
vi.mock('../providers/openai-compatible', () => ({ explain: mocks.explain }));
vi.mock('../providers/model-discovery', () => ({ discoverModels: mocks.models }));
import { handleMessage, requests } from './message-handler';

let settings: ExtensionSettings;
const page = { id: 'ours', url: 'https://example.test', tab: { id: 5 }, frameId: 0 } as chrome.runtime.MessageSender;
const popup = { id: 'ours', url: 'chrome-extension://ours/src/popup/index.html' };

beforeEach(() => {
  vi.clearAllMocks();
  requests.cancelAll();
  vi.stubGlobal('chrome', { runtime: { id: 'ours', getURL: (path: string) => `chrome-extension://ours/${path}` } });
  settings = defaultSettings();
  mocks.read.mockImplementation(async () => settings);
  mocks.status.mockResolvedValue({ enabled: true, configured: false });
  mocks.explain.mockResolvedValue('A clear explanation.');
  mocks.models.mockResolvedValue(['test-model']);
});

function configure() {
  settings.providers = [{ id: 'p', name: 'Provider', baseUrl: 'https://api.example.test/v1',
    apiKey: 'private-key', selectedModel: 'test-model', models: ['test-model'] }];
  settings.activeProviderId = 'p';
}

describe('background flow', () => {
  it('returns configuration status without credentials', async () => {
    configure();
    const response = await handleMessage({ type: 'GET_SETTINGS_STATUS' }, page);
    expect(response).toEqual({ status: { enabled: true, configured: false } });
    expect(JSON.stringify(response)).not.toContain('private-key');
  });

  it('does not submit when missing configuration or disabled', async () => {
    const message = { type: 'EXPLAIN_TEXT', requestId: 'r', selectedText: 'hello' } as const;
    expect((await handleMessage(message, page)).error).toContain('provider');
    configure(); settings.enabled = false;
    expect((await handleMessage(message, page)).error).toContain('disabled');
    expect(mocks.explain).not.toHaveBeenCalled();
  });

  it('explains using stored provider and prompt and sends no credentials back', async () => {
    configure(); settings.customPrompt = 'Explain simply.';
    const result = await handleMessage({ type: 'EXPLAIN_TEXT', requestId: 'success', selectedText: 'hello' }, page);
    expect(mocks.explain).toHaveBeenCalledWith(settings.providers[0], 'hello', 'Explain simply.', expect.any(AbortSignal));
    expect(result).toEqual({ requestId: 'success', content: 'A clear explanation.' });
    expect(JSON.stringify(result)).not.toContain('private-key');
  });

  it('does not allow a webpage to discover models or test providers', async () => {
    configure();
    expect((await handleMessage({ type: 'TEST_PROVIDER', providerId: 'p' }, page)).error).toContain('settings');
    expect((await handleMessage({ type: 'DISCOVER_MODELS', providerId: 'p' }, page)).error).toContain('settings');
    expect(mocks.models).not.toHaveBeenCalled();
    expect(mocks.explain).not.toHaveBeenCalled();
  });

  it('allows saved providers in the popup to discover models and test selected model', async () => {
    configure();
    expect(await handleMessage({ type: 'DISCOVER_MODELS', providerId: 'p' }, popup)).toEqual({ models: ['test-model'] });
    expect((await handleMessage({ type: 'TEST_PROVIDER', providerId: 'p' }, popup)).content).toContain('successful');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from './defaults';
import { getStatus, normalizeSettings, readSettings, saveSettings, subscribeSettings } from './settings-store';

describe('protected local settings', () => {
  let data: Record<string, unknown>;
  const setAccessLevel = vi.fn(async () => undefined);
  const addListener = vi.fn();
  const removeListener = vi.fn();
  beforeEach(() => {
    data = {};
    vi.clearAllMocks();
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          setAccessLevel,
          get: vi.fn(async () => data),
          set: vi.fn(async (value: Record<string, unknown>) => { data = value; }),
        },
        onChanged: { addListener, removeListener },
      },
    });
  });
  it('defaults safely when storage is absent or malformed', async () => {
    expect(await readSettings()).toEqual(defaultSettings());
    expect(normalizeSettings({ providers: [{ apiKey: 'invalid' }], activeProviderId: 'missing' }))
      .toEqual(defaultSettings());
  });
  it('persists locally and restricts access to trusted extension contexts', async () => {
    const settings = { ...defaultSettings(), enabled: false, customPrompt: 'Explain simply.' };
    await saveSettings(settings);
    expect(await readSettings()).toEqual(settings);
    expect(setAccessLevel).toHaveBeenCalledWith({ accessLevel: 'TRUSTED_CONTEXTS' });
  });
  it('returns only safe configuration status without any provider secrets', async () => {
    await saveSettings({
      ...defaultSettings(), activeProviderId: 'one', providers: [{
        id: 'one', name: 'Provider', baseUrl: 'https://example.com/v1', apiKey: 'secret',
        models: ['model'], selectedModel: 'model',
      }],
    });
    expect(await getStatus()).toEqual({ enabled: true, configured: true, providerName: 'Provider', model: 'model' });
  });
  it('notifies for local settings changes only and removes the listener', () => {
    const callback = vi.fn();
    const unsubscribe = subscribeSettings(callback);
    const listener = addListener.mock.calls[0][0] as (
      changes: Record<string, unknown>, area: string,
    ) => void;
    listener({ other: {} }, 'local');
    listener({ settings: {} }, 'sync');
    expect(callback).not.toHaveBeenCalled();
    listener({ settings: {} }, 'local');
    expect(callback).toHaveBeenCalledOnce();
    unsubscribe();
    expect(removeListener).toHaveBeenCalledWith(listener);
  });
});

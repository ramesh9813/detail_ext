// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ExtensionSettings } from '../shared/types';
import { defaultSettings } from '../storage/defaults';
import { readSettings, saveSettings, subscribeSettings } from '../storage/settings-store';
import { App } from './App';

vi.mock('../storage/settings-store', () => ({
  readSettings: vi.fn(), saveSettings: vi.fn(), subscribeSettings: vi.fn(),
}));
let store: ExtensionSettings;
let container: HTMLDivElement;
let root: Root;
let refresh: () => void;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  store = { ...defaultSettings(), activeProviderId: 'first', providers: [{
    id: 'first', name: 'Personal provider', baseUrl: 'https://example.com/v1', apiKey: '',
    models: ['first-model', 'next-model'], selectedModel: 'first-model',
  }] };
  vi.mocked(readSettings).mockImplementation(async () => structuredClone(store));
  vi.mocked(saveSettings).mockImplementation(async (value) => { store = structuredClone(value); });
  vi.mocked(subscribeSettings).mockImplementation((listener) => { refresh = listener; return vi.fn(); });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

it('merges rapid model and enabled changes into the latest stored settings', async () => {
  await act(async () => root.render(<App />));
  await act(async () => {
    const model = container.querySelectorAll('select')[1];
    model.value = 'next-model'; model.dispatchEvent(new Event('change', { bubbles: true }));
    container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
  });
  expect(store.providers[0].selectedModel).toBe('next-model');
  expect(store.enabled).toBe(false);
  expect(saveSettings).toHaveBeenCalledTimes(2);
});

it('ignores an old initial read when a newer subscription refresh has completed', async () => {
  let resolveInitial!: (settings: ExtensionSettings) => void;
  const old = structuredClone(store);
  vi.mocked(readSettings).mockImplementationOnce(() => new Promise((resolve) => { resolveInitial = resolve; }));
  await act(async () => root.render(<App />));
  store.enabled = false;
  await act(async () => refresh());
  expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(false);
  await act(async () => resolveInitial(old));
  expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(false);
});

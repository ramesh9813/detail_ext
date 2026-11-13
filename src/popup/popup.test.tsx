// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AIProvider } from '../shared/types';
import { defaultSettings } from '../storage/defaults';
import { ProviderForm } from './components/ProviderForm';
import { ActiveConfiguration } from './components/ActiveConfiguration';
import { PromptEditor } from './components/PromptEditor';
import theme from './styles/popup.css?inline';

const provider: AIProvider = {
  id: 'first', name: 'Personal provider', baseUrl: 'https://example.com/v1/',
  apiKey: 'private-secret-sentinel', models: ['manual-model', 'other-model'], selectedModel: 'manual-model',
};
let root: Root;
let container: HTMLDivElement;
const requestPermission = vi.fn();

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal('chrome', { permissions: { request: requestPermission } });
  requestPermission.mockReset().mockResolvedValue(true);
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

async function submit() {
  await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
}

describe('settings popup', () => {
  it('never renders saved API keys, including in password input values', () => {
    const html = renderToStaticMarkup(<ProviderForm provider={provider} onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(html).not.toContain(provider.apiKey);
    expect(html).toContain('Replace key');
    expect(html).not.toContain('type="password"');
  });

  it('requests provider permission, normalizes the root and preserves manual models and saved key', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    await act(async () => root.render(<ProviderForm provider={provider} onSave={onSave} onCancel={vi.fn()} />));
    await submit();
    expect(requestPermission).toHaveBeenCalledWith({ origins: ['https://example.com/*'] });
    expect(onSave).toHaveBeenCalledWith({ ...provider, baseUrl: 'https://example.com/v1' }, true);
    expect(container.innerHTML).not.toContain(provider.apiKey);
  });

  it('does not save when provider permission is declined', async () => {
    requestPermission.mockResolvedValue(false);
    const onSave = vi.fn();
    await act(async () => root.render(<ProviderForm provider={provider} onSave={onSave} onCancel={vi.fn()} />));
    await submit();
    expect(onSave).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Allow access');
  });

  it('requires a provider name before requesting permission', async () => {
    await act(async () => root.render(<ProviderForm onSave={vi.fn()} onCancel={vi.fn()} />));
    await submit();
    expect(requestPermission).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('provider name');
  });

  it('removes authentication only through explicit key replacement', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    await act(async () => root.render(<ProviderForm provider={provider} onSave={onSave} onCancel={vi.fn()} />));
    const replace = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Replace key')!;
    expect(replace.getAttribute('aria-label')).toBe('Replace key');
    await act(async () => replace.click());
    expect(container.querySelector('input[type="password"]')?.getAttribute('aria-label')).toBe('API key');
    expect(container.querySelector('input[type="password"]')?.getAttribute('value')).toBe('');
    await submit();
    expect(onSave.mock.calls[0][0].apiKey).toBe('');
  });

  it('shows active model and handles provider/model selection and pause', async () => {
    const onProvider = vi.fn(); const onModel = vi.fn(); const onEnabled = vi.fn();
    const settings = { ...defaultSettings(), providers: [provider], activeProviderId: provider.id };
    await act(async () => root.render(<ActiveConfiguration settings={settings} active={provider} onProvider={onProvider} onModel={onModel} onEnabled={onEnabled} />));
    const selects = container.querySelectorAll('select');
    await act(async () => { selects[1].value = 'other-model'; selects[1].dispatchEvent(new Event('change', { bubbles: true })); });
    expect(onModel).toHaveBeenCalledWith('other-model');
    await act(async () => { selects[0].dispatchEvent(new Event('change', { bubbles: true })); });
    expect(onProvider).toHaveBeenCalledWith(provider.id);
    await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    expect(onEnabled).toHaveBeenCalledWith(false);
    expect(container.textContent).toContain('Ready');
  });

  it('provides prompt saving and default restoration', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined); const onReset = vi.fn().mockResolvedValue(undefined);
    await act(async () => root.render(<PromptEditor prompt="Explain in Nepali." onSave={onSave} onReset={onReset} />));
    const buttons = container.querySelectorAll('button');
    await act(async () => buttons[0].click());
    expect(onSave).toHaveBeenCalledWith('Explain in Nepali.');
    await act(async () => buttons[1].click());
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('includes automatic light/dark themes and reduced-motion support', () => {
    expect(theme).toContain('prefers-color-scheme: dark');
    expect(theme).toContain('--surface: #fff');
    expect(theme).toContain('prefers-reduced-motion');
  });
});

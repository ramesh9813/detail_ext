import { defaultSettings } from './defaults';
import type { AIProvider, ExtensionSettings, SettingsStatus } from '../shared/types';

const SETTINGS_KEY = 'settings';

/** Content scripts cannot read the API keys held by this storage area. */
export async function initializeStorage(): Promise<void> {
  await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
}

function isProvider(value: unknown): value is AIProvider {
  if (!value || typeof value !== 'object') return false;
  const provider = value as Record<string, unknown>;
  return ['id', 'name', 'baseUrl', 'apiKey', 'selectedModel'].every(
    (key) => typeof provider[key] === 'string',
  ) && Array.isArray(provider.models)
    && provider.models.every((model: unknown) => typeof model === 'string');
}

export function normalizeSettings(value: unknown): ExtensionSettings {
  const defaults = defaultSettings();
  if (!value || typeof value !== 'object') return defaults;
  const settings = value as Record<string, unknown>;
  const providers = Array.isArray(settings.providers)
    ? settings.providers.filter(isProvider) : [];
  const activeProviderId = typeof settings.activeProviderId === 'string'
    && providers.some((provider) => provider.id === settings.activeProviderId)
    ? settings.activeProviderId : null;
  return {
    providers,
    activeProviderId,
    customPrompt: typeof settings.customPrompt === 'string' && settings.customPrompt.trim()
      ? settings.customPrompt : defaults.customPrompt,
    enabled: typeof settings.enabled === 'boolean' ? settings.enabled : defaults.enabled,
  };
}

export async function readSettings(): Promise<ExtensionSettings> {
  await initializeStorage();
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return normalizeSettings(stored[SETTINGS_KEY]);
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await initializeStorage();
  await chrome.storage.local.set({ [SETTINGS_KEY]: normalizeSettings(settings) });
}

export async function getStatus(): Promise<SettingsStatus> {
  const settings = await readSettings();
  const active = settings.providers.find((provider) => provider.id === settings.activeProviderId);
  return {
    enabled: settings.enabled, configured: Boolean(active?.selectedModel && active.baseUrl),
    ...(active ? { providerName: active.name, model: active.selectedModel } : {}),
  };
}

export function subscribeSettings(listener: () => void): () => void {
  const onChange = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && SETTINGS_KEY in changes) listener();
  };
  chrome.storage.onChanged.a
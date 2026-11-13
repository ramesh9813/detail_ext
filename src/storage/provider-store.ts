import { DEFAULT_PROMPT } from '../shared/constants';
import type { AIProvider, ExtensionSettings } from '../shared/types';
import { normalizeBaseUrl } from '../providers/url';

function validateProvider(settings: ExtensionSettings, provider: AIProvider): AIProvider {
  const name = provider.name.trim();
  const id = provider.id.trim();
  const selectedModel = provider.selectedModel.trim();
  if (!id) throw new Error('Provider ID is required.');
  if (!name) throw new Error('Enter a provider name.');
  if (!provider.baseUrl.trim()) throw new Error('Enter an API base URL.');
  if (!selectedModel) throw new Error('Enter a model ID.');
  if (settings.providers.some((item) => item.id !== id
    && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    throw new Error('A provider with this name already exists.');
  }
  const models = [...new Set([...provider.models.map((model) => model.trim()), selectedModel])]
    .filter(Boolean);
  return { ...provider, id, name, baseUrl: normalizeBaseUrl(provider.baseUrl), selectedModel, models };
}

/** Existing IDs are edited, new IDs are appended without changing other providers. */
export function upsertProvider(settings: ExtensionSettings, provider: AIProvider): ExtensionSettings {
  const normalized = validateProvider(settings, provider);
  const exists = settings.providers.some((item) => item.id === normalized.id);
  return {
    ...settings,
    providers: exists
      ? settings.providers.map((item) => item.id === normalized.id ? normalized : item)
      : [...settings.providers, normalized],
    activeProviderId: settings.activeProviderId ?? normalized.id,
  };
}

export function deleteProvider(settings: ExtensionSettings, id: string): ExtensionSettings {
  const providers = settings.providers.filter((provider) => provider.id !== id);
  return {
    ...settings,
    providers,
    activeProviderId: settings.activeProviderId === id
      ? providers[0]?.id ?? null : settings.activeProviderId,
  };
}

export function selectProvider(settings: ExtensionSettings, id: string | null): ExtensionSettings {
  if (id !== null && !settings.providers.some((provider) => provider.id === id)) {
    throw new Error('Select an existing provider.');
  }
  return { ...settings, activeProviderId: id };
}

export function selectModel(
  settings: ExtensionSettings, providerId: string, modelId: string,
): ExtensionSettings {
  const provider = settings.providers.find((item) => item.id === providerId);
  if (!provider) throw new Error('Select a provider first.');
  return upsertProvider(settings, { ...provider, selectedModel: modelId });
}

export function savePrompt(settings: ExtensionSettings, prompt: string): ExtensionSettings {
  return { ...settings, customPrompt: prompt.trim() ? prompt : DEFAULT_PROMPT };
}

export function resetPrompt(settings: ExtensionSettings): ExtensionSettings {
  return { ...settings, customPrompt: DEFAULT_PROMPT };
}

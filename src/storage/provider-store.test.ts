import { describe, expect, it } from 'vitest';
import { defaultSettings } from './defaults';
import { DEFAULT_PROMPT } from '../shared/constants';
import { deleteProvider, resetPrompt, savePrompt, selectModel, selectProvider, upsertProvider } from './provider-store';
import type { AIProvider } from '../shared/types';

const provider = (id = 'one', name = 'Local AI'): AIProvider => ({
  id, name, baseUrl: 'http://localhost:1234/v1', apiKey: '',
  models: ['first-model'], selectedModel: 'first-model',
});

describe('provider configuration', () => {
  it('creates a provider and selects the first configuration', () => {
    const settings = upsertProvider(defaultSettings(), provider());
    expect(settings.providers).toEqual([provider()]);
    expect(settings.activeProviderId).toBe('one');
  });
  it('edits an existing provider without duplicating it', () => {
    const original = upsertProvider(defaultSettings(), provider());
    const edited = upsertProvider(original, { ...provider(), name: 'Renamed', apiKey: 'new-key' });
    expect(edited.providers).toHaveLength(1);
    expect(edited.providers[0].apiKey).toBe('new-key');
    expect(original.providers[0].name).toBe('Local AI');
  });
  it('deletes the active provider and falls back to another saved provider', () => {
    let settings = upsertProvider(defaultSettings(), provider());
    settings = upsertProvider(settings, provider('two', 'Second'));
    settings = deleteProvider(settings, 'one');
    expect(settings.activeProviderId).toBe('two');
    expect(deleteProvider(settings, 'two').activeProviderId).toBeNull();
  });
  it('selects a saved provider and rejects an unknown provider', () => {
    const settings = upsertProvider(defaultSettings(), provider());
    expect(selectProvider(settings, 'one').activeProviderId).toBe('one');
    expect(() => selectProvider(settings, 'unknown')).toThrow('existing provider');
  });
  it('accepts manually entered model IDs and preserves previous models', () => {
    const settings = upsertProvider(defaultSettings(), provider());
    const changed = selectModel(settings, 'one', 'new/manual-model');
    expect(changed.providers[0].selectedModel).toBe('new/manual-model');
    expect(changed.providers[0].models).toEqual(['first-model', 'new/manual-model']);
  });
  it('trims and deduplicates models', () => {
    const settings = upsertProvider(defaultSettings(), {
      ...provider(), models: [' first-model ', '', 'first-model'],
    });
    expect(settings.providers[0].models).toEqual(['first-model']);
  });
  it('rejects case-insensitive duplicate provider names', () => {
    const settings = upsertProvider(defaultSettings(), provider());
    expect(() => upsertProvider(settings, provider('two', 'local ai'))).toThrow('already exists');
  });
  it.each(['id', 'name', 'baseUrl', 'selectedModel'] as const)('requires %s', (field) => {
    expect(() => upsertProvider(defaultSettings(), { ...provider(), [field]: ' ' })).toThrow();
  });
  it('saves custom prompts exactly and resets to default', () => {
    const prompt = '  Translate into Nepali.\nKeep this exact formatting.  ';
    const settings = savePrompt(defaultSettings(), prompt);
    expect(settings.customPrompt).toBe(prompt);
    expect(resetPrompt(settings).customPrompt).toBe(DEFAULT_PROMPT);
    expect(savePrompt(settings, '  ').customPrompt).toBe(DEFAULT_PROMPT);
  });
});

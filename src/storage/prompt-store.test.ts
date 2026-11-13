import { describe, expect, it } from 'vitest';
import { defaultSettings } from './defaults';
import { buildExplanationPrompt, deletePrompt, normalizePrompts, togglePrompt, upsertPrompt } from './prompt-store';
import type { ExtensionSettings } from '../shared/types';
import { DEFAULT_PROMPT } from '../shared/constants';

describe('multiple custom prompts', () => {
  it('migrates existing custom text without altering it', () => {
    const content = ' Translate into Nepali.\n Give examples. ';
    expect(normalizePrompts(undefined, content)[0].content).toBe(content);
  });
  it('applies only the selected three of five prompts in order', () => {
    let settings: ExtensionSettings = { ...defaultSettings(), prompts: [] };
    for (let index = 0; index < 5; index++) {
      settings = upsertPrompt(settings, { id: String(index), name: `Task ${index}`, content: `Instruction ${index}`, enabled: index % 2 === 0 });
    }
    const prompt = buildExplanationPrompt(settings);
    for (const index of [0, 2, 4]) expect(prompt).toContain(`Instruction ${index}`);
    for (const index of [1, 3]) expect(prompt).not.toContain(`Instruction ${index}`);
    settings = togglePrompt(settings, '1', true);
    expect(buildExplanationPrompt(settings)).toContain('Instruction 1');
    expect(deletePrompt(settings, '1').prompts).toHaveLength(4);
  });
  it('preserves a single instruction exactly and defaults when all disabled', () => {
    const settings = upsertPrompt({ ...defaultSettings(), prompts: [] }, {
      id: 'one', name: 'Translate', content: ' Translate exactly. ', enabled: true,
    });
    expect(buildExplanationPrompt(settings)).toBe(' Translate exactly. ');
    expect(buildExplanationPrompt(togglePrompt(settings, 'one', false))).toBe(DEFAULT_PROMPT);
  });
});

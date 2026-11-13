import { DEFAULT_PROMPT } from '../shared/constants';
import type { ExtensionSettings } from '../shared/types';
export const defaultSettings = (): ExtensionSettings => ({
  providers: [], activeProviderId: null, customPrompt: DEFAULT_PROMPT, enabled: true,
  prompts: [{ id: 'default', name: 'Explain', content: DEFAULT_PROMPT, enabled: true }],
});

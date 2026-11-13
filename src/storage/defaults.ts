import { DEFAULT_PROMPT } from '../shared/constants';
import type { ExtensionSettings } from '../shared/types';
export const defaultSettings = (): ExtensionSettings => ({
  providers: [], activeProviderId: null, customPrompt: DEFAULT_PROMPT, enabled: true,
});

import { DEFAULT_PROMPT, MAX_SELECTION_LENGTH } from '../shared/constants';
import type { AIProvider } from '../shared/types';
import { providerRequest } from './request';
import { parseExplanation } from './response-parser';

export async function explain(
  provider: AIProvider,
  text: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<string> {
  if (!provider.selectedModel.trim()) throw new Error('Choose a model in the extension settings first.');
  if (!text.trim()) throw new Error('Select some text to explain.');
  if (text.length > MAX_SELECTION_LENGTH) {
    throw new Error(`Select a shorter passage (up to ${MAX_SELECTION_LENGTH.toLocaleString()} characters).`);
  }
  const response = await providerRequest(provider, 'chat/completions', {
    model: provider.selectedModel,
    messages: [
      { role: 'system', content: prompt.trim() ? prompt : DEFAULT_PROMPT },
      { role: 'user', content: text },
    ],
    stream: false,
  }, signal);
  return parseExplanation(response);
}

import type { AIProvider } from '../shared/types';
import { providerRequest } from './request';
import { parseModels } from './response-parser';

export async function discoverModels(provider: AIProvider): Promise<string[]> {
  return parseModels(await providerRequest(provider, 'models'));
}

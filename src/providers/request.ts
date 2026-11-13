import { REQUEST_TIMEOUT_MS } from '../shared/constants';
import type { AIProvider } from '../shared/types';
import { normalizeBaseUrl, requireProviderPermission } from './provider-service';

function responseError(status: number, discovery: boolean): Error {
  if (status === 401) return new Error('Authentication failed. Check or replace the provider API key.');
  if (status === 403) return new Error('The provider denied access. Check your key and model permissions.');
  if (status === 429) return new Error('The provider rate limit or quota was reached. Try again later.');
  if (status === 404 && !discovery) {
    return new Error('The model or API endpoint was not found. Check the model ID and API base URL.');
  }
  if (discovery) return new Error('Model discovery is unavailable. Enter model IDs manually.');
  return new Error(`The provider request failed (HTTP ${status}). Check your provider settings.`);
}

export async function providerRequest(
  provider: AIProvider,
  endpoint: 'chat/completions' | 'models',
  body?: unknown,
  externalSignal?: AbortSignal,
): Promise<unknown> {
  const baseUrl = normalizeBaseUrl(provider.baseUrl);
  await requireProviderPermission(baseUrl);
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  externalSignal?.addEventListener('abort', cancel, { once: true });
  if (externalSignal?.aborted) controller.abort();
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (provider.apiKey.trim()) headers.Authorization = `Bearer ${provider.apiKey.trim()}`;
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/${endpoint}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
      });
    } catch {
      if (timedOut) throw new Error('The provider timed out. Try again when it is available.');
      if (controller.signal.aborted) throw new Error('The explanation request was cancelled.');
      throw new Error('Cannot reach the provider. Check its URL, network connection, and availability.');
    }
    if (!response.ok) throw responseError(response.status, endpoint === 'models');
    try {
      return await response.json() as unknown;
    } catch {
      if (timedOut) throw new Error('The provider timed out. Try again when it is available.');
      if (controller.signal.aborted) throw new Error('The explanation request was cancelled.');
      throw new Error('The provider returned invalid JSON. Check that this is an OpenAI-compatible endpoint.');
    }
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', cancel);
  }
}

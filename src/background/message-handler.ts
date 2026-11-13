import type { ExtensionMessage, MessageResponse } from '../shared/types';
import { getStatus, readSettings } from '../storage/settings-store';
import { buildExplanationPrompt } from '../storage/prompt-store';
import { explain } from '../providers/openai-compatible';
import { discoverModels } from '../providers/model-discovery';
import { isPageSender, isSettingsSender } from '../messaging/message-validation';
import { RequestManager } from './request-manager';

export const requests = new RequestManager();

function ownerOf(sender: chrome.runtime.MessageSender): string {
  return `${sender.tab?.id}:${sender.frameId ?? 0}`;
}

export async function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
): Promise<MessageResponse> {
  if (message.type === 'GET_SETTINGS_STATUS') return { status: await getStatus() };
  if (message.type === 'TEST_PROVIDER' || message.type === 'DISCOVER_MODELS') {
    if (!isSettingsSender(sender)) return { error: 'This action is available only in extension settings.' };
    const settings = await readSettings();
    const provider = settings.providers.find((item) => item.id === message.providerId);
    if (!provider) return { error: 'Save a provider first.' };
    if (message.type === 'DISCOVER_MODELS') return { models: await discoverModels(provider) };
    await explain(provider, 'Reply with OK.', 'This is a connection test. Reply briefly.');
    return { content: 'Connection successful. The selected model responded.' };
  }
  if (!isPageSender(sender)) return { error: 'This action requires a supported webpage.' };
  const owner = ownerOf(sender);
  if (message.type === 'CANCEL_EXPLANATION') {
    requests.cancel(owner, message.requestId);
    return { requestId: message.requestId };
  }
  const { requestId, selectedText } = message;
  const controller = requests.begin(owner, requestId);
  try {
    const settings = await readSettings();
    if (controller.signal.aborted) return { requestId, error: 'The explanation request was cancelled.' };
    if (!settings.enabled) return { requestId, error: 'Automatic explanations are disabled.' };
    const provider = settings.providers.find((item) => item.id === settings.activeProviderId);
    if (!provider) return { requestId, error: 'Add and select a provider in the extension settings.' };
    if (!provider.selectedModel) return { requestId, error: 'Choose a model in the extension settings.' };
    const content = await explain(provider, selectedText, buildExplanationPrompt(settings), controller.signal);
    return { requestId, content };
  } finally {
    requests.finish(owner, requestId);
  }
}

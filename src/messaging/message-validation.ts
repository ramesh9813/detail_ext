import { MAX_SELECTION_LENGTH } from '../shared/constants';
import type { ExtensionMessage } from '../shared/types';

export function isExtensionMessage(value: unknown): value is ExtensionMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Record<string, unknown>;
  switch (message.type) {
    case 'GET_SETTINGS_STATUS': return true;
    case 'EXPLAIN_TEXT':
      return validId(message.requestId) && typeof message.selectedText === 'string'
        && message.selectedText.trim().length > 0
        && message.selectedText.length <= MAX_SELECTION_LENGTH;
    case 'CANCEL_EXPLANATION': return validId(message.requestId);
    case 'TEST_PROVIDER':
    case 'DISCOVER_MODELS': return validId(message.providerId);
    default: return false;
  }
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 160;
}

export function isTrustedSender(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === chrome.runtime.id;
}

export function isSettingsSender(sender: chrome.runtime.MessageSender): boolean {
  return isTrustedSender(sender)
    && sender.url === chrome.runtime.getURL('src/popup/index.html');
}

export function isPageSender(sender: chrome.runtime.MessageSender): boolean {
  return isTrustedSender(sender) && typeof sender.tab?.id === 'number'
    && /^https?:\/\//.test(sender.url ?? '');
}

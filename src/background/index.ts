import { initializeStorage, getStatus, subscribeSettings } from '../storage/settings-store';
import { isExtensionMessage, isTrustedSender } from '../messaging/message-validation';
import { handleMessage, requests } from './message-handler';
import type { MessageResponse } from '../shared/types';

const ready = initializeStorage();
// Attach a rejection handler immediately; individual requests still fail closed below.
void ready.catch(() => undefined);

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (!isTrustedSender(sender) || !isExtensionMessage(message)) return false;
  void ready.then(() => handleMessage(message, sender)).then(sendResponse).catch((error: unknown) => {
    const response: MessageResponse = {
      error: error instanceof Error ? error.message : 'The explanation could not be completed.',
    };
    if (message.type === 'EXPLAIN_TEXT') response.requestId = message.requestId;
    sendResponse(response);
  });
  return true;
});

subscribeSettings(() => {
  requests.cancelAll();
  void broadcastStatus().catch(() => undefined);
});

async function broadcastStatus(): Promise<void> {
  const status = await getStatus();
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map(async (tab) => {
    if (tab.id === undefined) return;
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_UPDATED', status });
    } catch {
      // Restricted pages and tabs opened before installation have no receiver.
    }
  }));
}


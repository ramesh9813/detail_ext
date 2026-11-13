import type { ExtensionMessage, MessageResponse } from '../shared/types';
export function sendMessage(message: ExtensionMessage): Promise<MessageResponse> {
  return new Promise(resolve => {
    let settled = false;
    const timeout = message.type === 'GET_SETTINGS_STATUS' || message.type === 'CANCEL_EXPLANATION'
      ? 5000 : 30000;
    const finish = (response: MessageResponse) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(response);
    };
    const timer = setTimeout(() => finish({
      error: 'The extension is not responding. Reload it and refresh this page.',
    }), timeout);
    try {
      // A single callback-based dispatch handles lastError on older MV3 Chrome too.
      // Never resend: an interrupted paid request may already have reached a provider.
      chrome.runtime.sendMessage(message, response => {
        const failed = chrome.runtime.lastError;
        finish(failed
          ? { error: 'The extension connection was interrupted. Refresh this page and try again.' }
          : response ?? { error: 'The extension restarted. Select the text again.' });
      });
    } catch {
      finish({ error: 'The extension connection was interrupted. Refresh this page and try again.' });
    }
  });
}

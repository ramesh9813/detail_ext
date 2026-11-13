import type { ExtensionMessage, MessageResponse } from '../shared/types';
export async function sendMessage(message: ExtensionMessage): Promise<MessageResponse> {
  try {
    const response: MessageResponse | undefined = await chrome.runtime.sendMessage(message);
    return response ?? { error: 'The extension restarted. Select the text again.' };
  } catch {
    return { error: 'The extension connection was interrupted. Refresh this page and try again.' };
  }
}

let pending: Promise<void> | undefined;

/** Opening the toolbar grants activeTab access, including pages open before installation. */
export function connectCurrentPage(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.scripting) return Promise.resolve();
  if (pending) return pending;
  pending = (async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined || !/^https?:\/\//.test(tab.url ?? '')) return;
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  })().catch(() => {
    // Chrome's protected pages cannot be injected. Ordinary pages can be refreshed.
  }).finally(() => { pending = undefined; });
  return pending;
}

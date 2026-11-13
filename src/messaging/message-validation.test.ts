import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isExtensionMessage, isPageSender, isSettingsSender, isTrustedSender } from './message-validation';

beforeEach(() => {
  vi.stubGlobal('chrome', { runtime: { id: 'ours', getURL: (path: string) => `chrome-extension://ours/${path}` } });
});

describe('message security', () => {
  it('rejects unknown, malformed, empty and excessive selections', () => {
    expect(isExtensionMessage(null)).toBe(false);
    expect(isExtensionMessage({ type: 'FETCH', url: 'https://evil.test' })).toBe(false);
    expect(isExtensionMessage({ type: 'EXPLAIN_TEXT', requestId: 'r', selectedText: ' ' })).toBe(false);
    expect(isExtensionMessage({ type: 'EXPLAIN_TEXT', requestId: 'r', selectedText: 'a'.repeat(20001) })).toBe(false);
    expect(isExtensionMessage({ type: 'EXPLAIN_TEXT', requestId: 'r', selectedText: 'hello' })).toBe(true);
  });

  it('restricts privileged provider operations to popup', () => {
    const page = { id: 'ours', url: 'https://example.test', tab: { id: 1 } } as chrome.runtime.MessageSender;
    expect(isSettingsSender(page)).toBe(false);
    expect(isPageSender(page)).toBe(true);
    expect(isSettingsSender({ id: 'ours', url: 'chrome-extension://ours/src/popup/index.html' })).toBe(true);
    expect(isTrustedSender({ id: 'another' })).toBe(false);
    expect(isPageSender({ id: 'ours', url: 'chrome://settings' })).toBe(false);
  });
});

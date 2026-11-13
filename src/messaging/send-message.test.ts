import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessageResponse } from '../shared/types';
import { sendMessage } from './send-message';

describe('native message lifecycle', () => {
  const dispatch = vi.fn();
  const runtime = { sendMessage: dispatch, lastError: undefined as { message?: string } | undefined };
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    runtime.lastError = undefined;
    vi.stubGlobal('chrome', { runtime });
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('returns a response and clears its timeout after one dispatch', async () => {
    dispatch.mockImplementation((_message, callback: (response: MessageResponse) => void) => {
      callback({ status: { enabled: true, configured: false } });
    });
    expect(await sendMessage({ type: 'GET_SETTINGS_STATUS' })).toEqual({ status: { enabled: true, configured: false } });
    expect(dispatch).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('consumes native lastError as a recoverable interruption without exposing it', async () => {
    dispatch.mockImplementation((_message, callback: (response?: MessageResponse) => void) => {
      runtime.lastError = { message: 'Native error details' };
      callback();
    });
    const result = await sendMessage({ type: 'GET_SETTINGS_STATUS' });
    expect(result.error).toContain('interrupted');
    expect(result.error).not.toContain('Native error details');
  });

  it('bounds an interrupted worker and never repeats a paid explanation', async () => {
    dispatch.mockImplementation(() => undefined);
    const request = sendMessage({ type: 'EXPLAIN_TEXT', requestId: 'r', selectedText: 'hello' });
    await vi.advanceTimersByTimeAsync(30000);
    expect((await request).error).toContain('not responding');
    expect(dispatch).toHaveBeenCalledOnce();
  });

  it('handles invalidated extension contexts and missing responses', async () => {
    dispatch.mockImplementationOnce(() => { throw new Error('Context invalidated'); });
    expect((await sendMessage({ type: 'GET_SETTINGS_STATUS' })).error).toContain('interrupted');
    dispatch.mockImplementationOnce((_message, callback: (response?: MessageResponse) => void) => callback());
    expect((await sendMessage({ type: 'GET_SETTINGS_STATUS' })).error).toContain('restarted');
  });
});

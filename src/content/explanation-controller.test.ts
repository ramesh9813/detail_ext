// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import type { MessageResponse } from '../shared/types';

const mocks = vi.hoisted(() => ({
  send: vi.fn(), read: vi.fn(),
  card: {
    show: vi.fn(), hide: vi.fn(), destroy: vi.fn(), reposition: vi.fn(),
    setContent: vi.fn(), setError: vi.fn(), setProvider: vi.fn(), contains: () => false,
  },
}));
vi.mock('../messaging/send-message', () => ({ sendMessage: mocks.send }));
vi.mock('../floating-ui/explanation-card', () => ({ createExplanationCard: () => mocks.card }));
vi.mock('./selection-utils', () => ({ readSelection: mocks.read, sameSelection: () => false, isEditable: () => false }));
import { startExplanationController } from './explanation-controller';

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function setup(configured = true) {
  vi.useFakeTimers();
  vi.stubGlobal('chrome', {
    runtime: { onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
  });
  mocks.read.mockReturnValue({ text: 'Artificial General Intelligence', anchor: new DOMRect(20, 20, 100, 20), range: document.createRange() });
  mocks.send.mockImplementation(async (message: { type: string }) =>
    message.type === 'GET_SETTINGS_STATUS' ? { status: { configured, enabled: true } } : {});
  cleanup = startExplanationController();
}

async function complete() {
  document.dispatchEvent(new Event('pointerdown'));
  document.dispatchEvent(new Event('pointerup'));
  await vi.advanceTimersByTimeAsync(25);
}

it('does not explain without an active provider', async () => {
  setup(false);
  await complete();
  expect(mocks.card.show).toHaveBeenCalled();
  expect(mocks.card.setError).toHaveBeenCalledWith('Choose a provider and model in extension settings.');
  expect(mocks.send.mock.calls.some(([message]) => message.type === 'EXPLAIN_TEXT')).toBe(false);
});

it('renders loading immediately and ignores stale responses after a rapid new selection', async () => {
  setup();
  const pending: Array<(value: MessageResponse) => void> = [];
  mocks.send.mockImplementation((message: { type: string }) => {
    if (message.type === 'GET_SETTINGS_STATUS') return Promise.resolve({ status: { configured: true, enabled: true } });
    if (message.type === 'EXPLAIN_TEXT') return new Promise<MessageResponse>(resolve => pending.push(resolve));
    return Promise.resolve({});
  });
  await complete();
  expect(mocks.card.show).toHaveBeenCalledOnce();
  await complete();
  expect(mocks.card.show).toHaveBeenCalledTimes(2);
  pending[1]({ content: 'New explanation' });
  await Promise.resolve();
  pending[0]({ content: 'Old explanation' });
  await Promise.resolve();
  expect(mocks.card.setContent).toHaveBeenCalledExactlyOnceWith('New explanation');
  expect(mocks.send.mock.calls.some(([message]) => message.type === 'CANCEL_EXPLANATION')).toBe(true);
});

it('shows a friendly failure returned by the service worker', async () => {
  setup();
  await Promise.resolve();
  mocks.send.mockResolvedValue({ error: 'The extension connection was interrupted.' });
  await complete();
  expect(mocks.card.setError).toHaveBeenCalledWith('The extension connection was interrupted.');
});

it('shows processing before a slow settings lookup completes', async () => {
  setup();
  mocks.send.mockImplementation(() => new Promise<never>(() => {}));
  await complete();
  expect(mocks.card.show).toHaveBeenCalledOnce();
});

it('recovers when startup settings were unavailable', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('chrome', { runtime: { onMessage: { addListener: vi.fn(), removeListener: vi.fn() } } });
  mocks.read.mockReturnValue({ text: 'Text', anchor: new DOMRect(20, 20, 100, 20), range: document.createRange() });
  mocks.send.mockResolvedValueOnce({ error: 'Worker starting' });
  mocks.send.mockImplementation(async (message: { type: string }) => message.type === 'GET_SETTINGS_STATUS'
    ? { status: { configured: true, enabled: true, providerName: 'Saved provider', model: 'model' } }
    : { content: 'Explanation' });
  cleanup = startExplanationController();
  await complete();
  expect(mocks.card.setProvider).toHaveBeenCalledWith('Saved provider', 'model');
  expect(mocks.card.setContent).toHaveBeenCalledWith('Explanation');
});

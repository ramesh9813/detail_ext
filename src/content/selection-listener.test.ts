// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { listenForSelections } from './selection-listener';

afterEach(() => vi.useRealTimers());

it('waits until selection completion rather than intermediate changes', () => {
  vi.useFakeTimers();
  const complete = vi.fn();
  const dismiss = vi.fn();
  const cleanup = listenForSelections(complete, dismiss, () => false);
  document.dispatchEvent(new Event('pointerdown'));
  document.dispatchEvent(new Event('selectionchange'));
  vi.advanceTimersByTime(100);
  expect(complete).not.toHaveBeenCalled();
  document.dispatchEvent(new Event('pointerup'));
  vi.advanceTimersByTime(25);
  expect(complete).toHaveBeenCalledTimes(1);
  expect(dismiss).toHaveBeenCalledTimes(1);
  cleanup();
  document.dispatchEvent(new Event('pointerup'));
  vi.advanceTimersByTime(25);
  expect(complete).toHaveBeenCalledTimes(1);
});

it('ignores the isolated card and dismisses on Escape', () => {
  vi.useFakeTimers();
  const complete = vi.fn();
  const dismiss = vi.fn();
  let inside = true;
  const cleanup = listenForSelections(complete, dismiss, () => inside);
  document.dispatchEvent(new Event('pointerup'));
  vi.advanceTimersByTime(25);
  expect(complete).not.toHaveBeenCalled();
  inside = false;
  document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape' }));
  expect(dismiss).toHaveBeenCalledOnce();
  cleanup();
});

it('supports keyboard selection and debounces duplicate completion events', () => {
  vi.useFakeTimers();
  const complete = vi.fn();
  const cleanup = listenForSelections(complete, vi.fn(), () => false);
  document.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', shiftKey: true }));
  document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', shiftKey: true }));
  vi.advanceTimersByTime(25);
  expect(complete).toHaveBeenCalledOnce();
  cleanup();
});

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

it('captures completion before application document handlers stop propagation', () => {
  vi.useFakeTimers();
  const complete = vi.fn();
  const cleanup = listenForSelections(complete, vi.fn(), () => false);
  const block = (event: Event) => event.stopImmediatePropagation();
  document.addEventListener('pointerup', block, true);
  document.dispatchEvent(new Event('pointerup'));
  vi.advanceTimersByTime(25);
  expect(complete).toHaveBeenCalledOnce();
  document.removeEventListener('pointerup', block, true);
  cleanup();
});

it('stabilizes late selection changes without submitting while dragging or holding Shift', () => {
  vi.useFakeTimers();
  const complete = vi.fn();
  const cleanup = listenForSelections(complete, vi.fn(), () => false);
  document.dispatchEvent(new Event('pointerdown'));
  document.dispatchEvent(new Event('selectionchange'));
  vi.advanceTimersByTime(200);
  expect(complete).not.toHaveBeenCalled();
  document.dispatchEvent(new Event('pointerup'));
  vi.advanceTimersByTime(5);
  document.dispatchEvent(new Event('selectionchange'));
  vi.advanceTimersByTime(89);
  expect(complete).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(complete).toHaveBeenCalledOnce();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true }));
  document.dispatchEvent(new Event('selectionchange'));
  document.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', shiftKey: true }));
  vi.advanceTimersByTime(200);
  expect(complete).toHaveBeenCalledOnce();
  document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift' }));
  vi.advanceTimersByTime(25);
  expect(complete).toHaveBeenCalledTimes(2);
  cleanup();
});

it('ignores unsolicited selection changes and clears fallback intent after Escape', () => {
  vi.useFakeTimers();
  const complete = vi.fn();
  const cleanup = listenForSelections(complete, vi.fn(), () => false);
  document.dispatchEvent(new Event('selectionchange'));
  vi.advanceTimersByTime(200);
  expect(complete).not.toHaveBeenCalled();
  document.dispatchEvent(new Event('pointerup'));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  document.dispatchEvent(new Event('selectionchange'));
  vi.advanceTimersByTime(200);
  expect(complete).not.toHaveBeenCalled();
  cleanup();
});

it('ignores completions originating inside an editor even when a previous document range remains selected', () => {
  vi.useFakeTimers();
  const complete = vi.fn();
  const cleanup = listenForSelections(complete, vi.fn(), () => false);
  const input = document.createElement('textarea');
  document.body.append(input);
  input.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  input.dispatchEvent(new Event('pointerup', { bubbles: true }));
  document.dispatchEvent(new Event('selectionchange'));
  input.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', shiftKey: true, bubbles: true }));
  vi.advanceTimersByTime(200);
  expect(complete).not.toHaveBeenCalled();
  cleanup();
  input.remove();
});

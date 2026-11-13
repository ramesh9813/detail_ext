import { createExplanationCard } from '../floating-ui/explanation-card';
import { sendMessage } from '../messaging/send-message';
import type { SettingsStatus } from '../shared/types';
import { selectionAnchor } from './selection-anchor';
import { listenForSelections } from './selection-listener';
import { readSelection, sameSelection, type TextSelection } from './selection-utils';

export function startExplanationController(): () => void {
  let status: SettingsStatus = { enabled: false, configured: false };
  let active: TextSelection | null = null;
  let requestId: string | null = null;
  let location = window.location.href;
  let generation = 0;
  let frame = 0;
  let destroyed = false;
  const card = createExplanationCard(dismiss);
  const navigation = 'navigation' in window && window.navigation instanceof EventTarget
    ? window.navigation : null;

  function dismiss() {
    generation++;
    if (requestId) void sendMessage({ type: 'CANCEL_EXPLANATION', requestId });
    requestId = null;
    active = null;
    card.hide();
  }

  function applyStatus(next: SettingsStatus) {
    status = next;
    if (!status.enabled || !status.configured) dismiss();
  }

  async function refreshStatus() {
    const response = await sendMessage({ type: 'GET_SETTINGS_STATUS' });
    if (!destroyed) applyStatus(response.status ?? { enabled: false, configured: false });
  }

  const ready = refreshStatus();

  async function complete() {
    const eventGeneration = generation;
    await ready;
    if (destroyed || eventGeneration !== generation || !status.enabled || !status.configured) return;
    const next = readSelection();
    if (!next) return;
    if (active && sameSelection(active, next)) return;
    dismiss();
    active = next;
    location = window.location.href;
    const id = crypto.randomUUID();
    requestId = id;
    card.show(next.anchor);
    const result = await sendMessage({ type: 'EXPLAIN_TEXT', requestId: id, selectedText: next.text });
    if (destroyed || requestId !== id) return;
    if (window.location.href !== location) { dismiss(); return; }
    if (result.requestId && result.requestId !== id) return;
    if (result.error) card.setError(result.error);
    else if (result.content) card.setContent(result.content);
    else card.setError('The provider returned an empty explanation.');
  }

  function reposition() {
    if (!active || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!active) return;
      if (!active.range.startContainer.isConnected || window.location.href !== location) {
        dismiss();
        return;
      }
      const anchor = selectionAnchor(active.range);
      if (anchor) card.reposition(anchor);
      else dismiss();
    });
  }

  function updated(message: unknown) {
    if (typeof message !== 'object' || message === null || !('type' in message) ||
      message.type !== 'SETTINGS_UPDATED') return;
    void refreshStatus();
  }

  const removeSelections = listenForSelections(() => void complete(), dismiss, card.contains);
  window.addEventListener('focus', refreshStatus);
  window.addEventListener('scroll', reposition, { capture: true, passive: true });
  window.addEventListener('resize', reposition, { passive: true });
  window.addEventListener('popstate', dismiss);
  window.addEventListener('hashchange', dismiss);
  navigation?.addEventListener('currententrychange', dismiss);
  window.visualViewport?.addEventListener('resize', reposition);
  window.visualViewport?.addEventListener('scroll', reposition);
  chrome.runtime.onMessage.addListener(updated);

  return () => {
    destroyed = true;
    dismiss();
    removeSelections();
    cancelAnimationFrame(frame);
    window.removeEventListener('focus', refreshStatus);
    window.removeEventListener('scroll', reposition, true);
    window.removeEventListener('resize', reposition);
    window.removeEventListener('popstate', dismiss);
    window.removeEventListener('hashchange', dismiss);
    navigation?.removeEventListener('currententrychange', dismiss);
    window.visualViewport?.removeEventListener('resize', reposition);
    window.visualViewport?.removeEventListener('scroll', reposition);
    chrome.runtime.onMessage.removeListener(updated);
    card.destroy();
  };
}

import { isEditable } from './selection-utils';

export function listenForSelections(
  complete: (scope?: ShadowRoot) => void,
  dismiss: () => void,
  contains: (event: Event) => boolean,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let dragging = false;
  let extending = false;
  let interactionUntil = 0;
  let scope: ShadowRoot | undefined;
  let editableGesture = false;
  const editableEvent = (event: Event) => {
    const target = event.composedPath().find(node => node instanceof Node);
    return target instanceof Node && isEditable(target);
  };
  const remember = (event: Event) => {
    interactionUntil = Date.now() + 1800;
    const target = event.composedPath().find(node => node instanceof Node);
    const root = target instanceof Node ? target.getRootNode() : undefined;
    scope = root instanceof ShadowRoot && root.mode === 'open' ? root : undefined;
  };
  const schedule = (delay = 24) => {
    clearTimeout(timer);
    timer = setTimeout(() => { if (!dragging && !extending) complete(scope); }, delay);
  };
  const primary = (event: Event) => !('button' in event) || event.button === 0;
  const pointerDown = (event: Event) => {
    if (contains(event) || !primary(event)) return;
    remember(event);
    editableGesture = editableEvent(event);
    dragging = true;
    clearTimeout(timer);
    dismiss();
  };
  const pointerUp = (event: Event) => {
    if (!primary(event)) return;
    dragging = false;
    if (editableGesture || editableEvent(event)) {
      editableGesture = false;
      interactionUntil = 0;
      clearTimeout(timer);
      return;
    }
    if (contains(event)) { interactionUntil = 0; return; }
    remember(event);
    schedule();
  };
  const cancel = () => { dragging = false; extending = false; clearTimeout(timer); };
  const keyDown = (event: KeyboardEvent) => {
    if (contains(event)) return;
    if (editableEvent(event)) { cancel(); interactionUntil = 0; return; }
    remember(event);
    if (event.key === 'Escape') { cancel(); interactionUntil = 0; dismiss(); return; }
    if (event.shiftKey || event.key === 'Shift') { extending = true; clearTimeout(timer); }
  };
  const keyUp = (event: KeyboardEvent) => {
    if (contains(event)) return;
    if (editableEvent(event)) { cancel(); interactionUntil = 0; return; }
    if (event.key === 'Escape') { cancel(); interactionUntil = 0; dismiss(); return; }
    remember(event);
    if (event.key === 'Shift' || !event.shiftKey) extending = false;
    const selectionKey = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Shift'].includes(event.key);
    if (!extending && (selectionKey || event.key.toLowerCase() === 'a')) schedule();
  };
  const selectionChanged = () => {
    // Applications may finalize their selection after pointerup. Never submit a drag.
    if (!dragging && !extending && Date.now() < interactionUntil) schedule(90);
  };
  window.addEventListener('pointerdown', pointerDown, true);
  window.addEventListener('pointerup', pointerUp, true);
  window.addEventListener('pointercancel', cancel, true);
  window.addEventListener('keydown', keyDown, true);
  window.addEventListener('keyup', keyUp, true);
  window.addEventListener('blur', cancel);
  document.addEventListener('selectionchange', selectionChanged);
  const needsTouchFallback = !('PointerEvent' in window);
  if (needsTouchFallback) {
    window.addEventListener('touchstart', pointerDown, { capture: true, passive: true });
    window.addEventListener('touchend', pointerUp, { capture: true, passive: true });
    window.addEventListener('touchcancel', cancel, true);
  }
  return () => {
    clearTimeout(timer);
    window.removeEventListener('pointerdown', pointerDown, true);
    window.removeEventListener('pointerup', pointerUp, true);
    window.removeEventListener('pointercancel', cancel, true);
    window.removeEventListener('keydown', keyDown, true);
    window.removeEventListener('keyup', keyUp, true);
    window.removeEventListener('blur', cancel);
    document.removeEventListener('selectionchange', selectionChanged);
    if (needsTouchFallback) {
      window.removeEventListener('touchstart', pointerDown, true);
      window.removeEventListener('touchend', pointerUp, true);
      window.removeEventListener('touchcancel', cancel, true);
    }
  };
}

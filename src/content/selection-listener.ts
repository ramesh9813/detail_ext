export function listenForSelections(
  complete: () => void,
  dismiss: () => void,
  contains: (event: Event) => boolean,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(complete, 24);
  };
  const pointerDown = (event: Event) => {
    if (contains(event) || ('button' in event && event.button !== 0)) return;
    clearTimeout(timer);
    dismiss();
  };
  const pointerUp = (event: Event) => {
    if (!contains(event) && (!('button' in event) || event.button === 0)) schedule();
  };
  const keyUp = (event: KeyboardEvent) => {
    if (contains(event)) return;
    if (event.key === 'Escape') {
      clearTimeout(timer);
      dismiss();
    } else if (event.shiftKey || ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'a'].includes(event.key)) {
      schedule();
    }
  };
  document.addEventListener('pointerdown', pointerDown, true);
  document.addEventListener('pointerup', pointerUp, true);
  document.addEventListener('keyup', keyUp, true);
  const needsTouchFallback = !('PointerEvent' in window);
  if (needsTouchFallback) document.addEventListener('touchend', pointerUp, { passive: true });
  return () => {
    clearTimeout(timer);
    document.removeEventListener('pointerdown', pointerDown, true);
    document.removeEventListener('pointerup', pointerUp, true);
    document.removeEventListener('keyup', keyUp, true);
    if (needsTouchFallback) document.removeEventListener('touchend', pointerUp);
  };
}

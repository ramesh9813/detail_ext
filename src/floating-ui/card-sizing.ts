import type { ViewportBounds } from './card-position';

export function createCardSizing(host: HTMLElement, onResize: () => void) {
  const handle = document.createElement('button');
  handle.type = 'button';
  handle.className = 'resize-handle';
  handle.setAttribute('aria-label', 'Resize explanation');
  handle.title = 'Drag to resize, or use arrow keys';
  let width = 400;
  let height: number | undefined;
  let viewport: ViewportBounds = { width: window.innerWidth, height: window.innerHeight };
  let drag: { x: number; y: number; width: number; height: number } | undefined;

  function applyBounds(bounds: ViewportBounds) {
    viewport = bounds;
    const availableWidth = Math.max(0, bounds.width - 16);
    const availableHeight = Math.max(0, bounds.height - 16);
    width = Math.max(Math.min(280, availableWidth), Math.min(width, availableWidth));
    if (height !== undefined) height = Math.max(Math.min(140, availableHeight), Math.min(height, availableHeight));
    host.style.width = `${width}px`;
    host.style.height = height === undefined ? '' : `${height}px`;
    host.style.maxHeight = `${height === undefined ? Math.min(360, availableHeight) : availableHeight}px`;
  }
  function move(event: PointerEvent) {
    if (!drag) return;
    event.preventDefault();
    width = drag.width + event.clientX - drag.x;
    height = drag.height + event.clientY - drag.y;
    applyBounds(viewport);
    onResize();
  }
  function stop() {
    drag = undefined;
    document.removeEventListener('pointermove', move, true);
    document.removeEventListener('pointerup', stop, true);
    document.removeEventListener('pointercancel', stop, true);
  }
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = host.getBoundingClientRect();
    drag = { x: event.clientX, y: event.clientY, width: rect.width, height: rect.height };
    document.addEventListener('pointermove', move, { capture: true, passive: false });
    document.addEventListener('pointerup', stop, true);
    document.addEventListener('pointercancel', stop, true);
  });
  handle.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = host.getBoundingClientRect();
    width = rect.width + (event.key === 'ArrowRight' ? 20 : event.key === 'ArrowLeft' ? -20 : 0);
    height = rect.height + (event.key === 'ArrowDown' ? 20 : event.key === 'ArrowUp' ? -20 : 0);
    applyBounds(viewport);
    onResize();
  });
  return { handle, applyBounds, destroy: stop };
}

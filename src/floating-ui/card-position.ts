export interface ViewportBounds {
  width: number;
  height: number;
  offsetLeft?: number;
  offsetTop?: number;
}

export function cardPosition(
  anchor: Pick<DOMRect, 'left' | 'top' | 'bottom'>,
  size: { width: number; height: number },
  viewport: ViewportBounds,
): { left: number; top: number } {
  const margin = 8;
  const leftEdge = (viewport.offsetLeft ?? 0) + margin;
  const topEdge = (viewport.offsetTop ?? 0) + margin;
  const rightEdge = leftEdge + viewport.width - margin * 2;
  const bottomEdge = topEdge + viewport.height - margin * 2;
  const left = Math.max(leftEdge, Math.min(anchor.left, rightEdge - size.width));
  const below = anchor.bottom + margin;
  const top = below + size.height <= bottomEdge ? below : anchor.top - size.height - margin;
  return { left, top: Math.max(topEdge, Math.min(top, bottomEdge - size.height)) };
}

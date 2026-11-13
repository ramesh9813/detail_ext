export function selectionAnchor(range: Range): DOMRect | null {
  const viewport = window.visualViewport;
  const top = viewport?.offsetTop ?? 0;
  const left = viewport?.offsetLeft ?? 0;
  const bottom = top + (viewport?.height ?? window.innerHeight);
  const right = left + (viewport?.width ?? window.innerWidth);
  const rectangles = Array.from(range.getClientRects());
  const visible = rectangles.filter(rect => rect.width > 0 && rect.height > 0 &&
    rect.bottom > top && rect.top < bottom && rect.right > left && rect.left < right);
  const anchor = visible.at(-1);
  if (anchor) return anchor;
  if (rectangles.length) return null;
  const fallback = range.getBoundingClientRect();
  return fallback.width > 0 && fallback.height > 0 && fallback.bottom > top &&
    fallback.top < bottom && fallback.right > left && fallback.left < right ? fallback : null;
}

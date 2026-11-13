import { MAX_SELECTION_LENGTH } from '../shared/constants';
import { selectionAnchor } from './selection-anchor';

const EDITABLE = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]';

export function isEditable(node: Node | null): boolean {
  let element = node instanceof Element ? node : node?.parentElement;
  while (element) {
    if (element.closest(EDITABLE)) return true;
    const root = element.getRootNode();
    element = root instanceof ShadowRoot ? root.host : null;
  }
  return false;
}

export interface TextSelection {
  text: string;
  range: Range;
  anchor: DOMRect;
}

export function readSelection(scope?: ShadowRoot): TextSelection | null {
  const scoped = scope as (ShadowRoot & { getSelection?: () => Selection | null }) | undefined;
  const selection = scoped?.getSelection?.() ?? window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount ||
    isEditable(selection.anchorNode) || isEditable(selection.focusNode)) return null;
  let range = selection.getRangeAt(0);
  const composed = selection as Selection & {
    getComposedRanges?: (options: { shadowRoots: ShadowRoot[] }) => StaticRange[];
  };
  if (scope && composed.getComposedRanges) {
    const boundaries = composed.getComposedRanges({ shadowRoots: [scope] })[0];
    if (boundaries) {
      range = document.createRange();
      range.setStart(boundaries.startContainer, boundaries.startOffset);
      range.setEnd(boundaries.endContainer, boundaries.endOffset);
    }
  }
  const ancestor = range.commonAncestorContainer;
  if (isEditable(ancestor)) return null;
  if (ancestor instanceof Element) {
    for (const field of ancestor.querySelectorAll(EDITABLE)) {
      if (range.intersectsNode(field)) return null;
    }
  }
  // Derive the payload from the exact range validated above, not a separate selection string.
  const text = range.toString().trim();
  // Inaccessible shadow selections can be retargeted to an empty host range.
  // Selection and Range may legitimately format block-boundary whitespace differently.
  if (!text || text.length > MAX_SELECTION_LENGTH || range.collapsed) return null;
  const anchor = selectionAnchor(range);
  return anchor ? { text, range: range.cloneRange(), anchor } : null;
}

export function sameSelection(first: TextSelection, second: TextSelection): boolean {
  return first.text === second.text && first.range.startContainer === second.range.startContainer &&
    first.range.endContainer === second.range.endContainer &&
    first.range.startOffset === second.range.startOffset && first.range.endOffset === second.range.endOffset;
}

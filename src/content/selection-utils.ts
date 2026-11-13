import { MAX_SELECTION_LENGTH } from '../shared/constants';
import { selectionAnchor } from './selection-anchor';

const EDITABLE = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]';

export function isEditable(node: Node | null): boolean {
  const element = node instanceof Element ? node : node?.parentElement;
  return Boolean(element?.closest(EDITABLE));
}

export interface TextSelection {
  text: string;
  range: Range;
  anchor: DOMRect;
}

export function readSelection(): TextSelection | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount ||
    isEditable(selection.anchorNode) || isEditable(selection.focusNode) ||
    isEditable(document.activeElement)) return null;
  const range = selection.getRangeAt(0);
  const ancestor = range.commonAncestorContainer;
  if (isEditable(ancestor)) return null;
  if (ancestor instanceof Element) {
    for (const field of ancestor.querySelectorAll(EDITABLE)) {
      if (range.intersectsNode(field)) return null;
    }
  }
  const text = selection.toString().trim();
  if (!text || text.length > MAX_SELECTION_LENGTH) return null;
  const anchor = selectionAnchor(range);
  return anchor ? { text, range: range.cloneRange(), anchor } : null;
}

export function sameSelection(first: TextSelection, second: TextSelection): boolean {
  return first.text === second.text && first.range.startContainer === second.range.startContainer &&
    first.range.endContainer === second.range.endContainer &&
    first.range.startOffset === second.range.startOffset && first.range.endOffset === second.range.endOffset;
}

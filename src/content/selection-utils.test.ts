// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readSelection, sameSelection, isEditable } from './selection-utils';
import { selectionAnchor } from './selection-anchor';

beforeEach(() => {
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true, value: () => [], writable: true,
  });
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true, value: () => new DOMRect(), writable: true,
  });
});

function select(element: Node, start = 0, end?: number) {
  const range = document.createRange();
  range.setStart(element, start);
  range.setEnd(element, end ?? element.textContent?.length ?? 0);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
  return range;
}

afterEach(() => {
  document.body.replaceChildren();
  window.getSelection()?.removeAllRanges();
  vi.restoreAllMocks();
});

describe('privacy aware selection', () => {
  it('ignores empty and collapsed selections', () => {
    expect(readSelection()).toBeNull();
    const text = document.createTextNode('hello');
    document.body.append(text);
    select(text, 1, 1);
    expect(readSelection()).toBeNull();
  });

  it('ignores editable controls and their descendants', () => {
    document.body.innerHTML = '<div contenteditable="true"><span>private</span></div><input type="password">';
    const text = document.querySelector('span')!.firstChild!;
    select(text);
    expect(isEditable(text)).toBe(true);
    expect(isEditable(document.querySelector('input'))).toBe(true);
    expect(readSelection()).toBeNull();
  });

  it('ignores ranges spanning sensitive fields', () => {
    document.body.innerHTML = '<p>before</p><input value="secret"><p>after</p>';
    const range = document.createRange();
    range.selectNodeContents(document.body);
    window.getSelection()?.addRange(range);
    expect(readSelection()).toBeNull();
  });

  it('returns trimmed text, cloned range and visible coordinates', () => {
    const text = document.createTextNode('  explanation  ');
    document.body.append(text);
    select(text);
    vi.spyOn(Range.prototype, 'getClientRects').mockReturnValue([new DOMRect(40, 60, 90, 20)] as unknown as DOMRectList);
    const selection = readSelection();
    expect(selection?.text).toBe('explanation');
    expect(selection?.anchor.x).toBe(40);
    expect(selection && sameSelection(selection, readSelection()!)).toBe(true);
  });

  it('rejects an overlong passage', () => {
    const text = document.createTextNode('x'.repeat(20001));
    document.body.append(text);
    select(text);
    expect(readSelection()).toBeNull();
  });
});

describe('range positioning', () => {
  it('anchors to the last visible line on multiline selection', () => {
    const range = document.createRange();
    const rects = [new DOMRect(10, 10, 150, 20), new DOMRect(10, 30, 80, 20)];
    vi.spyOn(range, 'getClientRects').mockReturnValue(rects as unknown as DOMRectList);
    expect(selectionAnchor(range)).toBe(rects[1]);
  });

  it('returns null when a selection has scrolled offscreen', () => {
    const range = document.createRange();
    vi.spyOn(range, 'getClientRects').mockReturnValue([new DOMRect(10, -50, 90, 20)] as unknown as DOMRectList);
    expect(selectionAnchor(range)).toBeNull();
  });
});

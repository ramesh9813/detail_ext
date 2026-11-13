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

  it('allows noneditable response text when a separate composer retains focus', () => {
    document.body.innerHTML = '<textarea aria-label="Message"></textarea><p>Readable response</p>';
    const composer = document.querySelector('textarea')!;
    composer.focus();
    select(document.querySelector('p')!.firstChild!);
    vi.spyOn(Range.prototype, 'getClientRects').mockReturnValue([new DOMRect(40, 60, 90, 20)] as unknown as DOMRectList);
    expect(document.activeElement).toBe(composer);
    expect(readSelection()?.text).toBe('Readable response');
  });

  it('recognizes editability across an open shadow root boundary', () => {
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    editor.setAttribute('contenteditable', 'true');
    const root = editor.attachShadow({ mode: 'open' });
    const node = document.createTextNode('Private editor contents');
    root.append(node);
    document.body.append(editor);
    expect(isEditable(node)).toBe(true);
  });

  it('reads an accessible open shadow selection using its native scope', () => {
    const host = document.createElement('div');
    const root = host.attachShadow({ mode: 'open' });
    const text = document.createTextNode('Shadow response');
    root.append(text);
    document.body.append(host);
    const range = document.createRange();
    range.selectNodeContents(text);
    const scoped = { isCollapsed: false, rangeCount: 1, anchorNode: text, focusNode: text,
      getRangeAt: () => range, toString: () => 'Shadow response' };
    Object.defineProperty(root, 'getSelection', { value: () => scoped });
    vi.spyOn(Range.prototype, 'getClientRects').mockReturnValue([new DOMRect(40, 60, 90, 20)] as unknown as DOMRectList);
    expect(readSelection(root)?.text).toBe('Shadow response');
  });

  it('uses only the validated range text as the payload', () => {
    const text = document.createTextNode('Allowed response');
    document.body.append(text);
    select(text);
    vi.spyOn(window.getSelection()!, 'toString').mockReturnValue('Unrelated form contents');
    vi.spyOn(Range.prototype, 'getClientRects').mockReturnValue([new DOMRect(40, 60, 90, 20)] as unknown as DOMRectList);
    expect(readSelection()?.text).toBe('Allowed response');
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

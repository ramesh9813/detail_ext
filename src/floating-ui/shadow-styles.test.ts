// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyShadowStyles } from './shadow-styles';

afterEach(() => vi.unstubAllGlobals());

describe('static shadow styles', () => {
  it('uses constructable stylesheets without inline style elements when supported', () => {
    const replaceSync = vi.fn();
    class Sheet { replaceSync = replaceSync; }
    vi.stubGlobal('CSSStyleSheet', Sheet);
    Object.defineProperty(Sheet.prototype, 'replaceSync', { value: replaceSync });
    const shadow = document.createElement('div').attachShadow({ mode: 'open' });
    Object.defineProperty(shadow, 'adoptedStyleSheets', { value: [], writable: true });
    applyShadowStyles(shadow, ':host { color: blue; }');
    expect(replaceSync).toHaveBeenCalledWith(':host { color: blue; }');
    expect(shadow.adoptedStyleSheets).toHaveLength(1);
    expect(shadow.querySelector('style')).toBeNull();
  });
  it('falls back to a static style node on unsupported browsers', () => {
    vi.stubGlobal('CSSStyleSheet', undefined);
    const shadow = document.createElement('div').attachShadow({ mode: 'open' });
    applyShadowStyles(shadow, ':host { color: blue; }');
    expect(shadow.querySelector('style')?.textContent).toBe(':host { color: blue; }');
  });
});

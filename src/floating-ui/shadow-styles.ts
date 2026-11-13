/** Install bundled static CSS without an inline style element on strict-CSP pages. */
export function applyShadowStyles(shadow: ShadowRoot, css: string): void {
  if ('adoptedStyleSheets' in shadow && typeof CSSStyleSheet !== 'undefined'
    && typeof CSSStyleSheet.prototype.replaceSync === 'function') {
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, sheet];
      return;
    } catch {
      // Older browser implementations may expose but not support adoption.
    }
  }
  const style = document.createElement('style');
  style.textContent = css;
  shadow.prepend(style);
}

import theme from './card-theme.css?inline';
import styles from './card-styles.css?inline';
import { cardPosition } from './card-position';
import { renderMarkdown } from './markdown-content';
import { createCardSizing } from './card-sizing';
import { applyShadowStyles } from './shadow-styles';

export interface ExplanationCard {
  host: HTMLElement;
  show(rect: DOMRect, text?: string): void;
  setContent(text: string): void;
  setError(text: string): void;
  setProvider(name?: string, model?: string): void;
  hide(): void;
  destroy(): void;
  reposition(rect: DOMRect): void;
  contains(event: Event): boolean;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = '') {
  const node = document.createElement(tag);
  node.textContent = text;
  node.className = className;
  return node;
}

export function createExplanationCard(onClose: () => void): ExplanationCard {
  const host = element('div');
  host.setAttribute('data-ai-selection-explainer', '');
  host.hidden = true;
  const shadow = host.attachShadow({ mode: 'closed' });
  applyShadowStyles(shadow, `${styles}\n${theme}`);
  const card = element('section', '', 'card');
  card.setAttribute('role', 'region');
  card.setAttribute('aria-label', 'AI Explanation');
  const header = element('header');
  const mark = element('span', '✦', 'mark');
  mark.setAttribute('aria-hidden', 'true');
  const close = element('button', '×', 'close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close explanation');
  header.append(mark, element('h2', 'AI Explanation'), close);
  const body = element('div', '', 'body');
  body.tabIndex = 0;
  body.setAttribute('aria-label', 'Explanation content');
  body.setAttribute('aria-live', 'polite');
  body.setAttribute('aria-atomic', 'true');
  const footer = element('footer');
  const copy = element('button', 'Copy');
  const provider = element('span', '', 'provider');
  copy.type = 'button';
  copy.setAttribute('aria-label', 'Copy explanation');
  footer.append(element('span', 'AI-generated · verify important details'), copy);
  footer.replaceChildren(provider, copy);
  card.append(header, body, footer);
  shadow.append(card);
  document.documentElement.append(host);
  let anchor: DOMRect | undefined;
  let response = '';
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  const sizing = createCardSizing(host, () => { if (anchor) reposition(anchor); });
  card.append(sizing.handle);

  function viewport() {
    const view = window.visualViewport;
    return { width: view?.width ?? window.innerWidth, height: view?.height ?? window.innerHeight,
      offsetLeft: view?.offsetLeft ?? 0, offsetTop: view?.offsetTop ?? 0 };
  }
  function reposition(rect: DOMRect) {
    anchor = rect;
    if (host.hidden) return;
    const bounds = viewport();
    sizing.applyBounds(bounds);
    const dimensions = host.getBoundingClientRect();
    const position = cardPosition(rect, dimensions, bounds);
    host.style.left = `${position.left}px`;
    host.style.top = `${position.top}px`;
  }
  function hide() { host.hidden = true; response = ''; }
  function dismiss() { hide(); onClose(); }
  function contains(event: Event) { return event.composedPath().includes(host); }
  function onKey(event: KeyboardEvent) {
    if (!host.hidden && event.key === 'Escape') dismiss();
  }
  function onPointer(event: PointerEvent) {
    if (!host.hidden && !contains(event)) dismiss();
  }
  function onResize() { if (anchor) reposition(anchor); }
  function setBody(text: string, error = false) {
    body.className = error ? 'body error' : 'body markdown';
    if (error) body.textContent = text;
    else {
      try { body.replaceChildren(renderMarkdown(text)); }
      catch { body.textContent = text; }
    }
    body.setAttribute('aria-busy', 'false');
    response = error ? '' : text;
    copy.disabled = error || !text;
    copy.textContent = 'Copy';
    if (anchor) reposition(anchor);
  }
  async function copyResponse() {
    if (!response) return;
    try {
      await navigator.clipboard.writeText(response);
      copy.textContent = 'Copied';
    } catch {
      copy.textContent = 'Copy unavailable';
    }
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => { copy.textContent = 'Copy'; }, 1800);
  }
  close.addEventListener('click', dismiss);
  copy.addEventListener('click', () => { void copyResponse(); });
  // Retargeted shadow events must not become another selection request.
  host.addEventListener('pointerup', event => event.stopPropagation());
  host.addEventListener('keyup', event => event.stopPropagation());
  document.addEventListener('keydown', onKey);
  document.addEventListener('pointerdown', onPointer, true);
  window.addEventListener('resize', onResize, { passive: true });
  window.visualViewport?.addEventListener('resize', onResize, { passive: true });
  return {
    host, contains, reposition, hide,
    show(rect, text) {
      host.hidden = false;
      anchor = rect;
      response = '';
      copy.disabled = true;
      copy.textContent = 'Copy';
      if (text !== undefined) setBody(text);
      else {
        body.className = 'body loading';
        body.setAttribute('aria-busy', 'true');
        const spinner = element('span', '', 'spinner');
        spinner.setAttribute('aria-hidden', 'true');
        body.replaceChildren(spinner, document.createTextNode('Processing...'));
      }
      reposition(rect);
    },
    setContent: text => setBody(text),
    setProvider(name, model) {
      provider.textContent = name ? `Using ${name}` : '';
      provider.title = model ? `${name ?? ''} / ${model}` : name ?? '';
    },
    setError: text => setBody(text, true),
    destroy() {
      sizing.destroy();
      clearTimeout(copyTimer);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      host.remove();
    },
  };
}

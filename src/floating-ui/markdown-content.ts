import { marked, type MarkedToken, type Token, type Tokens } from 'marked';

const basicEntities: Record<string, string> = {
  '&amp;': '&', '&AMP;': '&', '&lt;': '<', '&LT;': '<', '&gt;': '>', '&GT;': '>',
  '&quot;': '"', '&QUOT;': '"', '&apos;': "'", '&nbsp;': '\u00a0',
  '&ndash;': '\u2013', '&mdash;': '\u2014', '&hellip;': '\u2026',
};

function text(value: string): Text {
  // Decode entities alone in an inert document, never model-supplied tags.
  const decoded = value.replace(/&(?:#\d+|#x[\da-f]+|[a-z][\da-z]+);/gi, entity => {
    try { return new DOMParser().parseFromString(entity, 'text/html').body.textContent ?? entity; }
    catch {
      if (basicEntities[entity]) return basicEntities[entity];
      if (entity.startsWith('&#')) {
        const hexadecimal = entity[2].toLowerCase() === 'x';
        const code = Number.parseInt(entity.slice(hexadecimal ? 3 : 2, -1), hexadecimal ? 16 : 10);
        return code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff)
          ? String.fromCodePoint(code) : '\ufffd';
      }
      return entity;
    }
  });
  return document.createTextNode(decoded);
}

function node<K extends keyof HTMLElementTagNameMap>(tag: K, children?: Node): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (children) element.append(children);
  return element;
}

function safeLink(href: string, children: Node, title?: string | null): Node {
  try {
    const url = new URL(href);
    if (!['https:', 'http:', 'mailto:'].includes(url.protocol) || url.username || url.password) return children;
    const link = node('a', children);
    link.href = url.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.referrerPolicy = 'no-referrer';
    if (title) link.title = title;
    return link;
  } catch { return children; }
}

function list(token: Tokens.List): HTMLElement {
  const element = token.ordered ? node('ol') : node('ul');
  if (element instanceof HTMLOListElement && typeof token.start === 'number') element.start = token.start;
  for (const item of token.items) {
    const entry = node('li');
    if (item.task) {
      const check = node('span', document.createTextNode(item.checked ? '☑ ' : '☐ '));
      check.setAttribute('aria-label', item.checked ? 'Completed task' : 'Incomplete task');
      entry.append(check);
    }
    entry.append(renderTokens(item.tokens));
    element.append(entry);
  }
  return element;
}

function table(token: Tokens.Table): HTMLElement {
  const table = node('table');
  const row = (cells: Tokens.TableCell[], heading: boolean) => {
    const row = node('tr');
    cells.forEach((cell, index) => {
      const element = node(heading ? 'th' : 'td', renderTokens(cell.tokens));
      if (heading) element.setAttribute('scope', 'col');
      const alignment = token.align[index];
      if (alignment) element.style.textAlign = alignment;
      row.append(element);
    });
    return row;
  };
  table.append(node('thead', row(token.header, true)));
  const body = node('tbody');
  for (const cells of token.rows) body.append(row(cells, false));
  table.append(body);
  const scroll = node('div', table);
  scroll.className = 'table-scroll';
  scroll.tabIndex = 0;
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', 'Explanation table');
  return scroll;
}

function renderToken(token: MarkedToken): Node {
  switch (token.type) {
    case 'space': case 'def': return document.createDocumentFragment();
    case 'heading': return node(`h${token.depth}` as 'h1', renderTokens(token.tokens));
    case 'paragraph': return node('p', renderTokens(token.tokens));
    case 'blockquote': return node('blockquote', renderTokens(token.tokens));
    case 'strong': return node('strong', renderTokens(token.tokens));
    case 'em': return node('em', renderTokens(token.tokens));
    case 'del': return node('del', renderTokens(token.tokens));
    case 'text': return token.tokens ? renderTokens(token.tokens) : text(token.text);
    case 'escape': return text(token.text);
    case 'html': return document.createTextNode(token.raw);
    case 'br': return node('br');
    case 'hr': return node('hr');
    case 'code': {
      const code = node('code', document.createTextNode(token.text));
      if (token.lang) code.setAttribute('data-language', token.lang.split(/\s/)[0]);
      return node('pre', code);
    }
    case 'codespan': return node('code', document.createTextNode(token.text));
    case 'list': return list(token);
    case 'list_item': return node('li', renderTokens(token.tokens));
    case 'checkbox': return document.createTextNode(token.checked ? '☑ ' : '☐ ');
    case 'table': return table(token);
    case 'link': return safeLink(token.href, renderTokens(token.tokens), token.title);
    // Keep image descriptions without loading remote tracking images.
    case 'image': return safeLink(token.href, text(token.text || 'Image'), token.title);
  }
}

function renderTokens(tokens: readonly Token[]): DocumentFragment {
  const fragment = document.createDocumentFragment();
  for (const token of tokens) {
    // This private lexer has no plugins, so it emits only the built-in token union.
    fragment.append(renderToken(token as MarkedToken));
  }
  return fragment;
}

export function renderMarkdown(content: string): DocumentFragment {
  return renderTokens(marked.lexer(content, { gfm: true, breaks: true }));
}

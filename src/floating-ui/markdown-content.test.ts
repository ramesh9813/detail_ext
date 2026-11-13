// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown-content';

function render(content: string) {
  const body = document.createElement('div');
  body.append(renderMarkdown(content));
  return body;
}

describe('safe Markdown content', () => {
  it('renders headings, emphasis and mixed nested lists', () => {
    const body = render('# Heading\n\n**Strong** and *italic* and ~~removed~~\n\n1. First\n   - Nested\n2. Last');
    expect(body.querySelector('h1')?.textContent).toBe('Heading');
    expect(body.querySelector('strong')?.textContent).toBe('Strong');
    expect(body.querySelector('em')?.textContent).toBe('italic');
    expect(body.querySelector('del')?.textContent).toBe('removed');
    expect(body.querySelector('ol > li ul > li')?.textContent).toBe('Nested');
    expect(body.querySelectorAll('ol > li')).toHaveLength(2);
  });
  it('preserves code literally and renders quotes and tables', () => {
    const body = render('> Quoted **idea**\n\n```html\n<img src=x onerror=alert(1)>\n```\n\n| Term | Meaning |\n| --- | --- |\n| **AI** | `intelligence` |');
    expect(body.querySelector('blockquote strong')?.textContent).toBe('idea');
    expect(body.querySelector('pre code')?.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(body.querySelector('img')).toBeNull();
    expect(body.querySelector('th')?.getAttribute('scope')).toBe('col');
    expect(body.querySelector('td strong')?.textContent).toBe('AI');
    expect(body.querySelector('td code')?.textContent).toBe('intelligence');
  });
  it('does not turn raw HTML into markup or execute attributes', () => {
    const source = '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n<svg onload=alert(1)></svg>';
    const body = render(source);
    expect(body.querySelector('script,img,svg,iframe')).toBeNull();
    expect(body.textContent).toContain('<script>alert(1)</script>');
    expect(body.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(body.querySelector('[onerror],[onload]')).toBeNull();
  });
  it('allows safe links and prevents executable links and remote image fetches', () => {
    const body = render('[Safe](https://example.com) [Bad](javascript:alert) [Data](data:text/html,bad) ![Diagram](https://example.com/tracker.png)');
    expect(body.querySelector('a')?.href).toBe('https://example.com/');
    expect(body.querySelector('a')?.rel).toBe('noopener noreferrer');
    expect(body.querySelector('a[href^="javascript:"],a[href^="data:"],img')).toBeNull();
    expect(body.textContent).toContain('Bad');
    expect(body.textContent).toContain('Diagram');
  });
  it('decodes entities as text without creating tags', () => {
    const body = render('A &amp; B &lt;img src=x onerror=alert(1)&gt;');
    expect(body.textContent).toBe('A & B <img src=x onerror=alert(1)>');
    expect(body.querySelector('img')).toBeNull();
  });
  it('keeps the entire long response, including final content', () => {
    const body = render(`${'Paragraph **content**.\n\n'.repeat(500)}Final sentence.`);
    expect(body.querySelectorAll('strong')).toHaveLength(500);
    expect(body.textContent).toContain('Final sentence.');
  });
});

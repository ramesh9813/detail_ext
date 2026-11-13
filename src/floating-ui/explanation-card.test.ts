// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createExplanationCard, type ExplanationCard } from './explanation-card';
import theme from './card-theme.css?inline';

describe('explanation card', () => {
  let shadow: ShadowRoot;
  let card: ExplanationCard;
  let onClose: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    const attach = HTMLElement.prototype.attachShadow;
    vi.spyOn(HTMLElement.prototype, 'attachShadow').mockImplementation(function (this: HTMLElement, options) {
      shadow = attach.call(this, options);
      return shadow;
    });
    onClose = vi.fn();
    card = createExplanationCard(onClose);
  });
  afterEach(() => {
    card.destroy();
    vi.restoreAllMocks();
  });
  const anchor = () => new DOMRect(100, 100, 40, 20);
  it('isolates UI in a closed shadow root', () => {
    expect(card.host.shadowRoot).toBeNull();
    expect(card.host.querySelector('section')).toBeNull();
    expect(shadow.querySelector('section')?.getAttribute('aria-label')).toBe('AI Explanation');
  });
  it('shows an immediate accessible loading state', () => {
    card.show(anchor());
    expect(card.host.hidden).toBe(false);
    expect(shadow.querySelector('.body')?.textContent).toContain('Explaining selection');
    expect(shadow.querySelector('.body')?.getAttribute('aria-busy')).toBe('true');
  });
  it('renders provider response as literal text', () => {
    card.show(anchor());
    card.setContent('<img src=x onerror=alert(1)>');
    expect(shadow.querySelector('img')).toBeNull();
    expect(shadow.querySelector('.body')?.textContent).toBe('<img src=x onerror=alert(1)>');
  });
  it('displays an error and disables copying', () => {
    card.show(anchor());
    card.setError('Provider timed out.');
    expect(shadow.querySelector('.body.error')?.textContent).toBe('Provider timed out.');
    expect(shadow.querySelector<HTMLButtonElement>('footer button')?.disabled).toBe(true);
  });
  it('copies the current response', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    card.show(anchor(), 'A clear explanation.');
    shadow.querySelector<HTMLButtonElement>('footer button')?.click();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith('A clear explanation.');
    expect(shadow.querySelector('footer button')?.textContent).toBe('Copied');
  });
  it('dismisses on Escape but programmatic hide has no callback', () => {
    card.show(anchor());
    card.hide();
    expect(onClose).not.toHaveBeenCalled();
    card.show(anchor());
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(card.host.hidden).toBe(true);
    expect(onClose).toHaveBeenCalledOnce();
  });
  it('provides automatic light and dark theme tokens', () => {
    expect(theme).toContain('--ase-surface: #ffffff');
    expect(theme).toContain('prefers-color-scheme: dark');
    expect(theme).toContain('--ase-surface: #22252d');
  });
  it('removes the host and event listeners on destroy', () => {
    card.show(anchor());
    card.destroy();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(card.host.isConnected).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });
});

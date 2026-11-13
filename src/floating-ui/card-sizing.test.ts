// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createCardSizing } from './card-sizing';

describe('resizable explanation card', () => {
  it('keeps user dimensions across content changes and clamps to viewport', () => {
    const host = document.createElement('div');
    vi.spyOn(host, 'getBoundingClientRect').mockReturnValue(new DOMRect(20, 20, 400, 200));
    const resized = vi.fn();
    const sizing = createCardSizing(host, resized);
    sizing.applyBounds({ width: 1000, height: 800 });
    expect(host.style.width).toBe('400px');
    expect(host.style.height).toBe('');
    sizing.handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(host.style.height).toBe('220px');
    expect(resized).toHaveBeenCalledOnce();
    sizing.applyBounds({ width: 1000, height: 800 });
    expect(host.style.height).toBe('220px');
    sizing.applyBounds({ width: 300, height: 200 });
    expect(host.style.width).toBe('284px');
    expect(host.style.height).toBe('184px');
    sizing.destroy();
  });
  it('preserves usability on tiny visual viewports', () => {
    const host = document.createElement('div');
    const sizing = createCardSizing(host, vi.fn());
    sizing.applyBounds({ width: 200, height: 150 });
    expect(host.style.width).toBe('184px');
    expect(host.style.maxHeight).toBe('134px');
    expect(sizing.handle.getAttribute('aria-label')).toBe('Resize explanation');
    sizing.destroy();
  });
});

import { describe, expect, it } from 'vitest';
import { cardPosition } from './card-position';

describe('cardPosition', () => {
  const viewport = { width: 1000, height: 700 };
  const size = { width: 328, height: 200 };
  it('places card below the selected range', () => {
    expect(cardPosition({ left: 200, top: 100, bottom: 120 }, size, viewport))
      .toEqual({ left: 200, top: 128 });
  });
  it('places card above selection near bottom', () => {
    expect(cardPosition({ left: 200, top: 650, bottom: 680 }, size, viewport))
      .toEqual({ left: 200, top: 442 });
  });
  it('clamps both horizontal boundaries', () => {
    expect(cardPosition({ left: 980, top: 100, bottom: 120 }, size, viewport).left).toBe(664);
    expect(cardPosition({ left: -20, top: 100, bottom: 120 }, size, viewport).left).toBe(8);
  });
  it('clamps top when neither side has room', () => {
    expect(cardPosition({ left: 100, top: 50, bottom: 400 }, size, { width: 400, height: 300 }).top)
      .toBe(8);
  });
  it('accounts for visual viewport offsets', () => {
    const result = cardPosition({ left: 0, top: 0, bottom: 10 }, size,
      { width: 400, height: 300, offsetLeft: 40, offsetTop: 80 });
    expect(result.left).toBe(48);
    expect(result.top).toBe(88);
  });
});

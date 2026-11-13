import { describe, expect, it } from 'vitest';
import { RequestManager } from './request-manager';

describe('request lifecycle', () => {
  it('cancels old selections without letting old completion remove new requests', () => {
    const manager = new RequestManager();
    const old = manager.begin('1:0', 'old', 1000);
    const current = manager.begin('1:0', 'current', 1400);
    expect(old.signal.aborted).toBe(true);
    manager.finish('1:0', 'old');
    manager.cancel('1:0', 'current');
    expect(current.signal.aborted).toBe(true);
  });

  it('limits excessive requests without making another paid request', () => {
    const manager = new RequestManager();
    manager.begin('1:0', 'first', 1000);
    expect(() => manager.begin('1:0', 'second', 1100)).toThrow('wait');
  });

  it('only allows cancellation by the matching owner and request', () => {
    const manager = new RequestManager();
    const current = manager.begin('1:0', 'first');
    manager.cancel('2:0', 'first');
    manager.cancel('1:0', 'other');
    expect(current.signal.aborted).toBe(false);
    manager.cancelAll();
    expect(current.signal.aborted).toBe(true);
  });

  it('bounds total parallel work', () => {
    const manager = new RequestManager();
    for (let i = 0; i < 12; i++) manager.begin(String(i), 'id');
    expect(() => manager.begin('another', 'id')).toThrow('Too many');
  });
});

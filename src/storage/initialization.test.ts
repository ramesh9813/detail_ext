import { afterEach, describe, expect, it, vi } from 'vitest';
import { initializeStorage } from './settings-store';

afterEach(() => vi.unstubAllGlobals());

describe('trusted storage initialization', () => {
  it('shares pending protection across simultaneous reads and protects each new context', async () => {
    const protect = vi.fn(async () => undefined);
    vi.stubGlobal('chrome', { storage: { local: { setAccessLevel: protect } } });
    await Promise.all([initializeStorage(), initializeStorage(), initializeStorage()]);
    expect(protect).toHaveBeenCalledOnce();
    expect(protect).toHaveBeenCalledWith({ accessLevel: 'TRUSTED_CONTEXTS' });
    const nextProtect = vi.fn(async () => undefined);
    vi.stubGlobal('chrome', { storage: { local: { setAccessLevel: nextProtect } } });
    await initializeStorage();
    expect(nextProtect).toHaveBeenCalledOnce();
  });

  it('fails closed and permits a later initialization attempt after failure', async () => {
    const protect = vi.fn().mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValue(undefined);
    vi.stubGlobal('chrome', { storage: { local: { setAccessLevel: protect } } });
    await expect(initializeStorage()).rejects.toThrow('Unavailable');
    await expect(initializeStorage()).resolves.toBeUndefined();
    expect(protect).toHaveBeenCalledTimes(2);
  });
});

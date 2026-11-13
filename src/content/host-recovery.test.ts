// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { recoverCardHost } from './host-recovery';

it('reattaches a host removed by an application and stops recovering after cleanup', async () => {
  const host = document.createElement('div');
  document.documentElement.append(host);
  const cleanup = recoverCardHost(host);
  host.remove();
  await Promise.resolve();
  expect(host.isConnected).toBe(true);
  cleanup();
  host.remove();
  await Promise.resolve();
  expect(host.isConnected).toBe(false);
});

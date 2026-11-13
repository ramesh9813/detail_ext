import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.e2e.ts',
  timeout: 45000,
  expect: { timeout: 8000 },
  workers: 1,
  reporter: 'list',
  use: { trace: 'retain-on-failure' },
});

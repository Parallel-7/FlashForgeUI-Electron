import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e/electron',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: 180_000,
  use: {
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
});

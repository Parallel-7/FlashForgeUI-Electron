import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e/browser',
  fullyParallel: false,
  // Each spec file boots its own emulator printers on fixed ports, so two files running at
  // once would collide with EADDRINUSE. The WebUI port itself is allocated freely.
  workers: 1,
  retries: 0,
  reporter: 'list',
  // Booting emulator instances plus the headless Electron app dominates the runtime; the
  // in-browser assertions that follow take milliseconds.
  timeout: 180_000,
  use: {
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});

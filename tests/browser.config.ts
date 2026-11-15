import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  tsconfig: './browser.tsconfig.json',
  testDir: './browser',
  outputDir: '../test-results',
  workers: 1,
  use: { trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'laptop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } } },
    { name: 'small-mobile', use: { ...devices['Pixel 5'], viewport: { width: 320, height: 740 } } },
  ],
});

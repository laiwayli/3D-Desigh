import { defineConfig } from '@playwright/test';
const testURL = process.env.PLANFORM_TEST_URL;
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  // Shader warm-up on software WebGL needs more time than ordinary UI checks.
  expect: { timeout: 15000 },
  use: {
    baseURL: testURL || 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 1000 },
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
    trace: 'retain-on-failure',
  },
  webServer: testURL ? undefined : { command: 'npm run dev -- --port 5173', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
});

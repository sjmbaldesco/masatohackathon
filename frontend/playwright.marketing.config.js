import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration specifically for capturing pristine, 
 * ultra-high-resolution marketing screenshots for Google Flow (Veo).
 */
export default defineConfig({
  testDir: './tests',
  testMatch: 'marketing-shots.spec.js',
  /* Maximum time one test can run for since we pause frequently for animations */
  timeout: 180 * 1000,
  expect: {
    timeout: 15000
  },
  fullyParallel: false, // Run sequentially to avoid resource contention
  workers: 1, // Focus on perfect rendering one screen at a time
  reporter: 'list', // Just output progress to console
  use: {
    actionTimeout: 0,
    baseURL: 'http://localhost:3000',
    /* Ensure no video or tracing pollutes the screenshot run */
    video: 'off',
    trace: 'off',
  },

  /* Projects define the exact viewports required for the marketing assets */
  projects: [
    {
      name: 'Marketing Desktop',
      use: { 
        ...devices['Desktop Chrome'],
        // 16-inch MacBook Pro Native Resolution
        viewport: { width: 2560, height: 1600 },
        deviceScaleFactor: 2, // High DPI for retina sharpness
      },
    },
    {
      name: 'Marketing Mobile',
      use: { 
        ...devices['iPhone 15 Pro'],
        // iPhone 15 Pro Logical Resolution is 393x852, but we want the massive physical resolution 1290x2796
        // To achieve exactly 1290x2796, we use logical viewport and scale factor:
        viewport: { width: 430, height: 932 },
        deviceScaleFactor: 3, 
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});

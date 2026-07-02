import { test, expect } from '@playwright/test';
import { captureShot } from './utils/marketing-helpers.js';
import testData from './fixtures/transportData.json' with { type: "json" };

const MOBILE_VIEWPORT = { width: 1290, height: 2796 }; // iPhone 15 Pro
const DESKTOP_VIEWPORT = { width: 2560, height: 1600 }; // 16" MacBook Pro

test.describe('PASADA Marketing Screenshots - Mobile Apps', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test('Capture Passenger App Flows', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Marketing Mobile', 'Only run on Mobile');
    await page.goto('/');
    await captureShot(page, 'auth', 'mobile-role-select');

    await page.getByTestId('role-passenger').click();
    await captureShot(page, 'auth', 'mobile-passenger-login');

    await page.getByTestId('login-email').fill(testData.passenger.email);
    await page.getByTestId('login-password').fill(testData.passenger.password);
    await page.getByTestId('login-submit').click();
    
    await page.waitForURL('**/passenger');
    await captureShot(page, 'passenger', 'mobile-home-hero');

    const searchInput = page.getByTestId('search-destination');
    await searchInput.click();
    await searchInput.fill("Lumban");
    await captureShot(page, 'passenger', 'mobile-searching');

    const stopResult = page.getByRole('button', { name: 'Lumban', exact: true }).first();
    await stopResult.click();
    await captureShot(page, 'passenger', 'mobile-route-selected');

    await page.getByTestId('join-queue-btn').click();
    await captureShot(page, 'passenger', 'mobile-queue-waiting');

    await page.getByTestId('boarded-btn').click();
    await captureShot(page, 'passenger', 'mobile-riding-tracking');
    
    const profileTab = page.getByTestId('tab-profile');
    if (await profileTab.isVisible()) {
      await profileTab.click();
      await captureShot(page, 'passenger', 'mobile-profile');
    }
  });

  test('Capture Driver App Flows', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Marketing Mobile', 'Only run on Mobile');
    await page.goto('/');
    
    await page.getByTestId('role-driver').click();
    await captureShot(page, 'auth', 'mobile-driver-login');

    await page.getByTestId('driver-id-input').fill(testData.driver.id);
    await page.getByTestId('driver-pin-input').fill(testData.driver.pin);
    await page.getByTestId('driver-login-submit').click();
    
    await page.waitForURL('**/driver');
    await captureShot(page, 'driver', 'mobile-dashboard-hero');

    // Start Shift / Trip
    const startTripBtn = page.getByTestId('start-trip-btn');
    try {
      await startTripBtn.waitFor({ state: 'visible', timeout: 3000 });
      await startTripBtn.click();
      await page.waitForTimeout(2000); // Wait for routing to initialize
      await captureShot(page, 'driver', 'mobile-dashboard-active-trip');
    } catch {
      console.log("Trip already active, skipping start");
    }

    await page.getByTestId('update-occupancy-btn').click();
    await captureShot(page, 'driver', 'mobile-occupancy-modal');

    await page.getByRole('button', { name: 'HALF FULL', exact: false }).first().click();
    await captureShot(page, 'driver', 'mobile-occupancy-half-full');

    await page.getByRole('button', { name: 'Save Occupancy' }).click();

    const tripsTab = page.getByTestId('tab-trips');
    if (await tripsTab.isVisible()) {
      await tripsTab.click();
      await captureShot(page, 'driver', 'mobile-trips-log');
    }

    const earningsTab = page.getByTestId('tab-earnings');
    if (await earningsTab.isVisible()) {
      await earningsTab.click();
      await captureShot(page, 'driver', 'mobile-earnings-report');
    }
  });
});

test.describe('PASADA Marketing Screenshots - Web Portals', () => {
  test.skip(({ browserName, project }) => project.name !== 'Marketing Desktop', 'Only run on Desktop');
  test.use({ viewport: DESKTOP_VIEWPORT });

  test('Capture Admin / TOC Dashboard', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('role-admin').click();
    await captureShot(page, 'auth', 'desktop-admin-login');

    await page.getByTestId('login-email').fill(testData.admin.email);
    await page.getByTestId('login-password').fill(testData.admin.password);
    await page.getByTestId('login-submit').click();
    
    await page.waitForURL('**/admin');
    await captureShot(page, 'cooperative', 'desktop-live-operations-hero');

    const tabsToShow = [
      { name: 'Fleet Management', file: 'desktop-fleet-management' },
      { name: 'Drivers', file: 'desktop-drivers-directory' },
      { name: 'Routes', file: 'desktop-routes-management' },
      { name: 'Passenger Demand', file: 'desktop-passenger-demand-heatmap' },
      { name: 'Analytics', file: 'desktop-analytics-dashboard' },
      { name: 'Settings', file: 'desktop-settings' }
    ];

    for (const tab of tabsToShow) {
      const tabButton = page.getByRole('button', { name: tab.name, exact: true }).first();
      if (await tabButton.isVisible()) {
        await tabButton.click();
        await captureShot(page, 'cooperative', tab.file);
      }
    }
  });
});

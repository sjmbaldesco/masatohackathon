import { test, expect } from '@playwright/test';
import { dramaticPause, humanType, humanClick } from './utils/cinematic.js';
import testData from './fixtures/transportData.json' with { type: "json" };

test.describe('PASADA Cinematic Product Demonstration', () => {

  test('1. Passenger Journey: Find Route and Join Smart Queue', async ({ page }) => {
    // Navigate to app
    await page.goto('/');
    await dramaticPause(page, 1500); // Let splash/onboarding shine

    // Select Passenger Role
    const passengerCard = page.getByTestId('role-passenger');
    await humanClick(page, passengerCard);
    await dramaticPause(page, 1000);

    // Login
    await humanType(page.getByTestId('login-email'), testData.passenger.email);
    await dramaticPause(page, 500);
    await humanType(page.getByTestId('login-password'), testData.passenger.password);
    await dramaticPause(page, 1000);
    await humanClick(page, page.getByTestId('login-submit'));
    
    // Wait for dashboard to load
    await page.waitForURL('**/passenger');
    await dramaticPause(page, 2000); // Let user absorb the home screen map

    // Search for destination
    const searchInput = page.getByTestId('search-destination');
    await humanClick(page, searchInput);
    await dramaticPause(page, 500);
    await humanType(searchInput, "Lumban");
    await dramaticPause(page, 1500); // Pause to show the dropdown list

    // Select the exact stop result to prevent clicking the route label by mistake
    const stopResult = page.getByRole('button', { name: 'Lumban', exact: true }).first();
    await humanClick(page, stopResult);
    await dramaticPause(page, 2000); // Watch map pan and ETA recalculate

    // Join Queue
    const joinQueueBtn = page.getByTestId('join-queue-btn');
    await humanClick(page, joinQueueBtn);
    await dramaticPause(page, 4000); // Admire the "Arriving Now" pulse effect

    // Board the Jeepney
    const boardedBtn = page.getByTestId('boarded-btn');
    await humanClick(page, boardedBtn);
    await dramaticPause(page, 4000); // Admire the Riding dashboard and live map tracking
    
    // View Profile Tab
    const profileTab = page.getByTestId('tab-profile');
    await humanClick(page, profileTab);
    await dramaticPause(page, 2000);
  });

  test('2. Driver Journey: Shift Start and Occupancy Management', async ({ page }) => {
    await page.goto('/');
    await dramaticPause(page, 1000);

    // Select Driver Role
    const driverCard = page.getByTestId('role-driver');
    await humanClick(page, driverCard);
    await dramaticPause(page, 1000);

    // Driver Login
    await humanType(page.getByTestId('driver-id-input'), testData.driver.id);
    await dramaticPause(page, 500);
    await humanType(page.getByTestId('driver-pin-input'), testData.driver.pin);
    await dramaticPause(page, 1000);
    await humanClick(page, page.getByTestId('driver-login-submit'));
    
    // Wait for driver dashboard
    await page.waitForURL('**/driver');
    await dramaticPause(page, 2500); // Absorb the departure recommendations UI

    // Start Shift
    const startTripBtn = page.getByTestId('start-trip-btn');
    try {
      await startTripBtn.waitFor({ state: 'visible', timeout: 3000 });
      await humanClick(page, startTripBtn);
      await dramaticPause(page, 2000); // Map centers, routing begins
    } catch {
      console.log("Trip already active, skipping start click");
    }

    // Update Occupancy
    const updateOccBtn = page.getByTestId('update-occupancy-btn');
    await humanClick(page, updateOccBtn);
    await dramaticPause(page, 1000);
    
    // Click through occupancy percentages to show the ring animation
    const percentages = ['EMPTY', 'QUARTER', 'HALF FULL', 'ALMOST FULL'];
    for (const pct of percentages) {
      const occBtn = page.getByRole('button', { name: pct, exact: false }).first();
      await humanClick(page, occBtn);
      await dramaticPause(page, 1000); // Let the ring animate
    }

    // Save Occupancy
    const saveBtn = page.getByRole('button', { name: 'Save Occupancy' });
    await humanClick(page, saveBtn);
    await dramaticPause(page, 1000);

    // Show off Trips and Earnings Tabs
    const tripsTab = page.getByTestId('tab-trips');
    if (await tripsTab.isVisible()) {
      await humanClick(page, tripsTab);
      await dramaticPause(page, 2000);
    }
    const earningsTab = page.getByTestId('tab-earnings');
    if (await earningsTab.isVisible()) {
      await humanClick(page, earningsTab);
      await dramaticPause(page, 2000);
    }
    const homeTab = page.getByTestId('tab-home');
    if (await homeTab.isVisible()) {
      await humanClick(page, homeTab);
      await dramaticPause(page, 1000);
    }
    
    // End Shift
    // (Assuming modal closed)
    const endTripBtn = page.getByTestId('end-trip-btn');
    if (await endTripBtn.isVisible()) {
      await humanClick(page, endTripBtn);
      await dramaticPause(page, 2000); // Wait to admire the end of route summary

      const ackBtn = page.getByTestId('end-summary-ack-btn');
      await humanClick(page, ackBtn);
      await dramaticPause(page, 1500);
    }
  });

  test('3. Transport Operations Center (Admin): Live Monitoring', async ({ page }) => {
    await page.goto('/');
    await dramaticPause(page, 1000);

    // Select Admin Role
    const adminCard = page.getByTestId('role-admin');
    await humanClick(page, adminCard);
    await dramaticPause(page, 1000);

    // Admin Login
    await humanType(page.getByTestId('login-email'), testData.admin.email);
    await dramaticPause(page, 500);
    await humanType(page.getByTestId('login-password'), testData.admin.password);
    await dramaticPause(page, 1000);
    await humanClick(page, page.getByTestId('login-submit'));
    
    // Wait for TOC dashboard
    await page.waitForURL('**/admin');
    await dramaticPause(page, 3000); // Show the full fleet monitoring view

    // Navigate through all tabs to show the full suite
    const tabsToShow = [
      'Live Operations',
      'Fleet Management',
      'Drivers',
      'Routes',
      'Passenger Demand',
      'Analytics',
      'Settings'
    ];

    for (const tabName of tabsToShow) {
      const tabButton = page.getByRole('button', { name: tabName, exact: true }).first();
      if (await tabButton.isVisible()) {
        await humanClick(page, tabButton);
        await dramaticPause(page, 2000); // Absorb each view
      }
    }
  });

});

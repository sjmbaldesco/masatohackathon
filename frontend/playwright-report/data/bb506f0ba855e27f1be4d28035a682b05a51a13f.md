# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: demo.spec.js >> PASADA Cinematic Product Demonstration >> 3. Transport Operations Center (Admin): Live Monitoring
- Location: tests\demo.spec.js:134:3

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/
Call log:
  - navigating to "http://localhost:3000/", waiting until "load"

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e6]:
    - heading "This site can’t be reached" [level=1] [ref=e7]
    - paragraph [ref=e8]:
      - strong [ref=e9]: localhost
      - text: refused to connect.
    - generic [ref=e10]:
      - paragraph [ref=e11]: "Try:"
      - list [ref=e12]:
        - listitem [ref=e13]: Checking the connection
        - listitem [ref=e14]:
          - link "Checking the proxy and the firewall" [ref=e15] [cursor=pointer]:
            - /url: "#buttons"
    - generic [ref=e16]: ERR_CONNECTION_REFUSED
  - generic [ref=e17]:
    - button "Reload" [ref=e19] [cursor=pointer]
    - button "Details" [ref=e20] [cursor=pointer]
```

# Test source

```ts
  35  |     // Select the exact stop result to prevent clicking the route label by mistake
  36  |     const stopResult = page.getByRole('button', { name: 'Lumban', exact: true }).first();
  37  |     await humanClick(page, stopResult);
  38  |     await dramaticPause(page, 2000); // Watch map pan and ETA recalculate
  39  | 
  40  |     // Join Queue
  41  |     const joinQueueBtn = page.getByTestId('join-queue-btn');
  42  |     await humanClick(page, joinQueueBtn);
  43  |     await dramaticPause(page, 4000); // Admire the "Arriving Now" pulse effect
  44  | 
  45  |     // Board the Jeepney
  46  |     const boardedBtn = page.getByTestId('boarded-btn');
  47  |     await humanClick(page, boardedBtn);
  48  |     await dramaticPause(page, 4000); // Admire the Riding dashboard and live map tracking
  49  |     
  50  |     // View Profile Tab
  51  |     const profileTab = page.getByTestId('tab-profile');
  52  |     await humanClick(page, profileTab);
  53  |     await dramaticPause(page, 2000);
  54  |   });
  55  | 
  56  |   test('2. Driver Journey: Shift Start and Occupancy Management', async ({ page }) => {
  57  |     await page.goto('/');
  58  |     await dramaticPause(page, 1000);
  59  | 
  60  |     // Select Driver Role
  61  |     const driverCard = page.getByTestId('role-driver');
  62  |     await humanClick(page, driverCard);
  63  |     await dramaticPause(page, 1000);
  64  | 
  65  |     // Driver Login
  66  |     await humanType(page.getByTestId('driver-id-input'), testData.driver.id);
  67  |     await dramaticPause(page, 500);
  68  |     await humanType(page.getByTestId('driver-pin-input'), testData.driver.pin);
  69  |     await dramaticPause(page, 1000);
  70  |     await humanClick(page, page.getByTestId('driver-login-submit'));
  71  |     
  72  |     // Wait for driver dashboard
  73  |     await page.waitForURL('**/driver');
  74  |     await dramaticPause(page, 2500); // Absorb the departure recommendations UI
  75  | 
  76  |     // Start Shift
  77  |     const startTripBtn = page.getByTestId('start-trip-btn');
  78  |     try {
  79  |       await startTripBtn.waitFor({ state: 'visible', timeout: 3000 });
  80  |       await humanClick(page, startTripBtn);
  81  |       await dramaticPause(page, 2000); // Map centers, routing begins
  82  |     } catch {
  83  |       console.log("Trip already active, skipping start click");
  84  |     }
  85  | 
  86  |     // Update Occupancy
  87  |     const updateOccBtn = page.getByTestId('update-occupancy-btn');
  88  |     await humanClick(page, updateOccBtn);
  89  |     await dramaticPause(page, 1000);
  90  |     
  91  |     // Click through occupancy percentages to show the ring animation
  92  |     const percentages = ['EMPTY', 'QUARTER', 'HALF FULL', 'ALMOST FULL'];
  93  |     for (const pct of percentages) {
  94  |       const occBtn = page.getByRole('button', { name: pct, exact: false }).first();
  95  |       await humanClick(page, occBtn);
  96  |       await dramaticPause(page, 1000); // Let the ring animate
  97  |     }
  98  | 
  99  |     // Save Occupancy
  100 |     const saveBtn = page.getByRole('button', { name: 'Save Occupancy' });
  101 |     await humanClick(page, saveBtn);
  102 |     await dramaticPause(page, 1000);
  103 | 
  104 |     // Show off Trips and Earnings Tabs
  105 |     const tripsTab = page.getByTestId('tab-trips');
  106 |     if (await tripsTab.isVisible()) {
  107 |       await humanClick(page, tripsTab);
  108 |       await dramaticPause(page, 2000);
  109 |     }
  110 |     const earningsTab = page.getByTestId('tab-earnings');
  111 |     if (await earningsTab.isVisible()) {
  112 |       await humanClick(page, earningsTab);
  113 |       await dramaticPause(page, 2000);
  114 |     }
  115 |     const homeTab = page.getByTestId('tab-home');
  116 |     if (await homeTab.isVisible()) {
  117 |       await humanClick(page, homeTab);
  118 |       await dramaticPause(page, 1000);
  119 |     }
  120 |     
  121 |     // End Shift
  122 |     // (Assuming modal closed)
  123 |     const endTripBtn = page.getByTestId('end-trip-btn');
  124 |     if (await endTripBtn.isVisible()) {
  125 |       await humanClick(page, endTripBtn);
  126 |       await dramaticPause(page, 2000); // Wait to admire the end of route summary
  127 | 
  128 |       const ackBtn = page.getByTestId('end-summary-ack-btn');
  129 |       await humanClick(page, ackBtn);
  130 |       await dramaticPause(page, 1500);
  131 |     }
  132 |   });
  133 | 
  134 |   test('3. Transport Operations Center (Admin): Live Monitoring', async ({ page }) => {
> 135 |     await page.goto('/');
      |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/
  136 |     await dramaticPause(page, 1000);
  137 | 
  138 |     // Select Admin Role
  139 |     const adminCard = page.getByTestId('role-admin');
  140 |     await humanClick(page, adminCard);
  141 |     await dramaticPause(page, 1000);
  142 | 
  143 |     // Admin Login
  144 |     await humanType(page.getByTestId('login-email'), testData.admin.email);
  145 |     await dramaticPause(page, 500);
  146 |     await humanType(page.getByTestId('login-password'), testData.admin.password);
  147 |     await dramaticPause(page, 1000);
  148 |     await humanClick(page, page.getByTestId('login-submit'));
  149 |     
  150 |     // Wait for TOC dashboard
  151 |     await page.waitForURL('**/admin');
  152 |     await dramaticPause(page, 3000); // Show the full fleet monitoring view
  153 | 
  154 |     // Navigate through all tabs to show the full suite
  155 |     const tabsToShow = [
  156 |       'Live Operations',
  157 |       'Fleet Management',
  158 |       'Drivers',
  159 |       'Routes',
  160 |       'Passenger Demand',
  161 |       'Analytics',
  162 |       'Settings'
  163 |     ];
  164 | 
  165 |     for (const tabName of tabsToShow) {
  166 |       const tabButton = page.getByRole('button', { name: tabName, exact: true }).first();
  167 |       if (await tabButton.isVisible()) {
  168 |         await humanClick(page, tabButton);
  169 |         await dramaticPause(page, 2000); // Absorb each view
  170 |       }
  171 |     }
  172 |   });
  173 | 
  174 | });
  175 | 
```
# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: demo.spec.js >> PASADA Cinematic Product Demonstration >> 2. Driver Journey: Shift Start and Occupancy Management
- Location: tests\demo.spec.js:56:3

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: locator.boundingBox: Test timeout of 120000ms exceeded.
Call log:
  - waiting for getByTestId('update-occupancy-btn')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e7]:
      - generic:
        - button "Keyboard shortcuts"
      - region "Map" [ref=e8]
      - generic [ref=e9]:
        - iframe [ref=e23]:
          
        - link "Open this area in Google Maps (opens a new window)" [ref=e25] [cursor=pointer]:
          - /url: https://maps.google.com/maps?ll=14.298578,121.463483&z=14&t=m&hl=en-US&gl=US&mapclient=apiv3
          - img "Google" [ref=e27]
        - generic [ref=e28]:
          - button "Keyboard shortcuts" [ref=e34] [cursor=pointer]
          - generic [ref=e39]: Map Data ©2026
          - link "Terms (opens in new tab)" [ref=e44] [cursor=pointer]:
            - /url: https://www.google.com/intl/en-US_US/help/terms_maps.html
            - text: Terms
          - link "Report a map error (opens in new tab)" [ref=e49] [cursor=pointer]:
            - /url: https://www.google.com/maps/@14.2985776,121.4634832,14z/data=!10m1!1e1!12b1?source=apiv3&rapsrc=apiv3
            - text: Report a map error
    - generic [ref=e53]: Driver · ABC 1234
    - generic [ref=e54]:
      - generic [ref=e55]:
        - paragraph [ref=e56]: Route
        - paragraph [ref=e57]: Lumban → Sta. Cruz
      - generic [ref=e58]:
        - generic [ref=e59]:
          - img [ref=e60]
          - generic [ref=e65]: 0/18
          - generic [ref=e66]: Onboard
        - generic [ref=e67]:
          - img [ref=e68]
          - generic [ref=e71]: 0 km/h
          - generic [ref=e72]: Speed
        - generic [ref=e73]:
          - img [ref=e74]
          - generic [ref=e77]: —
          - generic [ref=e78]: Stop
      - generic [ref=e79]:
        - img [ref=e80]
        - generic [ref=e82]: 20 passengers waiting on route
      - generic [ref=e84]:
        - generic [ref=e85]:
          - generic [ref=e86]: Departure Confidence
          - button "↻ Refresh" [ref=e87] [cursor=pointer]
        - paragraph [ref=e88]: Backend unavailable — score not loaded.
      - generic [ref=e89]:
        - button "Update Occupancy" [ref=e90] [cursor=pointer]
        - button "Start Trip" [ref=e91] [cursor=pointer]
  - navigation [ref=e92]:
    - button "HOME" [ref=e93] [cursor=pointer]:
      - img [ref=e94]
      - generic [ref=e97]: HOME
    - button "TRIPS" [ref=e98] [cursor=pointer]:
      - img [ref=e99]
      - generic [ref=e101]: TRIPS
    - button "EARNINGS" [ref=e102] [cursor=pointer]:
      - img [ref=e103]
      - generic [ref=e105]: EARNINGS
    - button "MORE" [ref=e106] [cursor=pointer]:
      - img [ref=e107]
      - generic [ref=e111]: MORE
```

# Test source

```ts
  1  | export async function dramaticPause(page, ms) {
  2  |   await page.waitForTimeout(ms);
  3  | }
  4  | 
  5  | export async function humanType(locator, text) {
  6  |   // Simulate variable human typing speeds
  7  |   for (const char of text) {
  8  |     await locator.type(char, { delay: Math.random() * 50 + 50 }); // 50-100ms per char
  9  |   }
  10 | }
  11 | 
  12 | // Moves mouse more organically using Playwright's built-in steps
  13 | export async function curvedMouseMove(page, x, y, steps = 15) {
  14 |   await page.mouse.move(x, y, { steps });
  15 | }
  16 | 
  17 | // Utility to hover over an element and then click, rather than instant click
  18 | export async function humanClick(page, locator) {
> 19 |   const box = await locator.boundingBox();
     |                             ^ Error: locator.boundingBox: Test timeout of 120000ms exceeded.
  20 |   if (box) {
  21 |     const targetX = box.x + box.width / 2;
  22 |     const targetY = box.y + box.height / 2;
  23 |     await curvedMouseMove(page, targetX, targetY);
  24 |     await dramaticPause(page, 200); // intentional pause before clicking
  25 |     await page.mouse.click(targetX, targetY);
  26 |   } else {
  27 |     // Fallback if bounding box isn't ready
  28 |     await locator.click();
  29 |   }
  30 | }
  31 | 
```
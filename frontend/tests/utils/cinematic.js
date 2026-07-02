export async function dramaticPause(page, ms) {
  await page.waitForTimeout(ms);
}

export async function humanType(locator, text) {
  // Simulate variable human typing speeds
  for (const char of text) {
    await locator.type(char, { delay: Math.random() * 50 + 50 }); // 50-100ms per char
  }
}

// Moves mouse more organically using Playwright's built-in steps
export async function curvedMouseMove(page, x, y, steps = 15) {
  await page.mouse.move(x, y, { steps });
}

// Utility to hover over an element and then click, rather than instant click
export async function humanClick(page, locator) {
  const box = await locator.boundingBox();
  if (box) {
    const targetX = box.x + box.width / 2;
    const targetY = box.y + box.height / 2;
    await curvedMouseMove(page, targetX, targetY);
    await dramaticPause(page, 200); // intentional pause before clicking
    await page.mouse.click(targetX, targetY);
  } else {
    // Fallback if bounding box isn't ready
    await locator.click();
  }
}

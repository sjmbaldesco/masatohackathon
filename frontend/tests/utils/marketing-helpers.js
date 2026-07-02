import fs from 'fs';
import path from 'path';

/**
 * Prepares the page for a cinematic screenshot by hiding scrollbars, 
 * waiting for fonts/images, and ensuring network stability.
 */
export async function prepareForShot(page) {
  // Wait for major network activity to settle
  await page.waitForLoadState('networkidle');

  // Inject CSS to completely hide scrollbars and cursor
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      ::-webkit-scrollbar { display: none !important; }
      * { scrollbar-width: none !important; cursor: none !important; }
      body { -ms-overflow-style: none !important; }
    `;
    document.head.appendChild(style);
  });

  // Wait for all web fonts to load
  await page.evaluate(() => document.fonts.ready);

  // Allow time for React/Framer Motion animations to settle
  await page.waitForTimeout(2000); 
}

/**
 * Captures an ultra-high resolution PNG lossless screenshot.
 */
export async function captureShot(page, category, filename) {
  await prepareForShot(page);
  
  const dir = path.join(process.cwd(), 'screenshots', category);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filepath = path.join(dir, `${filename}.png`);
  
  await page.screenshot({ 
    path: filepath,
    fullPage: false,
    animations: 'disabled',
    type: 'png'
  });
  
  console.log(`📸 Captured: ${category}/${filename}.png`);
}

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire('/home/user/beme/design-mockups/');
const { chromium } = require('playwright');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = 'file://' + path.join(__dirname, 'workout-designs.html');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1760, height: 1200 }, deviceScaleFactor: 2 });
await page.goto(file, { waitUntil: 'networkidle' });
// ensure fonts are ready
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(800);

for (let i = 1; i <= 5; i++) {
  const el = page.locator(`#design-${i}`);
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  const out = path.join(__dirname, `design-${i}.png`);
  await el.screenshot({ path: out });
  console.log('saved', out);
}

await browser.close();
console.log('done');

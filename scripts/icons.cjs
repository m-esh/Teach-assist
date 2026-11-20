// Renders public/icon.svg to the PNG sizes iOS and the manifest need.
// Run: node scripts/icons.cjs   (needs Playwright with Chromium installed)
const { chromium } = require('playwright');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

(async () => {
  const pub = join(__dirname, '..', 'public');
  // iOS rounds the corners itself, so the PNGs are full-bleed squares.
  const svg = readFileSync(join(pub, 'icon.svg'), 'utf8').replace('rx="112"', 'rx="0"');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [size, name] of [[180, 'apple-touch-icon.png'], [192, 'icon-192.png'], [512, 'icon-512.png']]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
    await page.screenshot({ path: join(pub, name) });
  }
  await browser.close();
})();

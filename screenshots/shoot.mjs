// Screenshots the mockup and the live app at 1440x900, full-page, for visual comparison.
// Usage: node shoot.mjs <live-url> <mockup-path> <out-dir> <suffix>
import { chromium } from 'playwright';
import path from 'node:path';

const [, , liveUrl, mockupPath, outDir, suffix] = process.argv;
if (!liveUrl || !mockupPath || !outDir || !suffix) {
  console.error('Usage: node shoot.mjs <live-url> <mockup-path> <out-dir> <suffix>');
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// Fonts load from Google Fonts over the network — give both pages a moment
// after load so Inter/Plus Jakarta Sans are actually painted, not fallback.
async function shoot(url, outFile) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: outFile, fullPage: true });
  console.log('saved', outFile);
}

await shoot('file://' + path.resolve(mockupPath), path.join(outDir, `mockup-${suffix}.png`));
await shoot(liveUrl, path.join(outDir, `live-${suffix}.png`));

await browser.close();

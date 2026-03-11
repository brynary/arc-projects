// Quick test: Verify driving feel on multiple tracks (Neon Grid + Volcano Peak)
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu'] });
  const errors = [];

  for (const trackIdx of [2, 3]) { // Neon Grid, Volcano Peak
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', e => errors.push(`Track${trackIdx}: ${e.message}`));

    await page.goto('http://localhost:4567/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Navigate to race
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Select track by clicking the card
    const cards = await page.$$('.card');
    if (cards[trackIdx]) await cards[trackIdx].click();
    await page.waitForTimeout(200);

    const nextBtn1 = await page.$('.menu-btn');
    if (nextBtn1) await nextBtn1.click();
    await page.waitForTimeout(500);

    const nextBtn2 = await page.$('.menu-btn');
    if (nextBtn2) await nextBtn2.click();
    await page.waitForTimeout(500);

    const startBtn = await page.$('#ds-start');
    if (startBtn) await startBtn.click();
    await page.waitForTimeout(5500);

    // Drive + drift test
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(3000);

    // Drift left
    await page.keyboard.down('KeyA');
    await page.waitForTimeout(200);
    await page.keyboard.down('ShiftLeft');
    await page.waitForTimeout(2000);
    await page.keyboard.up('ShiftLeft');
    await page.keyboard.up('KeyA');
    await page.waitForTimeout(1000);

    // Drift right
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(200);
    await page.keyboard.down('ShiftLeft');
    await page.waitForTimeout(2000);
    await page.keyboard.up('ShiftLeft');
    await page.keyboard.up('KeyD');
    await page.waitForTimeout(1000);

    await page.screenshot({ path: `test_ss_track${trackIdx}.png` });
    console.log(`Track ${trackIdx}: OK`);

    await page.close();
  }

  console.log(`\nTotal errors: ${errors.length}`);
  if (errors.length > 0) errors.forEach(e => console.log('  ERROR:', e));
  else console.log('All tracks clean!');

  await browser.close();
  process.exit(errors.length > 0 ? 1 : 0);
})();

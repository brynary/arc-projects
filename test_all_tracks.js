// Verify all 4 tracks load with zero errors after driving feel changes
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const allErrors = [];

  for (let trackIdx = 0; trackIdx < 4; trackIdx++) {
    const trackNames = ['Sunset Bay', 'Mossy Canyon', 'Neon Grid', 'Volcano Peak'];
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto('http://localhost:4567/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1500);

    // Title → Track select
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);

    // Select specific track
    const cards = await page.$$('.card');
    if (cards[trackIdx]) await cards[trackIdx].click();
    await page.waitForTimeout(200);

    // Next → Char select
    await page.click('.menu-btn');
    await page.waitForTimeout(400);

    // Next → Diff select
    await page.click('.menu-btn');
    await page.waitForTimeout(400);

    // Start race
    await page.click('#ds-start');
    await page.waitForTimeout(8000); // countdown

    // Drive for a few seconds
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(3000);
    await page.keyboard.up('KeyW');

    // Check state
    const check = await page.evaluate(() => {
      const karts = window.__allKarts;
      if (!karts) return { ok: false };
      let nanFound = false;
      for (const k of karts) {
        if (isNaN(k.pitchAngle) || isNaN(k.offroadBobPhase) || isNaN(k.tiltAngle) || isNaN(k.speed)) {
          nanFound = true;
        }
      }
      const pk = karts[0];
      return {
        ok: !nanFound,
        speed: pk?.speed?.toFixed(1),
        racing: karts.filter(k => Math.abs(k.speed) > 1).length,
        total: karts.length,
      };
    });

    const status = errors.length === 0 && check.ok ? '✅' : '❌';
    console.log(`${status} ${trackNames[trackIdx]}: ${check.racing}/${check.total} racing, speed=${check.speed}, errors=${errors.length}`);
    if (errors.length > 0) {
      allErrors.push(...errors.map(e => `[${trackNames[trackIdx]}] ${e}`));
      console.log('  Errors:', errors);
    }

    page.removeAllListeners('pageerror');
  }

  await browser.close();
  console.log('\nTotal errors:', allErrors.length === 0 ? '✅ None' : allErrors.length);
  process.exit(allErrors.length > 0 ? 1 : 0);
})();

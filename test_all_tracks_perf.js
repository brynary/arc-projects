// Multi-track validation: load each track, race briefly, check for errors
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const tracks = ['Sunset Bay', 'Mossy Canyon', 'Neon Grid', 'Volcano Peak'];
  let allPassed = true;

  for (let ti = 0; ti < tracks.length; ti++) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('http://localhost:4567/', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);

    // Navigate to race
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);

    // Select track index ti
    const cards = await page.$$('.card');
    if (cards[ti]) await cards[ti].click();
    await page.waitForTimeout(200);
    await page.click('#ts-next');
    await page.waitForTimeout(400);
    await page.click('.card');
    await page.waitForTimeout(200);
    await page.click('#cs-next');
    await page.waitForTimeout(400);
    await page.click('#ds-start');
    
    // Wait for countdown + some racing
    await page.waitForTimeout(8000);
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(4000);
    
    const result = await page.evaluate(() => {
      return {
        status: window.__raceState?.status,
        time: window.__raceState?.raceTime?.toFixed(1),
        karts: window.__allKarts?.length,
        speeds: window.__allKarts?.map(k => Math.round(k.speed)),
        anyNaN: window.__allKarts?.some(k => isNaN(k.speed) || isNaN(k.position.x)),
      };
    });

    await page.keyboard.up('ArrowUp');
    
    const trackOk = result.status === 'racing' && result.karts === 8 && !result.anyNaN && errors.length === 0;
    console.log(`${tracks[ti]}: ${trackOk ? '✅' : '❌'} status=${result.status} karts=${result.karts} time=${result.time} errors=${errors.length}`);
    if (errors.length > 0) errors.forEach(e => console.log(`  ERROR: ${e}`));
    if (!trackOk) allPassed = false;

    await page.close();
  }

  console.log(allPassed ? '\n✅ ALL 4 TRACKS PASSED' : '\n❌ SOME TRACKS FAILED');
  await browser.close();
  process.exit(allPassed ? 0 : 1);
})();

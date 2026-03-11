// Playwright test: verify all 4 tracks load without errors
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  
  const tracks = [0, 1, 2, 3];
  const trackNames = ['Sunset Bay', 'Mossy Canyon', 'Neon Grid', 'Volcano Peak'];
  let allPassed = true;

  for (const trackIdx of tracks) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto('http://localhost:4567/', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);

    // Navigate to race start
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);

    // Select track
    const cards = await page.$$('.card');
    if (cards[trackIdx]) await cards[trackIdx].click();
    await page.waitForTimeout(200);
    await page.click('#ts-next');
    await page.waitForTimeout(300);
    await page.click('#cs-next');
    await page.waitForTimeout(300);
    await page.click('#ds-start');
    
    // Wait for countdown + race start
    await page.waitForTimeout(7000);
    
    // Drive for a few seconds
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(3000);
    await page.keyboard.up('ArrowUp');

    // Check state
    const result = await page.evaluate(() => {
      const karts = window.__allKarts;
      const rs = window.__raceState;
      return {
        kartCount: karts?.length || 0,
        raceStatus: rs?.status || 'unknown',
        playerSpeed: karts?.[0]?.speed?.toFixed(1) || 'N/A',
        playerPos: karts?.[0] ? `(${karts[0].position.x.toFixed(0)}, ${karts[0].position.z.toFixed(0)})` : 'N/A',
      };
    });

    const trackOk = errors.length === 0 && result.kartCount === 8;
    console.log(`${trackNames[trackIdx]}: ${trackOk ? 'PASS' : 'FAIL'} — ${result.kartCount}/8 karts, status=${result.raceStatus}, speed=${result.playerSpeed}, pos=${result.playerPos}${errors.length > 0 ? ', errors: ' + errors.join('; ') : ''}`);
    
    if (!trackOk) allPassed = false;
    await page.close();
  }

  await browser.close();
  console.log(allPassed ? '\nAll tracks PASS' : '\nSome tracks FAILED');
  process.exit(allPassed ? 0 : 1);
})();

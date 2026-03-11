// Quick test: verify flyover + countdown timing and all 4 tracks
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('http://localhost:4567/', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);

  const tracks = ['Sunset Bay', 'Mossy Canyon', 'Neon Grid', 'Volcano Peak'];
  
  for (let ti = 0; ti < 4; ti++) {
    console.log(`\n--- Testing Track ${ti}: ${tracks[ti]} ---`);
    
    // Press Enter
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Select track
    const cards = await page.$$('#track-cards .card');
    if (cards[ti]) await cards[ti].click();
    await page.waitForTimeout(200);
    await page.click('#ts-next');
    await page.waitForTimeout(300);
    await page.click('#cs-next');
    await page.waitForTimeout(300);
    await page.click('#ds-start');
    await page.waitForTimeout(200);

    // Check camera mode immediately
    // Take flyover screenshot at 1s
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `test_track${ti}_flyover.png` });

    // Wait for full countdown (6s total from race start, already waited 1.2s)
    await page.waitForTimeout(6000);

    // Check state
    const state = await page.evaluate(() => {
      return {
        status: window.__raceState?.status,
        karts: window.__allKarts?.length,
        playerSpeed: window.__allKarts?.find(k => k.isPlayer)?.speed,
      };
    });
    console.log(`State: ${JSON.stringify(state)}`);

    // Drive for 3s
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(3000);
    await page.keyboard.up('ArrowUp');

    await page.screenshot({ path: `test_track${ti}_racing.png` });

    // Verify spline look-ahead
    const cam = await page.evaluate(() => {
      const p = window.__allKarts?.find(k => k.isPlayer);
      return {
        hasNearest: !!p?._cachedNearest,
        speed: p?.speed?.toFixed(1),
      };
    });
    console.log(`Camera data: ${JSON.stringify(cam)}`);

    // Quit to menu
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const quitBtn = await page.$('[data-act="quit"]');
    if (quitBtn) await quitBtn.click();
    await page.waitForTimeout(500);
  }

  const finalErrors = errors.filter(e => !e.includes('favicon'));
  console.log(`\n=== FINAL: ${finalErrors.length} errors ===`);
  if (finalErrors.length) console.log(finalErrors.join('\n'));
  else console.log('ALL CLEAR — zero errors across all 4 tracks');

  await browser.close();
})();

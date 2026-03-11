// Verify tracks work during active gameplay - run a quick race on each
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('http://localhost:4567', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);

  const tracks = ['Sunset Bay', 'Mossy Canyon', 'Neon Grid', 'Volcano Peak'];

  for (let idx = 0; idx < 4; idx++) {
    console.log(`\n=== ${tracks[idx]} ===`);

    const cards = await page.$$('.card');
    if (cards[idx]) await cards[idx].click();
    await page.waitForTimeout(200);
    await page.click('#ts-next');
    await page.waitForTimeout(200);
    await page.click('#cs-next');
    await page.waitForTimeout(200);
    await page.click('#ds-start');
    
    // Wait for countdown to finish
    await page.waitForTimeout(8000);

    // Drive forward for 10 seconds
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(10000);
    await page.keyboard.up('ArrowUp');

    const result = await page.evaluate(() => {
      const td = window.__trackData;
      const karts = window.__allKarts;
      const rs = window.__raceState;
      if (!td || !karts) return { error: 'No data' };

      return {
        raceStatus: rs?.status,
        raceTime: rs?.raceTime?.toFixed(1),
        playerPos: karts[0]?.racePosition,
        playerLap: karts[0]?.currentLap,
        playerCP: karts[0]?.lastCheckpoint,
        playerSpeed: karts[0]?.speed?.toFixed(1),
        playerSurface: karts[0]?.surfaceType,
        allKartsAlive: karts.every(k => k.position.y > -50 && k.position.y < 200),
        kartsOnGround: karts.filter(k => k.onGround).length,
        wallCount: td.collisionWalls.length,
        sectorCount: td.sectors.length,
        // Check that no sector is dramatically imbalanced
        sectorSizes: td.sectors.map(s => s.wallIndices.length),
      };
    });

    console.log(JSON.stringify(result, null, 2));
    await page.screenshot({ path: `track_gameplay_${idx}.png` });

    // Quit
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const quitBtn = await page.$('[data-act="quit"]');
    if (quitBtn) await quitBtn.click();
    await page.waitForTimeout(800);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
  }

  console.log('\nConsole errors:', errors.length > 0 ? errors.join('\n') : 'None');
  await browser.close();
})();

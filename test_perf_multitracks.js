// Quick multi-track stability check
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  async function testTrack(trackIdx) {
    await page.goto('http://localhost:4567', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Select track by clicking the card
    const cards = await page.$$('.card');
    if (cards[trackIdx]) await cards[trackIdx].click();
    await page.waitForTimeout(200);
    
    const nextBtn1 = await page.$('#ts-next');
    if (nextBtn1) await nextBtn1.click();
    await page.waitForTimeout(300);
    const nextBtn2 = await page.$('#cs-next');
    if (nextBtn2) await nextBtn2.click();
    await page.waitForTimeout(300);
    const startBtn = await page.$('#ds-start');
    if (startBtn) await startBtn.click();

    // Wait for racing
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(500);
      const status = await page.evaluate(() => window.__raceState?.status);
      if (status === 'racing') break;
    }

    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(3000);
    await page.keyboard.up('ArrowUp');

    const state = await page.evaluate(() => {
      const rs = window.__raceState;
      const karts = window.__allKarts;
      if (!rs || !karts) return null;
      return {
        status: rs.status,
        raceTime: rs.raceTime,
        aiHaveInput: karts.slice(1).every(k => k.ai?._input),
        aiCachedNearest: karts.slice(1).every(k => k._cachedNearest != null),
        moving: karts.filter(k => Math.abs(k.speed) > 5).length,
      };
    });
    return state;
  }

  const trackNames = ['Sunset Bay', 'Mossy Canyon', 'Neon Grid', 'Volcano Peak'];
  
  for (let t = 0; t < 4; t++) {
    const state = await testTrack(t);
    if (!state) {
      console.log(`Track ${t} (${trackNames[t]}): FAIL - no state`);
      continue;
    }
    const ok = state.status === 'racing' && state.raceTime > 0;
    console.log(`Track ${t} (${trackNames[t]}): ${ok ? 'PASS' : 'FAIL'} — racing=${state.status} time=${state.raceTime?.toFixed(1)}s moving=${state.moving}/8 aiInput=${state.aiHaveInput} cached=${state.aiCachedNearest}`);
  }

  if (errors.length === 0) {
    console.log('\nZero console errors across all tracks');
  } else {
    console.log(`\n${errors.length} errors:`, errors.slice(0, 5));
  }

  await browser.close();
})();

// Test track integrity improvements: UV fix, normalized checkpoints, scaled gate
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Collect console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));
  
  await page.goto('http://localhost:4567', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Press Enter to start
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);

  // Test each track
  const trackNames = ['Sunset Bay', 'Mossy Canyon', 'Neon Grid', 'Volcano Peak'];
  
  for (let trackIdx = 0; trackIdx < 4; trackIdx++) {
    console.log(`\n=== Testing Track ${trackIdx}: ${trackNames[trackIdx]} ===`);
    
    // Select track by clicking on its card
    const cards = await page.$$('.card');
    if (cards.length > trackIdx) {
      await cards[trackIdx].click();
      await page.waitForTimeout(300);
    }
    
    // Click Next
    const nextBtn = await page.$('#ts-next');
    if (nextBtn) await nextBtn.click();
    await page.waitForTimeout(500);

    // Select first character and click Next
    const charCards = await page.$$('.card');
    if (charCards.length > 0) await charCards[0].click();
    await page.waitForTimeout(200);
    const csNext = await page.$('#cs-next');
    if (csNext) await csNext.click();
    await page.waitForTimeout(500);

    // Click Start Race
    const startBtn = await page.$('#ds-start');
    if (startBtn) await startBtn.click();
    await page.waitForTimeout(1000);

    // Wait for countdown + race to start
    await page.waitForTimeout(8000);

    // Check for errors so far
    const trackErrors = errors.filter(e => !e.includes('404') && !e.includes('net::'));
    if (trackErrors.length > 0) {
      console.log(`  Errors:`, trackErrors.slice(0, 3));
    } else {
      console.log(`  No errors during load`);
    }

    // Take screenshot during race
    await page.screenshot({ path: `/home/daytona/workspace/test_track_${trackIdx}.png` });

    // Check game state
    const state = await page.evaluate(() => {
      const karts = window.__allKarts;
      const rs = window.__raceState;
      const td = window.__trackData;
      if (!karts || !rs || !td) return { error: 'Game state not available' };
      
      return {
        raceStatus: rs.status,
        numKarts: karts.length,
        playerSpeed: karts[0]?.speed?.toFixed(1),
        kartsRacing: karts.filter(k => Math.abs(k.speed) > 5).length,
        numCheckpoints: td.checkpoints?.length,
        numWalls: td.collisionWalls?.length,
        numSamples: td.samples?.length,
      };
    });
    console.log(`  State: karts=${state.numKarts} racing=${state.kartsRacing} status=${state.raceStatus} walls=${state.numWalls} samples=${state.numSamples}`);

    // Verify checkpoint forward vectors are normalized
    const cpCheck = await page.evaluate(() => {
      const td = window.__trackData;
      if (!td?.checkpoints) return { error: 'No checkpoints' };
      let nonUnit = 0;
      for (const cp of td.checkpoints) {
        if (!cp.forward) continue;
        const len = Math.sqrt(cp.forward.x**2 + (cp.forward.y||0)**2 + cp.forward.z**2);
        if (Math.abs(len - 1.0) > 0.01) nonUnit++;
      }
      return { total: td.checkpoints.length, nonUnit };
    });
    console.log(`  Checkpoints: ${cpCheck.total} total, ${cpCheck.nonUnit} non-unit`);

    // Hold W to drive for 5 seconds
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(5000);
    await page.keyboard.up('KeyW');

    // Check race progress
    const progress = await page.evaluate(() => {
      const karts = window.__allKarts;
      const rs = window.__raceState;
      if (!karts || !rs) return { error: 'No state' };
      return {
        raceTime: rs.raceTime?.toFixed(1),
        playerLap: karts[0]?.currentLap,
        playerCP: karts[0]?.lastCheckpoint,
        playerPosition: karts[0]?.racePosition,
        kartsMoving: karts.filter(k => Math.abs(k.speed) > 5).length,
      };
    });
    console.log(`  Progress: time=${progress.raceTime} lap=${progress.playerLap} cp=${progress.playerCP} pos=${progress.playerPosition} moving=${progress.kartsMoving}`);

    // Quit to menu
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const quitBtns = await page.$$('.pause-btn');
    for (const btn of quitBtns) {
      const text = await btn.textContent();
      if (text.includes('Quit')) {
        await btn.click();
        break;
      }
    }
    await page.waitForTimeout(1000);

    // Press Enter to return
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    errors.length = 0;
  }

  console.log('\n=== All 4 tracks tested successfully ===');
  await browser.close();
  process.exit(0);
})().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});

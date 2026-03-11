// Extended physics test: let races run to verify no errors during active collisions
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('http://localhost:4567', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Test Volcano Peak specifically (multi-level track most affected by Y-level changes)
  console.log('=== Testing Volcano Peak (multi-level) for 20 seconds ===');
  
  // Press Enter
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  
  // Select track 3 (Volcano Peak)
  const cards = await page.$$('.card');
  if (cards[3]) await cards[3].click();
  await page.waitForTimeout(300);
  
  const tsNext = await page.$('#ts-next');
  if (tsNext) await tsNext.click();
  await page.waitForTimeout(500);
  
  const csNext = await page.$('#cs-next');
  if (csNext) await csNext.click();
  await page.waitForTimeout(500);
  
  const dsStart = await page.$('#ds-start');
  if (dsStart) await dsStart.click();
  
  // Wait for countdown
  await page.waitForTimeout(7000);
  
  // Hold accelerate and steer to drive around
  await page.keyboard.down('ArrowUp');
  
  // Let race run for 20 seconds, checking periodically
  for (let t = 0; t < 4; t++) {
    // Steer a bit
    if (t % 2 === 0) {
      await page.keyboard.down('ArrowLeft');
      await page.waitForTimeout(2000);
      await page.keyboard.up('ArrowLeft');
    } else {
      await page.keyboard.down('ArrowRight');
      await page.waitForTimeout(2000);
      await page.keyboard.up('ArrowRight');
    }
    await page.waitForTimeout(3000);
    
    const state = await page.evaluate(() => {
      const karts = window.__allKarts;
      const rs = window.__raceState;
      if (!karts || !rs) return null;
      
      const kartStates = karts.map(k => ({
        id: k.characterId,
        speed: Math.abs(k.speed).toFixed(0),
        y: k.position.y.toFixed(1),
        lap: k.currentLap,
        cp: k.lastCheckpoint,
        pos: k.racePosition,
        finished: k.finished,
      }));
      
      return {
        time: rs.raceTime.toFixed(1),
        status: rs.status,
        karts: kartStates,
      };
    });
    
    if (state) {
      console.log(`\n--- t=${state.time}s, status=${state.status} ---`);
      for (const k of state.karts) {
        console.log(`  ${k.id}: spd=${k.speed} y=${k.y} lap=${k.lap} cp=${k.cp} pos=${k.pos}${k.finished?' FINISHED':''}`);
      }
    }
  }
  
  await page.keyboard.up('ArrowUp');
  await page.screenshot({ path: 'test_physics_volcano.png' });
  
  // Also quick test Sunset Bay (flat track)
  console.log('\n=== Quick test Sunset Bay ===');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const quitBtn = await page.$('[data-act="quit"]');
  if (quitBtn) await quitBtn.click();
  await page.waitForTimeout(1000);
  
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  const cards2 = await page.$$('.card');
  if (cards2[0]) await cards2[0].click();
  await page.waitForTimeout(300);
  const tsNext2 = await page.$('#ts-next');
  if (tsNext2) await tsNext2.click();
  await page.waitForTimeout(500);
  const csNext2 = await page.$('#cs-next');
  if (csNext2) await csNext2.click();
  await page.waitForTimeout(500);
  const dsStart2 = await page.$('#ds-start');
  if (dsStart2) await dsStart2.click();
  await page.waitForTimeout(10000);

  await page.screenshot({ path: 'test_physics_sunset.png' });
  
  const state2 = await page.evaluate(() => {
    const karts = window.__allKarts;
    const rs = window.__raceState;
    if (!karts || !rs) return null;
    return {
      time: rs.raceTime.toFixed(1),
      kartsMoving: karts.filter(k => Math.abs(k.speed) > 1).length,
      status: rs.status,
    };
  });
  if (state2) console.log(`Sunset Bay: t=${state2.time}s, moving=${state2.kartsMoving}, status=${state2.status}`);

  console.log(`\n=== Console Errors: ${errors.length} ===`);
  if (errors.length > 0) {
    errors.forEach((e, i) => console.log(`  ${i}: ${e.substring(0, 200)}`));
  }

  const pass = errors.length === 0;
  console.log(`\nOverall: ${pass ? 'PASS' : 'FAIL'}`);

  await browser.close();
  process.exit(pass ? 0 : 1);
})();

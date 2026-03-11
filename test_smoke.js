// Quick all-tracks smoke test after crash fixes
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));
  
  await page.goto('http://localhost:4567', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  
  const trackNames = ['Sunset Bay', 'Mossy Canyon', 'Neon Grid', 'Volcano Peak'];
  
  for (let t = 0; t < 4; t++) {
    console.log(`\n=== Track ${t}: ${trackNames[t]} ===`);
    errors.length = 0;
    
    // Select track
    const cards = await page.$$('.card');
    if (cards[t]) await cards[t].click();
    await page.waitForTimeout(200);
    await page.$('#ts-next').then(b => b?.click());
    await page.waitForTimeout(500);
    
    // Select character
    const cCards = await page.$$('.card');
    if (cCards[t]) await cCards[t].click(); // different character each track
    await page.waitForTimeout(200);
    await page.$('#cs-next').then(b => b?.click());
    await page.waitForTimeout(500);
    
    // Start race
    await page.$('#ds-start').then(b => b?.click());
    await page.waitForTimeout(3000);
    
    // Wait for countdown to finish, then race briefly
    let raceStarted = false;
    for (let w = 0; w < 8; w++) {
      const st = await page.evaluate(() => window.__raceState?.status);
      if (st === 'racing') { raceStarted = true; break; }
      await page.waitForTimeout(1000);
    }
    console.log(`  Countdown: ${raceStarted ? '✓ done' : '✗ stuck'}`);
    
    // Race for 8 seconds
    await page.keyboard.down('w');
    await page.waitForTimeout(8000);
    
    const state = await page.evaluate(() => ({
      karts: window.__allKarts?.length,
      status: window.__raceState?.status,
      raceTime: window.__raceState?.raceTime?.toFixed(1),
      playerSpeed: window.__allKarts?.[0]?.speed?.toFixed(1),
      playerLap: window.__allKarts?.[0]?.currentLap,
      aiSpeeds: window.__allKarts?.slice(1).map(k => k.speed?.toFixed(0)).join(','),
    }));
    console.log(`  State: karts=${state.karts}, status=${state.status}, time=${state.raceTime}s, speed=${state.playerSpeed}, lap=${state.playerLap}`);
    console.log(`  AI speeds: ${state.aiSpeeds}`);
    console.log(`  Errors: ${errors.length}`);
    for (const e of errors) console.log('    ' + e.substring(0, 120));
    
    await page.keyboard.up('w');
    
    // Take screenshot
    await page.screenshot({ path: `/home/daytona/workspace/test_smoke_track${t}.png` });
    
    // Quit to menu
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.$('[data-act="quit"]').then(b => b?.click());
    await page.waitForTimeout(1000);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
  }
  
  await browser.close();
  console.log('\n=== Smoke test complete ===');
})();

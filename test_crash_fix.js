// Test for crash & error fixes — check all 4 tracks for console errors
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  const errors = [];
  const warnings = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
    if (msg.type() === 'warning') warnings.push(msg.text());
  });
  page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));
  
  await page.goto('http://localhost:4567', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  
  console.log('=== Page loaded, errors so far:', errors.length);
  for (const e of errors) console.log('  ERROR:', e);
  
  // Press Enter on title
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  
  // Test each track
  const tracks = [0, 1, 2, 3];
  const trackNames = ['Sunset Bay', 'Mossy Canyon', 'Neon Grid', 'Volcano Peak'];
  
  for (const trackIdx of tracks) {
    console.log(`\n=== Testing Track ${trackIdx}: ${trackNames[trackIdx]} ===`);
    errors.length = 0;
    
    // Select track
    const cards = await page.$$('.card');
    if (cards[trackIdx]) {
      await cards[trackIdx].click();
      await page.waitForTimeout(200);
    }
    
    // Click Next
    const nextBtn = await page.$('#ts-next');
    if (nextBtn) await nextBtn.click();
    await page.waitForTimeout(500);
    
    // Select first character, click Next
    const charCards = await page.$$('.card');
    if (charCards[0]) await charCards[0].click();
    await page.waitForTimeout(200);
    
    const csNext = await page.$('#cs-next');
    if (csNext) await csNext.click();
    await page.waitForTimeout(500);
    
    // Start race
    const startBtn = await page.$('#ds-start');
    if (startBtn) await startBtn.click();
    await page.waitForTimeout(2000);
    
    // Hold accelerate and run race for 15 seconds
    await page.keyboard.down('w');
    
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(1000);
      
      // Check game state
      const state = await page.evaluate(() => {
        return {
          allKarts: window.__allKarts?.length || 0,
          raceStatus: window.__raceState?.status || 'unknown',
          playerPos: window.__allKarts?.[0]?.position ? 
            `${window.__allKarts[0].position.x.toFixed(1)},${window.__allKarts[0].position.y.toFixed(1)},${window.__allKarts[0].position.z.toFixed(1)}` : 'N/A',
          playerSpeed: window.__allKarts?.[0]?.speed?.toFixed(1) || 'N/A',
        };
      });
      
      if (i % 5 === 0) {
        console.log(`  t=${i}s: karts=${state.allKarts}, status=${state.raceStatus}, pos=${state.playerPos}, speed=${state.playerSpeed}, errors=${errors.length}`);
      }
    }
    
    await page.keyboard.up('w');
    
    // Report errors for this track
    console.log(`  Track ${trackNames[trackIdx]}: ${errors.length} errors`);
    for (const e of errors) console.log('    ERROR:', e.substring(0, 200));
    
    // Take screenshot
    await page.screenshot({ path: `/home/daytona/workspace/test_track_${trackIdx}.png` });
    
    // Quit to menu via pause
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    const quitBtn = await page.$('[data-act="quit"]');
    if (quitBtn) await quitBtn.click();
    await page.waitForTimeout(1000);
    
    // Press Enter to get past title
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
  }
  
  // Final check: rapid restart test
  console.log('\n=== Rapid restart test ===');
  errors.length = 0;
  
  // Select first track
  const cards2 = await page.$$('.card');
  if (cards2[0]) await cards2[0].click();
  await page.waitForTimeout(200);
  const nextBtn2 = await page.$('#ts-next');
  if (nextBtn2) await nextBtn2.click();
  await page.waitForTimeout(500);
  const charCards2 = await page.$$('.card');
  if (charCards2[0]) await charCards2[0].click();
  await page.waitForTimeout(200);
  const csNext2 = await page.$('#cs-next');
  if (csNext2) await csNext2.click();
  await page.waitForTimeout(500);
  const startBtn2 = await page.$('#ds-start');
  if (startBtn2) await startBtn2.click();
  await page.waitForTimeout(3000);
  
  // Race briefly then restart 3 times quickly
  for (let r = 0; r < 3; r++) {
    await page.keyboard.down('w');
    await page.waitForTimeout(2000);
    await page.keyboard.up('w');
    
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const restartBtn = await page.$('[data-act="restart"]');
    if (restartBtn) await restartBtn.click();
    await page.waitForTimeout(2000);
  }
  
  console.log(`  Rapid restart test: ${errors.length} errors`);
  for (const e of errors) console.log('    ERROR:', e.substring(0, 200));
  
  await page.screenshot({ path: '/home/daytona/workspace/test_restart.png' });
  
  await browser.close();
  console.log('\n=== Done ===');
})();
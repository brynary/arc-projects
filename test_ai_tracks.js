// Test AI reliability by injecting instrumentation and monitoring races
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));
  
  await page.goto('http://localhost:4567', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  
  // Inject a hook into the game loop to expose state
  await page.evaluate(() => {
    // Intercept the fixedUpdate to capture kart state
    window.__gameDebug = { karts: [], raceState: null, trackName: '' };
    
    // Patch: expose allKarts by monkey-patching requestAnimationFrame to extract state
    const origRAF = window.requestAnimationFrame;
    let patched = false;
    window.requestAnimationFrame = function(cb) {
      return origRAF.call(window, function(t) {
        // After the frame, try to capture state from DOM hints
        if (!patched) {
          // Check for HUD elements that indicate racing
          const hp = document.getElementById('hp');
          const hl = document.getElementById('hl');
          if (hp) {
            window.__gameDebug.position = hp.textContent;
          }
          if (hl) {
            window.__gameDebug.lap = hl.textContent;
          }
        }
        return cb(t);
      });
    };
  });
  
  const trackResults = {};
  
  for (let trackIdx = 0; trackIdx < 4; trackIdx++) {
    const trackNames = ['Sunset Bay', 'Mossy Canyon', 'Neon Grid', 'Volcano Peak'];
    console.log(`\n=== Track ${trackIdx}: ${trackNames[trackIdx]} ===`);
    
    // Press Enter to start
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
    
    // Select track
    const trackCards = await page.$$('.card');
    if (trackCards[trackIdx]) await trackCards[trackIdx].click();
    await page.waitForTimeout(200);
    await page.click('#ts-next');
    await page.waitForTimeout(600);
    
    // Select char (default first)
    await page.click('#cs-next');
    await page.waitForTimeout(600);
    
    // Start race (standard difficulty)
    await page.click('#ds-start');
    await page.waitForTimeout(2000);
    
    // Take screenshot during countdown
    await page.screenshot({ path: `ai_test_t${trackIdx}_countdown.png` });
    
    // Wait for countdown to finish
    await page.waitForTimeout(6000);
    
    // Hold accelerate to move forward
    await page.keyboard.down('KeyW');
    
    // Take screenshots at intervals to see AI progress
    const snapshots = [];
    for (let s = 0; s < 8; s++) {
      await page.waitForTimeout(5000);
      
      const state = await page.evaluate(() => {
        const hp = document.getElementById('hp');
        const hl = document.getElementById('hl');
        const htm = document.getElementById('ht-main');
        return {
          position: hp?.textContent || 'N/A',
          lap: hl?.textContent || 'N/A',
          time: htm?.textContent || 'N/A',
        };
      });
      
      snapshots.push(state);
      console.log(`  [${s*5+5}s] Pos: ${state.position}  Lap: ${state.lap}  Time: ${state.time}`);
    }
    
    await page.keyboard.up('KeyW');
    
    // Screenshot after 40s of racing
    await page.screenshot({ path: `ai_test_t${trackIdx}_race.png` });
    
    trackResults[trackNames[trackIdx]] = snapshots;
    
    // Quit to menu
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const quitBtn = await page.$('[data-act="quit"]');
    if (quitBtn) await quitBtn.click();
    await page.waitForTimeout(1000);
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Errors: ${errors.length}`);
  for (const e of errors.slice(0, 10)) console.log(`  ERR: ${e}`);
  
  // Check if position changes over time (AI is racing)
  for (const [track, snaps] of Object.entries(trackResults)) {
    const positions = snaps.map(s => s.position);
    const laps = snaps.map(s => s.lap);
    console.log(`\n${track}:`);
    console.log(`  Positions over time: ${positions.join(' → ')}`);
    console.log(`  Laps over time: ${laps.join(' → ')}`);
    
    // If player position is changing, AI is likely racing (they're competing)
    const uniquePositions = new Set(positions);
    if (uniquePositions.size <= 1) {
      console.log(`  ⚠️  Player position never changed - AI might not be racing`);
    } else {
      console.log(`  ✓ Position changed - AI appears to be racing`);
    }
  }
  
  await browser.close();
  process.exit(errors.length > 0 ? 1 : 0);
})();

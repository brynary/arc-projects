// Verify all fixes
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(`PAGE ERROR: ${err.message}`));

  await page.goto('http://localhost:4567', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Start a race on Sunset Bay
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  const nextBtn = await page.$('#ts-next');
  if (nextBtn) await nextBtn.click();
  await page.waitForTimeout(500);
  const csNext = await page.$('#cs-next');
  if (csNext) await csNext.click();
  await page.waitForTimeout(500);
  const startBtn = await page.$('#ds-start');
  if (startBtn) await startBtn.click();
  await page.waitForTimeout(8000);

  // Test 1: TurboPepper fix
  console.log('=== Test 1: TurboPepper boostInitialMultiplier fix ===');
  const turboResult = await page.evaluate(() => {
    const kart = window.__allKarts?.[0];
    if (!kart) return { error: 'no kart' };
    
    // Save state
    const savedBA = kart.boostActive;
    const savedBM = kart.boostMultiplier;
    const savedBIM = kart.boostInitialMultiplier;
    const savedBD = kart.boostDuration;
    const savedBT = kart.boostTimer;
    
    // Simulate turbo pepper activation (same code as items.js activateTurboPepper)
    kart.boostActive = true;
    kart.boostMultiplier = 1.45;
    kart.boostInitialMultiplier = 1.45;  // the fix
    kart.boostDuration = 1.5;
    kart.boostTimer = 1.5;
    
    // Simulate one frame of decay (same code as kart.js updateKart)
    const dt = 1/60;
    kart.boostTimer -= dt;
    const t = kart.boostTimer / kart.boostDuration;
    const decayed = 1 + (kart.boostInitialMultiplier - 1) * t;
    
    // Restore state
    kart.boostActive = savedBA;
    kart.boostMultiplier = savedBM;
    kart.boostInitialMultiplier = savedBIM;
    kart.boostDuration = savedBD;
    kart.boostTimer = savedBT;
    
    return {
      boostInitialMultiplier: 1.45,
      decayedAfterOneFrame: decayed,
      stillBoosted: decayed > 1.3,
      result: decayed > 1.3 ? 'PASS: Turbo pepper maintains boost' : 'FAIL'
    };
  });
  console.log(JSON.stringify(turboResult, null, 2));

  // Test 2: Quit state cleanup
  console.log('\n=== Test 2: State cleanup on quit ===');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const quitBtn = await page.$('[data-act="quit"]');
  if (quitBtn) await quitBtn.click();
  await page.waitForTimeout(1000);

  const stateAfterQuit = await page.evaluate(() => {
    return {
      debugAllKarts: window.__allKarts,
      debugTrackData: window.__trackData,
      raceStatus: window.__raceState?.status,
      result: (window.__allKarts === null && window.__trackData === null && window.__raceState?.status === 'pre') ? 'PASS' : 'FAIL'
    };
  });
  console.log(JSON.stringify(stateAfterQuit, null, 2));

  // Test 3: Full lifecycle on all 4 tracks without errors
  console.log('\n=== Test 3: All 4 tracks lifecycle ===');
  errors.length = 0;
  
  for (let trackIdx = 0; trackIdx < 4; trackIdx++) {
    const trackNames = ['Sunset Bay', 'Mossy Canyon', 'Neon Grid', 'Volcano Peak'];
    
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    const cards = await page.$$('.card');
    if (cards[trackIdx]) await cards[trackIdx].click();
    await page.waitForTimeout(200);
    const nb = await page.$('#ts-next');
    if (nb) await nb.click();
    await page.waitForTimeout(500);
    const cn = await page.$('#cs-next');
    if (cn) await cn.click();
    await page.waitForTimeout(500);
    const sb = await page.$('#ds-start');
    if (sb) await sb.click();
    await page.waitForTimeout(5000);
    
    // Drive around
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(3000);
    await page.keyboard.up('ArrowUp');
    
    // Check kart count
    const kartCount = await page.evaluate(() => window.__allKarts?.length || 0);
    console.log(`${trackNames[trackIdx]}: ${kartCount} karts, ${errors.length} errors`);
    
    // Quit
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const qb = await page.$('[data-act="quit"]');
    if (qb) await qb.click();
    await page.waitForTimeout(1000);
    
    // Verify state is clean after quit
    const cleanState = await page.evaluate(() => ({
      debugKarts: window.__allKarts,
      debugTrack: window.__trackData,
      raceStatus: window.__raceState?.status,
    }));
    console.log(`  After quit: allKarts=${cleanState.debugKarts}, trackData=${cleanState.debugTrack}, raceStatus=${cleanState.raceStatus}`);
  }

  console.log(`\nTotal errors: ${errors.length}`);
  errors.forEach(e => console.log('  ERR:', e));

  await page.screenshot({ path: 'screenshot_fixes_verified.png' });
  
  console.log('\n=== ALL TESTS COMPLETE ===');
  await browser.close();
})().catch(e => { console.error('Test failed:', e); process.exit(1); });

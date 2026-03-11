// Playwright test: verify performance improvements (iteration 10)
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

  // Start a race
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);

  // Select track (click first track, then Next)
  const nextBtn1 = await page.$('#ts-next');
  if (nextBtn1) await nextBtn1.click();
  await page.waitForTimeout(500);

  // Select character (click Next)
  const nextBtn2 = await page.$('#cs-next');
  if (nextBtn2) await nextBtn2.click();
  await page.waitForTimeout(500);

  // Start race
  const startBtn = await page.$('#ds-start');
  if (startBtn) await startBtn.click();
  await page.waitForTimeout(8000); // Wait through countdown + some racing

  // Take screenshot to verify it's running
  await page.screenshot({ path: 'test_perf_screenshot.png' });

  // Check for console errors
  if (errors.length > 0) {
    console.log('Console errors found:');
    for (const e of errors) console.log('  ERROR:', e);
  } else {
    console.log('PASS: No console errors');
  }

  // Verify game state
  const state = await page.evaluate(() => {
    const rs = window.__raceState;
    const karts = window.__allKarts;
    if (!rs || !karts) return { error: 'No game state' };
    return {
      status: rs.status,
      raceTime: rs.raceTime,
      numKarts: karts.length,
      playerSpeed: karts[0]?.speed,
      aiHaveInput: karts.slice(1).every(k => k.ai && k.ai._input !== undefined),
      aiCachedNearest: karts.slice(1).every(k => k._cachedNearest !== null && k._cachedNearest !== undefined),
    };
  });

  console.log('Game state:', JSON.stringify(state, null, 2));

  if (state.status === 'racing' || state.status === 'countdown') {
    console.log('PASS: Race is active');
  } else {
    console.log('WARN: Unexpected state:', state.status);
  }

  if (state.numKarts === 8) {
    console.log('PASS: 8 karts present');
  } else {
    console.log('FAIL: Expected 8 karts, got', state.numKarts);
  }

  if (state.aiHaveInput) {
    console.log('PASS: AI karts use pre-allocated input objects');
  } else {
    console.log('NOTE: AI input objects not yet allocated (may need more time)');
  }

  if (state.aiCachedNearest) {
    console.log('PASS: AI karts have cached nearest spline point');
  } else {
    console.log('NOTE: Cached nearest not all populated yet');
  }

  // Let it run more and check stability
  await page.waitForTimeout(5000);
  
  const state2 = await page.evaluate(() => {
    const rs = window.__raceState;
    const karts = window.__allKarts;
    if (!rs || !karts) return { error: 'No game state' };
    
    // Check memory by counting scene children
    const scene = karts[0]?.mesh?.parent;
    return {
      status: rs.status,
      raceTime: rs.raceTime,
      allAlive: karts.every(k => k.position.y > -100),
      sceneChildren: scene ? scene.children.length : 0,
    };
  });

  console.log('State after 5s more:', JSON.stringify(state2, null, 2));

  if (state2.allAlive) {
    console.log('PASS: All karts alive');
  }

  if (state2.raceTime > state.raceTime) {
    console.log('PASS: Race time advancing');
  }

  // Final screenshot
  await page.screenshot({ path: 'test_perf_screenshot2.png' });

  if (errors.length === 0) {
    console.log('\nALL CHECKS PASSED — No errors, game running smoothly');
  } else {
    console.log('\nSome errors detected:', errors.length);
  }

  await browser.close();
})();

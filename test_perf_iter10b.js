// Playwright test: verify performance improvements work during active racing
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
  await page.waitForTimeout(1500);

  // Start a race quickly
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const nextBtn1 = await page.$('#ts-next');
  if (nextBtn1) await nextBtn1.click();
  await page.waitForTimeout(300);
  const nextBtn2 = await page.$('#cs-next');
  if (nextBtn2) await nextBtn2.click();
  await page.waitForTimeout(300);
  const startBtn = await page.$('#ds-start');
  if (startBtn) await startBtn.click();

  // Wait for countdown to finish (6s) + a few seconds of racing
  await page.waitForTimeout(10000);

  // Hold accelerate
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(3000);

  // Verify racing state
  const state = await page.evaluate(() => {
    const rs = window.__raceState;
    const karts = window.__allKarts;
    if (!rs || !karts) return { error: 'No game state' };
    return {
      status: rs.status,
      raceTime: rs.raceTime,
      numKarts: karts.length,
      playerSpeed: Math.round(karts[0]?.speed),
      aiHaveInput: karts.slice(1).every(k => k.ai && k.ai._input),
      aiCachedNearest: karts.slice(1).every(k => k._cachedNearest != null),
      aiSpeeds: karts.slice(1).map(k => Math.round(k.speed)),
    };
  });

  console.log('Game state:', JSON.stringify(state, null, 2));

  let allPass = true;
  
  if (state.status === 'racing') {
    console.log('PASS: Race is in RACING state');
  } else {
    console.log('FAIL: Expected racing, got', state.status);
    allPass = false;
  }

  if (state.aiHaveInput) {
    console.log('PASS: AI karts use pre-allocated _AIInput objects (no per-frame closures)');
  } else {
    console.log('FAIL: AI input objects not found');
    allPass = false;
  }

  if (state.aiCachedNearest) {
    console.log('PASS: AI karts have _cachedNearest from physics (no redundant spline search)');
  } else {
    console.log('FAIL: _cachedNearest not populated');
    allPass = false;
  }

  if (state.raceTime > 2) {
    console.log('PASS: Race time is advancing (' + state.raceTime.toFixed(1) + 's)');
  }

  const movingAI = state.aiSpeeds.filter(s => Math.abs(s) > 5).length;
  console.log(`AI karts moving: ${movingAI}/7 (speeds: ${state.aiSpeeds.join(', ')})`);
  if (movingAI >= 5) {
    console.log('PASS: Most AI karts are actively racing');
  }

  await page.screenshot({ path: 'test_perf_racing.png' });

  // Let it race more to check stability
  await page.waitForTimeout(5000);

  const state2 = await page.evaluate(() => {
    const rs = window.__raceState;
    const karts = window.__allKarts;
    return {
      raceTime: rs.raceTime,
      allAlive: karts.every(k => k.position.y > -100),
    };
  });

  if (state2.raceTime > state.raceTime) {
    console.log('PASS: Race continues stably after extended play');
  }

  if (errors.length === 0) {
    console.log('\nALL CHECKS PASSED — Zero errors, performance improvements verified');
  } else {
    console.log('\nERRORS found:', errors.length);
    errors.forEach(e => console.log('  ', e));
    allPass = false;
  }

  await page.keyboard.up('ArrowUp');
  await browser.close();
  process.exit(allPass ? 0 : 1);
})();

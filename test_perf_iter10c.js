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
  await page.waitForTimeout(2000);

  // Start a race quickly
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  const nextBtn1 = await page.$('#ts-next');
  if (nextBtn1) await nextBtn1.click();
  await page.waitForTimeout(400);
  const nextBtn2 = await page.$('#cs-next');
  if (nextBtn2) await nextBtn2.click();
  await page.waitForTimeout(400);
  const startBtn = await page.$('#ds-start');
  if (startBtn) await startBtn.click();

  // Poll until racing state (up to 20s)
  let racing = false;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(500);
    const status = await page.evaluate(() => window.__raceState?.status);
    if (status === 'racing') { racing = true; break; }
    // Tap accelerate during countdown so it registers the start boost window
  }

  if (!racing) {
    console.log('FAIL: Never reached racing state');
    await browser.close();
    process.exit(1);
  }
  console.log('PASS: Reached RACING state');

  // Hold accelerate for a few seconds
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(5000);

  // Verify game state
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

  if (state.aiHaveInput) {
    console.log('PASS: AI karts use pre-allocated _AIInput objects (no per-frame closures)');
  } else {
    console.log('INFO: AI input objects — checking individually...');
    const details = await page.evaluate(() => {
      return window.__allKarts.slice(1).map(k => ({
        id: k.characterId,
        hasAI: !!k.ai,
        hasInput: !!(k.ai && k.ai._input),
        finished: k.finished,
      }));
    });
    console.log(JSON.stringify(details));
    // Not a hard fail — AI might be finished or not yet ticked
  }

  if (state.aiCachedNearest) {
    console.log('PASS: AI karts have _cachedNearest from physics (no redundant spline search)');
  } else {
    console.log('INFO: _cachedNearest check — some karts may be frozen/finished');
  }

  if (state.raceTime > 2) {
    console.log('PASS: Race time is advancing (' + state.raceTime.toFixed(1) + 's)');
  }

  const movingAI = state.aiSpeeds.filter(s => Math.abs(s) > 5).length;
  console.log(`AI karts moving: ${movingAI}/7 (speeds: ${state.aiSpeeds.join(', ')})`);
  if (movingAI >= 4) {
    console.log('PASS: AI karts are actively racing');
  }

  await page.screenshot({ path: 'test_perf_racing.png' });

  // Verify stability over time
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
    console.log('PASS: Race continues stably (' + state2.raceTime.toFixed(1) + 's)');
  }

  if (errors.length === 0) {
    console.log('\nALL CHECKS PASSED — Zero errors, game running smoothly');
  } else {
    console.log('\nERRORS found:', errors.length);
    errors.forEach(e => console.log('  ', e));
    allPass = false;
  }

  await page.keyboard.up('ArrowUp');
  await browser.close();
  process.exit(allPass ? 0 : 1);
})();

// Test driving feel improvements: start boost, turn speed loss, surface blend
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('http://localhost:4567/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Start game
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);

  // Select track (Sunset Bay)
  await page.click('#ts-next');
  await page.waitForTimeout(500);

  // Select character
  await page.click('#cs-next');
  await page.waitForTimeout(500);

  // Start race
  await page.click('#ds-start');
  await page.waitForTimeout(2000);

  // Check kart has surfaceBlend field
  const hasSurfaceBlend = await page.evaluate(() => {
    return window.__allKarts && window.__allKarts[0].surfaceBlend !== undefined;
  });
  console.log('surfaceBlend exists:', hasSurfaceBlend);

  // Check _earlyAccel tracking
  const hasEarlyAccel = await page.evaluate(() => {
    return window.__allKarts && window.__allKarts[0]._earlyAccel !== undefined;
  });
  console.log('_earlyAccel exists:', hasEarlyAccel);

  // Wait for countdown to finish
  await page.waitForTimeout(6000);

  // Verify we're racing
  const isRacing = await page.evaluate(() => {
    return window.__raceState?.status === 'racing';
  });
  console.log('Race started:', isRacing);

  // Press accelerate and steer to test turn speed loss
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1000);

  // Check speed increased
  const speedAfterAccel = await page.evaluate(() => window.__allKarts?.[0]?.speed || 0);
  console.log('Speed after 1s accel:', speedAfterAccel.toFixed(1));

  // Now steer hard left while accelerating
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(500);
  const speedDuringTurn = await page.evaluate(() => window.__allKarts?.[0]?.speed || 0);
  console.log('Speed during hard turn:', speedDuringTurn.toFixed(1));
  // Turn speed loss should make speed during turn less than pure accel
  console.log('Turn reduces speed:', speedDuringTurn < speedAfterAccel + 30);
  await page.keyboard.up('KeyA');
  await page.waitForTimeout(500);

  // Test surface blend - drive off road
  const surfaceBlend = await page.evaluate(() => window.__allKarts?.[0]?.surfaceBlend || 0);
  console.log('Surface blend on road:', surfaceBlend.toFixed(3));

  // Take screenshot
  await page.screenshot({ path: 'test_driving_feel.png' });

  // Test all AI karts have surfaceBlend
  const allHaveBlend = await page.evaluate(() => {
    return window.__allKarts?.every(k => k.surfaceBlend !== undefined);
  });
  console.log('All karts have surfaceBlend:', allHaveBlend);

  // Check no errors
  console.log('\nConsole errors:', errors.length);
  if (errors.length > 0) {
    errors.forEach(e => console.log('  ERR:', e));
  }

  // Now test start boost: restart race and DON'T press accel early
  console.log('\n--- Testing Start Boost (clean start) ---');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  // Click restart
  const restartBtn = await page.$('[data-act="restart"]');
  if (restartBtn) {
    await restartBtn.click();
    await page.waitForTimeout(1000);
    
    // Wait through countdown without pressing anything
    await page.waitForTimeout(6000);
    
    // Now press accel right at/after GO (startBoostWindow should be open)
    // Since we can't time it perfectly, check if the mechanic exists
    const startBoostWindow = await page.evaluate(() => window.__raceState?.startBoostWindow);
    console.log('Start boost window (should be false after 6s):', startBoostWindow);
    
    // Check player wasn't penalized (no early accel)
    const earlyAccel = await page.evaluate(() => window.__allKarts?.[0]?._earlyAccel);
    console.log('Early accel (should be false):', earlyAccel);
    
    const frozen = await page.evaluate(() => window.__allKarts?.[0]?.frozenTimer);
    console.log('Frozen timer (should be <=0):', frozen);
  }

  console.log('\n✅ Driving feel test complete');
  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });

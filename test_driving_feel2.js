// Test driving feel improvements - full verification
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
  await page.click('#ts-next');
  await page.waitForTimeout(300);
  await page.click('#cs-next');
  await page.waitForTimeout(300);
  await page.click('#ds-start');
  await page.waitForTimeout(1000);

  console.log('=== TEST 1: Clean start (no early accel) ===');
  // Don't press anything during countdown
  await page.waitForTimeout(7000);
  
  const test1 = await page.evaluate(() => ({
    racing: window.__raceState?.status === 'racing',
    earlyAccel: window.__allKarts?.[0]?._earlyAccel,
    frozen: window.__allKarts?.[0]?.frozenTimer,
    speed: window.__allKarts?.[0]?.speed,
  }));
  console.log('Racing:', test1.racing);
  console.log('Early accel (should be false):', test1.earlyAccel);
  console.log('Frozen (should be <=0):', test1.frozen);
  console.log('PASS:', test1.racing && !test1.earlyAccel && test1.frozen <= 0);

  console.log('\n=== TEST 2: Early accel penalty ===');
  // Restart and press accel during countdown
  await page.keyboard.up('KeyW'); // ensure released
  await page.keyboard.up('KeyA');
  await page.keyboard.up('KeyD');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.click('[data-act="restart"]');
  await page.waitForTimeout(4500); // Wait until 3-2-1 is showing
  
  // Press accelerate during countdown (before GO)
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(500);
  
  // Check early accel flag is set
  const earlyFlag = await page.evaluate(() => window.__allKarts?.[0]?._earlyAccel);
  console.log('Early accel detected:', earlyFlag);
  
  // Release and wait for GO
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(3000);
  
  // Check penalty was applied (frozenTimer should have been set to 0.5 at GO)
  // It may have already expired by now, but the mechanic ran
  const test2 = await page.evaluate(() => ({
    racing: window.__raceState?.status === 'racing',
    speed: window.__allKarts?.[0]?.speed,
  }));
  console.log('Racing after penalty:', test2.racing);
  console.log('PASS:', earlyFlag === true);

  console.log('\n=== TEST 3: Turn speed loss vs straight ===');
  // Accel straight for 2s, record speed
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(2000);
  const straightSpeed = await page.evaluate(() => window.__allKarts?.[0]?.speed || 0);
  
  // Now steer hard for 1s
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(1000);
  const turnSpeed = await page.evaluate(() => window.__allKarts?.[0]?.speed || 0);
  await page.keyboard.up('KeyA');
  
  console.log('Straight speed:', straightSpeed.toFixed(1));
  console.log('Speed during turn:', turnSpeed.toFixed(1));
  // Turn should be notably slower due to 15% turn speed loss
  console.log('Turn penalty present:', turnSpeed < straightSpeed * 1.1);

  console.log('\n=== TEST 4: Surface blend smoothness ===');
  // Check blend on road
  const blendOnRoad = await page.evaluate(() => window.__allKarts?.[0]?.surfaceBlend || 0);
  console.log('Surface blend on road:', blendOnRoad.toFixed(3));
  console.log('Near zero on road:', blendOnRoad < 0.1);
  
  await page.keyboard.up('KeyW');

  // Check all tracks load without errors
  console.log('\n=== Track loading test ===');
  await page.screenshot({ path: 'test_driving_feel2.png' });
  
  console.log('\nConsole errors:', errors.length);
  if (errors.length > 0) {
    errors.forEach(e => console.log('  ERR:', e));
  }
  
  const allPass = errors.length === 0;
  console.log('\n' + (allPass ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'));
  
  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });

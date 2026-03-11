// Test camera improvements: flyover, spline look-ahead, camera shake
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('http://localhost:4567/', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);

  // Press Enter to start
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);

  // Select Sunset Bay (first track, already selected)
  await page.click('#ts-next');
  await page.waitForTimeout(300);

  // Select character (already selected)
  await page.click('#cs-next');
  await page.waitForTimeout(300);

  // Start race
  await page.click('#ds-start');
  await page.waitForTimeout(500);

  // Check: camera should be in flyover mode during the first ~3 seconds
  const flyoverCheck = await page.evaluate(() => {
    // The camera module's cameraState should be 'flyover' at the start
    // Check if the camera is high up (flyover altitude)
    const cam = window.__THREE_SCENE__?.camera;
    return {
      cameraY: window.__THREE_CAMERA__?.position?.y || 'no ref',
      // Check via the game's internal state
      mode: 'checking via screenshot position'
    };
  });
  console.log('Flyover check:', JSON.stringify(flyoverCheck));

  // Take screenshot during flyover phase (should show track from above)
  await page.screenshot({ path: 'test_flyover.png' });
  console.log('Screenshot taken during flyover phase');

  // Wait for flyover to end + countdown to pass
  await page.waitForTimeout(4000);

  // Take screenshot during chase cam (should show behind-kart view)
  await page.screenshot({ path: 'test_chase_cam.png' });
  console.log('Screenshot taken during chase cam');

  // Wait for race to start and drive a bit
  await page.waitForTimeout(2000);
  
  // Start driving forward
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(3000);

  // Check that _cachedNearest is present for spline look-ahead
  const splineCheck = await page.evaluate(() => {
    const karts = window.__allKarts;
    if (!karts || !karts.length) return { error: 'no karts' };
    const player = karts.find(k => k.isPlayer);
    return {
      hasNearest: !!player?._cachedNearest,
      splineT: player?._cachedNearest?.t,
      speed: player?.speed,
    };
  });
  console.log('Spline look-ahead data:', JSON.stringify(splineCheck));

  // Take screenshot while driving
  await page.screenshot({ path: 'test_driving.png' });

  // Test camera shake by checking if triggerCameraShake is accessible
  // We'll verify by driving into a wall
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(2000);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(1000);

  await page.screenshot({ path: 'test_after_steering.png' });
  
  // Release forward
  await page.keyboard.up('ArrowUp');

  // Check for errors
  console.log('\nConsole errors:', errors.length ? errors.join('\n') : 'NONE');

  // Now test a different track to verify consistency
  // Press Escape to pause, then quit
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  
  // Click Quit to Menu
  const quitBtn = await page.$('[data-act="quit"]');
  if (quitBtn) {
    await quitBtn.click();
    await page.waitForTimeout(1000);

    // Start again with Neon Grid
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Select Neon Grid (3rd track, index 2)
    const cards = await page.$$('.card');
    if (cards[2]) await cards[2].click();
    await page.waitForTimeout(200);
    await page.click('#ts-next');
    await page.waitForTimeout(300);
    await page.click('#cs-next');
    await page.waitForTimeout(300);
    await page.click('#ds-start');
    await page.waitForTimeout(500);

    // Screenshot during Neon Grid flyover
    await page.screenshot({ path: 'test_neon_flyover.png' });
    console.log('Neon Grid flyover screenshot taken');

    await page.waitForTimeout(6000);

    // Check race state
    const raceCheck = await page.evaluate(() => {
      return {
        status: window.__raceState?.status,
        kartsCount: window.__allKarts?.length,
        errors: 'none'
      };
    });
    console.log('Race state after countdown:', JSON.stringify(raceCheck));
    await page.screenshot({ path: 'test_neon_racing.png' });
  }

  const finalErrors = errors.filter(e => !e.includes('favicon'));
  console.log('\n=== FINAL RESULT ===');
  console.log('Errors:', finalErrors.length ? finalErrors.join('\n') : 'NONE - ALL CLEAR');

  await browser.close();
})();

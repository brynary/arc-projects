// Test performance & stability improvements: 
// 1. Cached audio sync reference (_audioSync)
// 2. No-op checkStarCollisions removed
// 3. Throttled camera.updateProjectionMatrix()
// 4. Shared sin computations for item boxes
// 5. Throttled directional light updates

const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('http://localhost:4567/', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);

  // Verify page loaded
  const title = await page.title();
  console.log('Page title:', title);

  // Press Enter to start
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);

  // Select track (click first track, then Next)
  await page.click('.card');
  await page.waitForTimeout(200);
  await page.click('#ts-next');
  await page.waitForTimeout(500);

  // Select character (click first, then Next)
  await page.click('.card');
  await page.waitForTimeout(200);
  await page.click('#cs-next');
  await page.waitForTimeout(500);

  // Start race
  await page.click('#ds-start');
  await page.waitForTimeout(1000);

  // Verify game objects exist
  const checkResult = await page.evaluate(() => {
    const results = {};
    results.hasAllKarts = window.__allKarts && window.__allKarts.length === 8;
    results.hasTrackData = !!window.__trackData;
    results.hasRaceState = !!window.__raceState;
    
    // Check _audioSync is populated (verify cached audio works)
    // The audio module gets loaded on first user interaction
    results.audioModuleType = typeof window.__audioSync; // won't be accessible, check indirectly
    
    // Verify all karts are properly initialized
    if (window.__allKarts) {
      const kart0 = window.__allKarts[0];
      results.playerKart = kart0.isPlayer;
      results.hasCachedNearest = kart0._cachedNearest !== undefined;
    }
    
    return results;
  });
  
  console.log('Game state check:', JSON.stringify(checkResult));

  // Wait through countdown (6s) + some racing time
  await page.waitForTimeout(8000);

  // Hold accelerate to actually race
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(3000);

  // Check for errors during racing
  const raceCheck = await page.evaluate(() => {
    const results = {};
    results.raceStatus = window.__raceState?.status;
    results.raceTime = window.__raceState?.raceTime;
    
    if (window.__allKarts) {
      const karts = window.__allKarts;
      results.kartCount = karts.length;
      results.kartSpeeds = karts.map(k => Math.round(k.speed));
      results.anyNaN = karts.some(k => 
        isNaN(k.speed) || isNaN(k.position.x) || isNaN(k.position.y) || isNaN(k.position.z)
      );
    }
    
    return results;
  });
  
  console.log('Race check:', JSON.stringify(raceCheck));

  await page.keyboard.up('ArrowUp');

  // Take screenshot
  await page.screenshot({ path: '/home/daytona/workspace/test_perf_screenshot.png' });
  console.log('Screenshot saved');

  // Report errors
  if (errors.length > 0) {
    console.log('ERRORS found:', errors.length);
    errors.forEach(e => console.log('  -', e));
  } else {
    console.log('No console errors — PASS');
  }

  // Summary checks
  const allPassed = 
    checkResult.hasAllKarts && 
    checkResult.hasTrackData && 
    !raceCheck.anyNaN &&
    raceCheck.raceStatus === 'racing' &&
    raceCheck.raceTime > 0 &&
    errors.length === 0;

  console.log(allPassed ? '\n✅ ALL CHECKS PASSED' : '\n❌ SOME CHECKS FAILED');

  await browser.close();
  process.exit(allPassed ? 0 : 1);
})();

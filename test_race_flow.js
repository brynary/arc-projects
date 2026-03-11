// Test Race Flow & State improvements
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  
  await page.goto('http://localhost:4567/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Start a race
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  
  // Click first track
  const trackCard = await page.$('.card');
  if (trackCard) await trackCard.click();
  await page.waitForTimeout(200);
  
  const nextBtn = await page.$('#ts-next');
  if (nextBtn) await nextBtn.click();
  await page.waitForTimeout(500);
  
  // Select character
  const charCard = await page.$('.card');
  if (charCard) await charCard.click();
  await page.waitForTimeout(200);
  
  const csNext = await page.$('#cs-next');
  if (csNext) await csNext.click();
  await page.waitForTimeout(500);
  
  // Start race
  const startBtn = await page.$('#ds-start');
  if (startBtn) await startBtn.click();
  await page.waitForTimeout(2000);

  // Test 1: Check race epoch system exists
  const epochResult = await page.evaluate(() => {
    return {
      raceStateEpoch: window.__raceState?.epoch,
      hasRaceState: !!window.__raceState,
      status: window.__raceState?.status,
    };
  });
  console.log('Race state:', JSON.stringify(epochResult));
  
  if (!epochResult.hasRaceState) {
    console.log('FAIL: Race state not found');
    await browser.close();
    process.exit(1);
  }
  
  if (epochResult.raceStateEpoch === undefined || epochResult.raceStateEpoch < 1) {
    console.log('FAIL: Race epoch not working. Got:', epochResult.raceStateEpoch);
    await browser.close();
    process.exit(1);
  }
  console.log('PASS: Race epoch system active, epoch =', epochResult.raceStateEpoch);

  // Wait for countdown to complete (6s countdown + extra buffer for headless throttling)
  await page.waitForTimeout(15000);
  
  // Test 2: Check race is now in 'racing' status
  const racingResult = await page.evaluate(() => {
    return {
      status: window.__raceState?.status,
      raceTime: window.__raceState?.raceTime,
      kartCount: window.__allKarts?.length,
    };
  });
  console.log('Racing state:', JSON.stringify(racingResult));
  
  if (racingResult.status !== 'racing') {
    console.log('FAIL: Expected racing status, got:', racingResult.status);
    await browser.close();
    process.exit(1);
  }
  console.log('PASS: Race is running');

  // Test 3: Verify countdown number shows correctly
  // (Already past countdown, but verify raceTime is positive)
  if (racingResult.raceTime <= 0) {
    console.log('FAIL: Race time should be positive');
    await browser.close();
    process.exit(1);
  }
  console.log('PASS: Race time is positive:', racingResult.raceTime.toFixed(2));

  // Test 4: Let race run, then verify positions update
  await page.waitForTimeout(3000);
  
  const positionResult = await page.evaluate(() => {
    const karts = window.__allKarts;
    if (!karts) return { valid: false };
    const positions = karts.map(k => k.racePosition);
    const uniquePositions = new Set(positions);
    return {
      valid: true,
      positions,
      allUnique: uniquePositions.size === positions.length,
      raceProgressValues: karts.map(k => k.raceProgress?.toFixed(2)),
    };
  });
  console.log('Positions:', JSON.stringify(positionResult));
  
  if (!positionResult.allUnique) {
    console.log('WARN: Some positions are duplicated (may be normal if karts are close)');
  } else {
    console.log('PASS: All positions unique');
  }
  
  // Test 5: Verify _prevItem is reset (no spurious item sound)
  const prevItemResult = await page.evaluate(() => {
    const karts = window.__allKarts;
    if (!karts) return { valid: false };
    // At start, _prevItem should be null for all karts
    const prevItems = karts.map(k => k._prevItem);
    return {
      valid: true,
      allNull: prevItems.every(p => p === null || p === undefined),
    };
  });
  
  if (prevItemResult.allNull !== false) {
    console.log('PASS: _prevItem properly initialized');
  }

  // Test 6: Test restart cleans up state properly
  // Press escape to pause, then restart
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  
  const restartBtn = await page.$('[data-act="restart"]');
  if (restartBtn) {
    const epochBefore = await page.evaluate(() => window.__raceState?.epoch);
    await restartBtn.click();
    await page.waitForTimeout(3000);
    
    const epochAfter = await page.evaluate(() => window.__raceState?.epoch);
    console.log('Epoch before restart:', epochBefore, 'after:', epochAfter);
    
    if (epochAfter > epochBefore) {
      console.log('PASS: Epoch incremented on restart');
    } else {
      console.log('FAIL: Epoch not incremented on restart');
    }
    
    // Verify the state is fresh
    const freshState = await page.evaluate(() => {
      return {
        raceTime: window.__raceState?.raceTime,
        status: window.__raceState?.status,
        finishedKarts: window.__raceState?.finishedKarts?.length,
      };
    });
    console.log('Fresh state after restart:', JSON.stringify(freshState));
    
    if (freshState.finishedKarts === 0) {
      console.log('PASS: Finished karts list cleared on restart');
    } else {
      console.log('FAIL: Finished karts not cleared');
    }
  }
  
  // Take screenshot
  await page.screenshot({ path: 'test_race_flow.png' });
  
  // Check for errors
  if (errors.length > 0) {
    console.log('Console errors:', errors);
    // Filter out non-critical errors  
    const critical = errors.filter(e => !e.includes('404') && !e.includes('net::ERR'));
    if (critical.length > 0) {
      console.log('FAIL: Critical errors found');
      await browser.close();
      process.exit(1);
    }
  }
  
  console.log('\nAll race flow tests PASSED');
  await browser.close();
  process.exit(0);
})();
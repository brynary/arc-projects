// Comprehensive race flow verification test
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  let errors = [];
  page.on('pageerror', e => errors.push(e.message));
  
  await page.goto('http://localhost:4567', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Navigate menus
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);
  const trackCards = await page.$$('.card');
  if (trackCards.length > 0) await trackCards[0].click();
  await page.waitForTimeout(200);
  await page.click('#ts-next');
  await page.waitForTimeout(400);
  const charCards = await page.$$('.card');
  if (charCards.length > 0) await charCards[0].click();
  await page.waitForTimeout(200);
  await page.click('#cs-next');
  await page.waitForTimeout(400);
  await page.click('#ds-start');
  await page.waitForTimeout(1000);

  // Wait for race to start
  console.log('--- Test 1: No false first-lap ---');
  await page.waitForTimeout(8000); // Countdown

  // Drive forward
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(5000);

  const t1 = await page.evaluate(() => {
    const pk = window.__allKarts?.find(k => k.isPlayer);
    return {
      currentLap: pk?.currentLap,
      lastCheckpoint: pk?.lastCheckpoint,
      lapTimesCount: pk?.lapTimes?.length,
    };
  });
  console.log('After 5s driving:', JSON.stringify(t1));
  console.log(t1.currentLap === 0 ? 'PASS: No false first-lap' : 'FAIL: False first-lap detected');

  // --- Test 2: Check all 8 karts ---
  console.log('\n--- Test 2: All karts racing ---');
  const kartStates = await page.evaluate(() => {
    return window.__allKarts?.map(k => ({
      id: k.characterId,
      isPlayer: k.isPlayer,
      speed: Math.abs(k.speed).toFixed(1),
      lastCP: k.lastCheckpoint,
      lap: k.currentLap,
      finished: k.finished,
    }));
  });
  console.log('Karts:', JSON.stringify(kartStates, null, 2));
  
  // --- Test 3: HUD shows correct info ---
  console.log('\n--- Test 3: HUD correctness ---');
  const hudState = await page.evaluate(() => {
    return {
      lap: document.getElementById('hl')?.textContent,
      timer: document.getElementById('ht-main')?.textContent,
      position: document.getElementById('hp')?.textContent?.trim(),
    };
  });
  console.log('HUD:', JSON.stringify(hudState));
  console.log(hudState.lap === 'Lap 1/3' ? 'PASS: HUD shows Lap 1/3' : `FAIL: HUD shows ${hudState.lap}`);
  // Timer should show a positive time
  console.log(hudState.timer && hudState.timer !== '0:00.0' ? 'PASS: Timer is running' : 'FAIL: Timer not running');

  // --- Test 4: Race epoch and state are clean ---
  console.log('\n--- Test 4: Race state integrity ---');
  const raceIntegrity = await page.evaluate(() => {
    const rs = window.__raceState;
    return {
      status: rs?.status,
      epoch: rs?.epoch,
      raceTime: rs?.raceTime?.toFixed(2),
      finishedCount: rs?.finishedKarts?.length,
      allFinished: rs?.allFinished,
    };
  });
  console.log('Race state:', JSON.stringify(raceIntegrity));
  console.log(raceIntegrity.status === 'racing' ? 'PASS: Status is racing' : `FAIL: Status is ${raceIntegrity.status}`);
  console.log(raceIntegrity.allFinished === false ? 'PASS: allFinished is false' : 'FAIL: allFinished should be false');

  await page.keyboard.up('ArrowUp');
  
  // --- Test 5: Console errors ---
  console.log('\n--- Test 5: Console errors ---');
  console.log(errors.length === 0 ? 'PASS: No console errors' : `FAIL: ${errors.length} errors: ${errors.join(', ')}`);

  // Take screenshot
  await page.screenshot({ path: 'test_raceflow_verified.png' });
  
  // --- Test 6: Quick restart keeps state clean ---
  console.log('\n--- Test 6: Restart state cleanup ---');
  await page.keyboard.press('Escape'); // Pause
  await page.waitForTimeout(500);
  const restartBtn = await page.$('[data-act="restart"]');
  if (restartBtn) {
    await restartBtn.click();
    await page.waitForTimeout(9000); // Wait for new countdown
    
    const afterRestart = await page.evaluate(() => {
      const rs = window.__raceState;
      const pk = window.__allKarts?.find(k => k.isPlayer);
      return {
        status: rs?.status,
        raceTime: rs?.raceTime?.toFixed(2),
        playerLap: pk?.currentLap,
        playerLastCP: pk?.lastCheckpoint,
        lapTimes: pk?.lapTimes?.length,
        allFinished: rs?.allFinished,
      };
    });
    console.log('After restart:', JSON.stringify(afterRestart));
    console.log(afterRestart.playerLap === 0 ? 'PASS: Lap reset' : 'FAIL: Lap not reset');
    console.log(afterRestart.allFinished === false ? 'PASS: allFinished reset' : 'FAIL: allFinished not reset');
  }

  console.log('\n--- Final errors check ---');
  console.log(errors.length === 0 ? 'PASS: No console errors overall' : `FAIL: ${errors.length} errors`);

  await browser.close();
  console.log('All tests complete');
})();

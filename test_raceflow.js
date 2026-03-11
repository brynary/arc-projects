// Test race flow: verify first-lap detection, race lifecycle, state resets
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:4567', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Start a race on Sunset Bay
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);
  // Click first track (Sunset Bay)
  const trackCards = await page.$$('.card');
  if (trackCards.length > 0) await trackCards[0].click();
  await page.waitForTimeout(300);
  await page.click('#ts-next');
  await page.waitForTimeout(500);
  // Select first character
  const charCards = await page.$$('.card');
  if (charCards.length > 0) await charCards[0].click();
  await page.waitForTimeout(300);
  await page.click('#cs-next');
  await page.waitForTimeout(500);
  // Start race
  await page.click('#ds-start');
  await page.waitForTimeout(1000);

  // Wait for countdown to finish + race to start
  console.log('Waiting for countdown...');
  await page.waitForTimeout(8000);

  // Check initial race state
  const state1 = await page.evaluate(() => {
    const rs = window.__raceState;
    const pk = window.__allKarts?.find(k => k.isPlayer);
    return {
      status: rs?.status,
      raceTime: rs?.raceTime?.toFixed(2),
      playerLap: pk?.currentLap,
      playerLastCP: pk?.lastCheckpoint,
      playerPosition: pk?.racePosition,
      numCheckpoints: window.__trackData?.checkpoints?.length,
      lapTimesCount: pk?.lapTimes?.length,
    };
  });
  console.log('After countdown (before driving):', JSON.stringify(state1));

  // Drive forward for ~5 seconds (to reach checkpoint 0)
  console.log('Driving forward...');
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(5000);

  const state2 = await page.evaluate(() => {
    const rs = window.__raceState;
    const pk = window.__allKarts?.find(k => k.isPlayer);
    return {
      status: rs?.status,
      raceTime: rs?.raceTime?.toFixed(2),
      playerLap: pk?.currentLap,
      playerLastCP: pk?.lastCheckpoint,
      playerPosition: pk?.racePosition,
      lapTimes: pk?.lapTimes?.map(t => t.toFixed(2)),
      lapTimesCount: pk?.lapTimes?.length,
    };
  });
  console.log('After 5s of driving:', JSON.stringify(state2));

  // Check if lap was falsely triggered
  if (state2.playerLap > 0 && state2.lapTimesCount > 0 && parseFloat(state2.lapTimes[0]) < 10) {
    console.log('BUG CONFIRMED: False first-lap completion detected! First "lap" only took', state2.lapTimes[0], 'seconds');
  } else if (state2.playerLap === 0) {
    console.log('OK: No false first-lap completion');
  }

  // Check the HUD display
  const hudLap = await page.evaluate(() => document.getElementById('hl')?.textContent);
  console.log('HUD lap display:', hudLap);

  // Continue driving to check more
  await page.waitForTimeout(5000);
  
  const state3 = await page.evaluate(() => {
    const rs = window.__raceState;
    const pk = window.__allKarts?.find(k => k.isPlayer);
    return {
      raceTime: rs?.raceTime?.toFixed(2),
      playerLap: pk?.currentLap,
      playerLastCP: pk?.lastCheckpoint,
      lapTimesCount: pk?.lapTimes?.length,
    };
  });
  console.log('After 10s total driving:', JSON.stringify(state3));
  
  await page.keyboard.up('ArrowUp');
  
  // Take a screenshot
  await page.screenshot({ path: 'test_raceflow_screenshot.png' });
  console.log('Screenshot saved');

  await browser.close();
  console.log('Done');
})();

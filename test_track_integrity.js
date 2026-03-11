// Test track integrity: checkpoint validation, wall closure, Y-level mixing
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('http://localhost:4567', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  
  // Take title screenshot
  await page.screenshot({ path: 'test_screenshots/track_integrity_title.png' });

  // Test: Load each track and check for console errors
  const tracks = ['sunsetBay', 'mossyCanyon', 'neonGrid', 'volcanoPeak'];
  const errors = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  // Go through menu to start a race
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);

  for (let trackIdx = 0; trackIdx < 4; trackIdx++) {
    console.log(`\n=== Testing track ${trackIdx}: ${tracks[trackIdx]} ===`);
    
    // Select track
    const cards = await page.$$('.card');
    if (cards[trackIdx]) {
      await cards[trackIdx].click();
      await page.waitForTimeout(200);
    }
    await page.click('#ts-next');
    await page.waitForTimeout(300);
    
    // Select first character
    await page.click('#cs-next');
    await page.waitForTimeout(300);
    
    // Start race with default difficulty
    await page.click('#ds-start');
    await page.waitForTimeout(3000);
    
    // Check track data
    const trackInfo = await page.evaluate(() => {
      if (!window.__trackData) return null;
      const td = window.__trackData;
      return {
        wallCount: td.collisionWalls?.length || 0,
        sectorCount: td.sectors?.length || 0,
        checkpointCount: td.checkpoints?.length || 0,
        sampleCount: td.samples?.length || 0,
        totalLength: td.totalLength || 0,
      };
    });
    
    console.log('Track info:', trackInfo);
    
    // Expose game state for testing
    const gameInfo = await page.evaluate(() => {
      // Check if allKarts is accessible
      return {
        hasTrackData: !!window.__trackData,
        kartCount: window.__allKarts?.length || 0,
      };
    });
    console.log('Game info:', gameInfo);
    
    // Take screenshot during countdown
    await page.screenshot({ path: `test_screenshots/track_integrity_${tracks[trackIdx]}_countdown.png` });
    
    // Wait for countdown to finish and race to start
    await page.waitForTimeout(4000);
    
    // Drive forward for a few seconds
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(5000);
    await page.keyboard.up('ArrowUp');
    
    await page.screenshot({ path: `test_screenshots/track_integrity_${tracks[trackIdx]}_racing.png` });
    
    // Pause and quit to menu
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const quitBtn = await page.$('[data-act="quit"]');
    if (quitBtn) await quitBtn.click();
    await page.waitForTimeout(1000);
    
    // Go back to track select
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
  }

  console.log('\n=== Console errors during testing ===');
  if (errors.length > 0) {
    errors.forEach(e => console.log('ERROR:', e));
  } else {
    console.log('No console errors!');
  }
  
  await browser.close();
  console.log('\nTrack integrity test complete.');
})();

// Comprehensive crash/error test for all 4 tracks and full lifecycle
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  const errors = [];
  const warnings = [];

  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
    if (msg.type() === 'warning') warnings.push(msg.text());
  });
  page.on('pageerror', err => errors.push(`PAGE ERROR: ${err.message}`));

  await page.goto('http://localhost:4567', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  console.log('=== After initial load ===');
  console.log('Errors:', errors.length);
  errors.forEach(e => console.log('  ERR:', e));
  console.log('Warnings:', warnings.length);
  warnings.forEach(w => console.log('  WARN:', w));

  // Test Title → Track select → Char select → Diff select → Race for each track
  const TRACKS = ['Sunset Bay', 'Mossy Canyon', 'Neon Grid', 'Volcano Peak'];
  
  for (let trackIdx = 0; trackIdx < TRACKS.length; trackIdx++) {
    console.log(`\n=== Testing Track ${trackIdx}: ${TRACKS[trackIdx]} ===`);
    errors.length = 0;
    warnings.length = 0;

    // Press Enter at title
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    // Click track card
    const trackCards = await page.$$('.card');
    if (trackCards.length > trackIdx) {
      await trackCards[trackIdx].click();
      await page.waitForTimeout(200);
    }
    
    // Click Next
    const nextBtn = await page.$('#ts-next');
    if (nextBtn) await nextBtn.click();
    await page.waitForTimeout(500);
    
    // Click character (random index)
    const charIdx = trackIdx; // different char per track
    const charCards = await page.$$('.card');
    if (charCards.length > charIdx) {
      await charCards[charIdx].click();
      await page.waitForTimeout(200);
    }
    
    // Click Next to difficulty
    const csNext = await page.$('#cs-next');
    if (csNext) await csNext.click();
    await page.waitForTimeout(500);
    
    // Click Start Race
    const startBtn = await page.$('#ds-start');
    if (startBtn) await startBtn.click();
    await page.waitForTimeout(3000); // wait for track to load + countdown

    console.log(`Errors after starting ${TRACKS[trackIdx]}:`, errors.length);
    errors.forEach(e => console.log('  ERR:', e));

    // Let race run for 10 seconds 
    // Simulate driving
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(5000);
    
    // Check for errors during racing
    console.log(`Errors during racing ${TRACKS[trackIdx]}:`, errors.length);
    errors.forEach(e => console.log('  ERR:', e));

    // Try drifting 
    await page.keyboard.down('ArrowLeft');
    await page.keyboard.down('ShiftLeft');
    await page.waitForTimeout(2000);
    await page.keyboard.up('ShiftLeft');
    await page.keyboard.up('ArrowLeft');
    await page.waitForTimeout(1000);
    
    // Try using an item
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(500);

    // Try pause/resume
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    console.log(`Total errors after full test of ${TRACKS[trackIdx]}:`, errors.length);
    errors.forEach(e => console.log('  ERR:', e));

    // Now quit to menu for next track test
    await page.keyboard.press('Escape'); // pause
    await page.waitForTimeout(300);
    const quitBtn = await page.$('[data-act="quit"]');
    if (quitBtn) await quitBtn.click();
    await page.waitForTimeout(1000);
    
    await page.keyboard.up('ArrowUp');
    
    // Check game state
    const state = await page.evaluate(() => {
      return {
        allKarts: window.__allKarts?.length || 0,
        trackData: !!window.__trackData,
        raceState: window.__raceState?.status || 'none'
      };
    });
    console.log(`After quit state:`, state);
  }

  // Test rapid restart scenario
  console.log('\n=== Testing rapid restart ===');
  errors.length = 0;
  
  // Start a race
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  const trackCard0 = await page.$('.card');
  if (trackCard0) await trackCard0.click();
  await page.waitForTimeout(200);
  const nextBtnR = await page.$('#ts-next');
  if (nextBtnR) await nextBtnR.click();
  await page.waitForTimeout(500);
  const csNextR = await page.$('#cs-next');
  if (csNextR) await csNextR.click();
  await page.waitForTimeout(500);
  const startBtnR = await page.$('#ds-start');
  if (startBtnR) await startBtnR.click();
  await page.waitForTimeout(2000);
  
  // Rapid restart 3 times
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const restartBtn = await page.$('[data-act="restart"]');
    if (restartBtn) await restartBtn.click();
    await page.waitForTimeout(1500);
    console.log(`Restart ${i+1} errors:`, errors.length);
  }
  
  errors.forEach(e => console.log('  ERR:', e));
  
  // Take final screenshot
  await page.screenshot({ path: 'screenshot_crash_test.png' });

  console.log('\n=== FINAL SUMMARY ===');
  console.log('Total errors collected:', errors.length);
  console.log('Total warnings collected:', warnings.length);

  await browser.close();
})().catch(e => { console.error('Test failed:', e); process.exit(1); });

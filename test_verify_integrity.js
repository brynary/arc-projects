// Verify track integrity improvements work correctly
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));
  
  await page.goto('http://localhost:4567', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Test all 4 tracks load correctly
  const tracks = ['Sunset Bay', 'Mossy Canyon', 'Neon Grid', 'Volcano Peak'];
  
  for (let trackIdx = 0; trackIdx < 4; trackIdx++) {
    console.log(`\n=== Testing track ${trackIdx}: ${tracks[trackIdx]} ===`);
    errors.length = 0; // reset errors for each track
    
    // Press Enter on title
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
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
    await page.waitForTimeout(4000); // wait for track to load
    
    // Take screenshot during countdown/early race
    await page.screenshot({ path: `test_screenshots/verify_${trackIdx}_start.png` });
    
    // Wait through countdown
    await page.waitForTimeout(4000);
    
    // Drive forward
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(3000);
    
    // Take screenshot during racing
    await page.screenshot({ path: `test_screenshots/verify_${trackIdx}_racing.png` });
    
    // Try steering and drifting
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(1000);
    await page.keyboard.up('ArrowRight');
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(1000);
    await page.keyboard.up('ArrowLeft');
    await page.keyboard.up('ArrowUp');
    
    await page.screenshot({ path: `test_screenshots/verify_${trackIdx}_after.png` });
    
    // Check for errors
    if (errors.length > 0) {
      console.log(`ERRORS on ${tracks[trackIdx]}:`);
      errors.forEach(e => console.log('  -', e));
    } else {
      console.log(`✓ ${tracks[trackIdx]}: No errors`);
    }
    
    // Quit to menu
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const quitBtn = await page.$('[data-act="quit"]');
    if (quitBtn) await quitBtn.click();
    await page.waitForTimeout(1000);
  }

  // Test reverse direction checkpoint prevention
  console.log('\n=== Testing reverse-direction checkpoint prevention ===');
  errors.length = 0;
  
  // Start a race on Sunset Bay (simplest track)
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  await page.click('#ts-next');
  await page.waitForTimeout(300);
  await page.click('#cs-next');
  await page.waitForTimeout(300);
  await page.click('#ds-start');
  await page.waitForTimeout(8000); // wait through countdown
  
  // Drive backward (brake) for a bit — shouldn't trigger checkpoint behind us
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(3000);
  await page.keyboard.up('ArrowDown');
  
  await page.screenshot({ path: 'test_screenshots/verify_reverse_test.png' });
  
  if (errors.length > 0) {
    console.log('Errors during reverse test:');
    errors.forEach(e => console.log('  -', e));
  } else {
    console.log('✓ Reverse test: No errors');
  }
  
  await browser.close();
  console.log('\n=== All track integrity tests complete ===');
})();

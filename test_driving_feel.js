// Test driving feel improvements: high-speed turn damping, overspeed decel, drift counter-steer
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto('http://localhost:4567/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);

  // Press Enter to start
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);

  // Select first track (click Next)
  const nextBtn1 = await page.$('.menu-btn');
  if (nextBtn1) await nextBtn1.click();
  await page.waitForTimeout(500);

  // Select first character (click Next)
  const nextBtn2 = await page.$('.menu-btn');
  if (nextBtn2) await nextBtn2.click();
  await page.waitForTimeout(500);

  // Start race
  const startBtn = await page.$('#ds-start');
  if (startBtn) await startBtn.click();
  await page.waitForTimeout(5500); // Wait for countdown

  // Drive forward
  console.log('Driving forward...');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(3000);

  await page.screenshot({ path: 'test_ss_driving.png' });
  console.log('Driving screenshot taken');

  // Test drift with counter-steer
  console.log('Testing drift with counter-steer...');
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(200);
  await page.keyboard.down('ShiftLeft');
  await page.waitForTimeout(1500);
  
  // Counter-steer (switch from A to D while drifting)
  await page.keyboard.up('KeyA');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1000);
  
  await page.screenshot({ path: 'test_ss_drift.png' });

  // Release drift
  await page.keyboard.up('ShiftLeft');
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(500);

  // Continue driving for a while
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'test_ss_mid_race.png' });
  console.log('Mid-race screenshot taken');

  // Release accel (test coast overspeed decel)
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(2000);
  console.log('Coast test done');

  // Resume and drive more
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(8000);
  await page.screenshot({ path: 'test_ss_late_race.png' });

  // Check HUD
  const hudOK = await page.evaluate(() => {
    const hp = document.getElementById('hp');
    const hl = document.getElementById('hl');
    return hp && hl && hp.textContent.length > 0 && hl.textContent.length > 0;
  });
  console.log('HUD working:', hudOK);

  // Summary
  console.log(`\nConsole errors: ${errors.length}`);
  if (errors.length > 0) {
    errors.forEach(e => console.log('  ERROR:', e));
  } else {
    console.log('All clear - no errors!');
  }

  await browser.close();
  process.exit(errors.length > 0 ? 1 : 0);
})();

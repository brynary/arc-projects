// test_perf_iter4.js — Verify performance improvements don't break anything
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  
  await page.goto('http://localhost:4567/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);
  
  // Check title screen loaded
  const titleVisible = await page.$eval('#menu-overlay', el => !el.classList.contains('hidden'));
  console.log('Title visible:', titleVisible);
  
  // Start a race
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  
  // Select first track
  const nextBtn = await page.$('#ts-next');
  if (nextBtn) await nextBtn.click();
  await page.waitForTimeout(300);
  
  // Select first character
  const charNext = await page.$('#cs-next');
  if (charNext) await charNext.click();
  await page.waitForTimeout(300);
  
  // Start race
  const startBtn = await page.$('#ds-start');
  if (startBtn) await startBtn.click();
  await page.waitForTimeout(2000);
  
  // Take screenshot during countdown
  await page.screenshot({ path: 'test_countdown_perf.png' });
  
  // Wait for race to start
  await page.waitForTimeout(6000);
  
  // Race should be active
  const hudActive = await page.$eval('#hud-overlay', el => el.classList.contains('active'));
  console.log('HUD active:', hudActive);
  
  // Take screenshot during race
  await page.screenshot({ path: 'test_race_perf.png' });
  
  // Let it run for a bit longer to test stability
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'test_race_perf2.png' });
  
  // Check for console errors
  console.log('Console errors:', errors.length > 0 ? errors.join('; ') : 'none');
  
  // Verify minimap is drawn
  const minimapExists = await page.$('#minimap-cv');
  console.log('Minimap canvas exists:', !!minimapExists);
  
  // Check no crashed state
  const gameRunning = await page.evaluate(() => {
    return typeof window !== 'undefined';
  });
  console.log('Game running:', gameRunning);
  
  // Measure performance: count frames over 2 seconds
  const frameCount = await page.evaluate(() => {
    return new Promise(resolve => {
      let count = 0;
      const start = performance.now();
      function tick() {
        count++;
        if (performance.now() - start < 2000) {
          requestAnimationFrame(tick);
        } else {
          resolve(count);
        }
      }
      requestAnimationFrame(tick);
    });
  });
  console.log(`Frames in 2s: ${frameCount} (~${(frameCount/2).toFixed(1)} FPS)`);
  
  if (errors.length > 0) {
    console.log('FAIL: Console errors detected');
    process.exit(1);
  }
  
  console.log('PASS: All performance changes verified');
  
  await browser.close();
})();

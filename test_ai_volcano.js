// Test AI reliability by exposing internal state and running at accelerated speed
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));
  
  await page.goto('http://localhost:4567/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  
  // Navigate to race
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  
  // Select Volcano Peak (most complex track)
  const trackCards = await page.$$('.card');
  if (trackCards[3]) await trackCards[3].click();
  await page.waitForTimeout(200);
  await page.click('#ts-next');
  await page.waitForTimeout(300);
  await page.click('#cs-next');
  await page.waitForTimeout(300);
  await page.click('#ds-start');
  await page.waitForTimeout(2000); // Let track load
  
  // Inject state exposure into game module
  await page.evaluate(() => {
    // Hook into the game loop to expose kart states
    window.__aiSnapshots = [];
    window.__snapshotInterval = setInterval(() => {
      // Access game scene children to find kart meshes
      const scene = document.querySelector('canvas')?.__scene;
    }, 1000);
  });
  
  // Wait for countdown + 20s of racing  
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(25000);
  
  // Take screenshot
  await page.screenshot({ path: 'ai_volcano_test.png' });
  
  const hudInfo = await page.evaluate(() => {
    return {
      pos: document.getElementById('hp')?.textContent || '',
      lap: document.getElementById('hl')?.textContent || '',
      time: document.getElementById('ht-main')?.textContent || '',
    };
  });
  console.log(`After 25s: ${hudInfo.lap} | ${hudInfo.pos} | time=${hudInfo.time}`);
  
  // Wait 20 more seconds
  await page.waitForTimeout(20000);
  await page.screenshot({ path: 'ai_volcano_test2.png' });
  
  const hudInfo2 = await page.evaluate(() => {
    return {
      pos: document.getElementById('hp')?.textContent || '',
      lap: document.getElementById('hl')?.textContent || '',
      time: document.getElementById('ht-main')?.textContent || '',
    };
  });
  console.log(`After 45s: ${hudInfo2.lap} | ${hudInfo2.pos} | time=${hudInfo2.time}`);
  
  await page.keyboard.up('ArrowUp');
  
  console.log(`Errors: ${errors.length}`);
  errors.forEach(e => console.log(`  ERR: ${e}`));
  
  await browser.close();
})();

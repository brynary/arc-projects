// Quick AI test: start race on track 0, observe AI for 30s
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
  await page.waitForTimeout(400);
  await page.click('#ts-next');
  await page.waitForTimeout(400);
  await page.click('#cs-next');
  await page.waitForTimeout(400);
  await page.click('#ds-start');
  await page.waitForTimeout(8000); // countdown
  
  // Hold accelerate + slight steering
  await page.keyboard.down('ArrowUp');
  
  // Expose game state for inspection
  await page.evaluate(() => {
    // Patch to expose allKarts 
    window.__getAIState = () => {
      // Access via module scope - need to find karts in the scene
      const scene = window.__scene;
      if (!scene) return null;
      return 'no direct access';
    };
  });
  
  // Sample every 3 seconds for 30 seconds
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(3000);
    
    const hudInfo = await page.evaluate(() => {
      const pos = document.getElementById('hp')?.textContent || '';
      const lap = document.getElementById('hl')?.textContent || '';
      const time = document.getElementById('ht-main')?.textContent || '';
      const countdown = document.getElementById('hcd')?.textContent || '';
      return { pos, lap, time, countdown };
    });
    
    console.log(`t=${(i+1)*3}s: ${hudInfo.lap} | ${hudInfo.pos} | time=${hudInfo.time}`);
    
    if (i === 0 || i === 4 || i === 9) {
      await page.screenshot({ path: `ai_test_t${(i+1)*3}.png` });
    }
  }
  
  await page.keyboard.up('ArrowUp');
  
  // Check for results
  const final = await page.evaluate(() => {
    const rp = document.getElementById('results-panel');
    return { resultsVisible: rp && !rp.classList.contains('hidden') };
  });
  
  console.log(`\nResults visible: ${final.resultsVisible}`);
  console.log(`Errors: ${errors.length}`);
  errors.slice(0, 5).forEach(e => console.log(`  ${e}`));
  
  await browser.close();
})();

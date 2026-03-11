// Test AI reliability: check if AI karts get stuck, complete laps, finish races
import { chromium } from 'playwright';

const TRACKS = [0, 1, 2, 3];
const TRACK_NAMES = ['Sunset Bay', 'Mossy Canyon', 'Neon Grid', 'Volcano Peak'];

(async () => {
  const browser = await chromium.launch({ headless: true });
  
  for (const trackIdx of TRACKS) {
    console.log(`\n=== Testing ${TRACK_NAMES[trackIdx]} (track ${trackIdx}) ===`);
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    
    // Collect console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));
    
    await page.goto('http://localhost:4567/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    
    // Start race: press Enter -> select track -> next -> next -> start
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    // Select track
    const trackCards = await page.$$('.card');
    if (trackCards[trackIdx]) await trackCards[trackIdx].click();
    await page.waitForTimeout(200);
    await page.click('#ts-next');
    await page.waitForTimeout(500);
    
    // Select character (just use default)
    await page.click('#cs-next');
    await page.waitForTimeout(500);
    
    // Start race
    await page.click('#ds-start');
    await page.waitForTimeout(1000); // Wait for track to load
    
    // Wait for countdown (6s) + a bit more
    await page.waitForTimeout(7000);
    
    // Hold accelerate for the entire race
    await page.keyboard.down('ArrowUp');
    
    // Sample AI state periodically for 60 seconds
    const samples = [];
    const NUM_SAMPLES = 20;
    const SAMPLE_INTERVAL = 3000; // 3 seconds between samples
    
    for (let s = 0; s < NUM_SAMPLES; s++) {
      await page.waitForTimeout(SAMPLE_INTERVAL);
      
      const state = await page.evaluate(() => {
        if (typeof window.__allKarts === 'undefined') {
          // Try to find allKarts from the module scope - we need to expose it
          return null;
        }
        return null;
      });
      
      // Take a screenshot at key moments
      if (s === 0 || s === 5 || s === 10 || s === 15 || s === 19) {
        await page.screenshot({ path: `test_ai_track${trackIdx}_t${s}.png` });
      }
      
      // Check HUD for race time and position info
      const hudInfo = await page.evaluate(() => {
        const pos = document.getElementById('hp')?.textContent || '';
        const lap = document.getElementById('hl')?.textContent || '';
        const time = document.getElementById('ht-main')?.textContent || '';
        return { pos, lap, time };
      });
      
      console.log(`  t=${s*3}s: ${hudInfo.lap} ${hudInfo.pos} time=${hudInfo.time}`);
      samples.push(hudInfo);
    }
    
    await page.keyboard.up('ArrowUp');
    
    // Check for race completion or stuck states
    const finalState = await page.evaluate(() => {
      const resultsPanel = document.getElementById('results-panel');
      const isResultsVisible = resultsPanel && !resultsPanel.classList.contains('hidden');
      return { isResultsVisible };
    });
    
    console.log(`  Race completed: ${finalState.isResultsVisible}`);
    if (errors.length > 0) {
      console.log(`  Errors (${errors.length}):`, errors.slice(0, 5));
    } else {
      console.log(`  No console errors ✓`);
    }
    
    await page.close();
  }
  
  await browser.close();
  console.log('\nDone!');
})();

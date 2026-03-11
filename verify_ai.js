// Verify AI improvements: test on Sunset Bay + Volcano Peak
import { chromium } from 'playwright';

const TRACKS = [
  { idx: 0, name: 'Sunset Bay' },
  { idx: 3, name: 'Volcano Peak' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  
  for (const track of TRACKS) {
    console.log(`\n=== ${track.name} ===`);
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.message));
    
    await page.goto('http://localhost:4567/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    
    // Navigate to race
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    
    // Select track
    const cards = await page.$$('.card');
    if (cards[track.idx]) await cards[track.idx].click();
    await page.waitForTimeout(200);
    await page.click('#ts-next');
    await page.waitForTimeout(300);
    await page.click('#cs-next');
    await page.waitForTimeout(300);
    await page.click('#ds-start');
    await page.waitForTimeout(2000);
    
    // Hold accelerate
    await page.keyboard.down('ArrowUp');
    
    // Sample at intervals
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(3000);
      
      const hudInfo = await page.evaluate(() => ({
        pos: document.getElementById('hp')?.textContent || '',
        lap: document.getElementById('hl')?.textContent || '',
        time: document.getElementById('ht-main')?.textContent || '',
      }));
      
      console.log(`  t=${(i+1)*3}s: ${hudInfo.lap} | ${hudInfo.pos} | time=${hudInfo.time}`);
    }
    
    // Take screenshot at end
    await page.screenshot({ path: `verify_ai_${track.name.replace(/\s/g, '_')}.png` });
    
    await page.keyboard.up('ArrowUp');
    
    if (errors.length > 0) {
      console.log(`  ❌ Errors (${errors.length}):`);
      errors.slice(0, 5).forEach(e => console.log(`    ${e}`));
    } else {
      console.log(`  ✓ No console errors`);
    }
    
    await page.close();
  }
  
  await browser.close();
  console.log('\nDone!');
})();

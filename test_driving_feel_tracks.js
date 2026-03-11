// Visual verification: start race on each track, race for 5 seconds, screenshot
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const tracks = ['Sunset Bay', 'Mossy Canyon', 'Neon Grid', 'Volcano Peak'];
  
  for (let t = 0; t < 4; t++) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    
    await page.goto('http://localhost:4567/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    
    // Press Enter
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    // Click correct track
    const cards = await page.$$('.card');
    if (cards[t]) await cards[t].click();
    await page.waitForTimeout(200);
    
    const nextBtn = await page.$('#ts-next');
    if (nextBtn) await nextBtn.click();
    await page.waitForTimeout(400);
    
    const charCard = await page.$('.card');
    if (charCard) await charCard.click();
    await page.waitForTimeout(200);
    
    const csNext = await page.$('#cs-next');
    if (csNext) await csNext.click();
    await page.waitForTimeout(400);
    
    const startBtn = await page.$('#ds-start');
    if (startBtn) await startBtn.click();
    
    // Wait for countdown + a few seconds of racing
    await page.waitForTimeout(7000);
    
    // Hold accelerate + drift for a second to test driving feel
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(1000);
    await page.keyboard.down('KeyD');
    await page.keyboard.down('ShiftLeft');
    await page.waitForTimeout(1500);
    await page.keyboard.up('ShiftLeft');
    await page.waitForTimeout(500);
    
    await page.screenshot({ path: `test_track${t}_feel.png` });
    
    const trackErrors = errors.filter(e => !e.includes('404'));
    console.log(`Track ${t} (${tracks[t]}): ${trackErrors.length === 0 ? 'CLEAN' : 'ERRORS: ' + trackErrors.join('; ')}`);
    
    await page.keyboard.up('KeyW');
    await page.keyboard.up('KeyD');
    await page.close();
  }
  
  await browser.close();
  console.log('All tracks verified');
})();

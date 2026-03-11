// Quick smoke test: load all 4 tracks, check for errors
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const trackNames = ['Sunset Bay', 'Mossy Canyon', 'Neon Grid', 'Volcano Peak'];
  let allPassed = true;
  
  for (let t = 0; t < 4; t++) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    
    await page.goto('http://localhost:4567', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(800);
    
    // Title → Track Select
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    
    // Select track t
    const cards = await page.$$('.card');
    if (cards[t]) await cards[t].click();
    await page.waitForTimeout(200);
    await page.click('.menu-btn');
    await page.waitForTimeout(400);
    
    // Char select → next
    await page.click('.menu-btn');
    await page.waitForTimeout(400);
    
    // Start race
    await page.click('#ds-start');
    await page.waitForTimeout(4000);
    
    // Drive for a few seconds
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(4000);
    await page.keyboard.up('ArrowUp');
    
    const result = await page.evaluate(() => {
      const karts = window.__allKarts;
      return {
        kartCount: karts?.length || 0,
        racing: karts?.filter(k => !k.finished).length || 0,
        anyErrors: false
      };
    });
    
    const pass = errors.length === 0 && result.kartCount === 8;
    console.log(`${trackNames[t]}: ${pass ? 'PASS' : 'FAIL'} (${result.kartCount} karts, ${result.racing} racing, ${errors.length} errors)`);
    if (!pass) {
      errors.forEach(e => console.log(`  ERROR: ${e}`));
      allPassed = false;
    }
    
    await page.close();
  }
  
  await browser.close();
  console.log(allPassed ? '\nALL TRACKS PASS' : '\nSOME TRACKS FAILED');
  process.exit(allPassed ? 0 : 1);
})();

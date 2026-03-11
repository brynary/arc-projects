// Quick multi-track smoke test for driving feel changes
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', e => errors.push(e.message));

  const tracks = ['Sunset Bay', 'Mossy Canyon', 'Neon Grid', 'Volcano Peak'];

  for (let t = 0; t < 4; t++) {
    await page.goto('http://localhost:4567/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    
    // Click the t-th track card
    const cards = await page.$$('.card');
    if (cards[t]) await cards[t].click();
    await page.waitForTimeout(200);
    
    await page.click('#ts-next');
    await page.waitForTimeout(300);
    await page.click('#cs-next');
    await page.waitForTimeout(300);
    await page.click('#ds-start');
    
    // Wait for countdown + a bit of racing
    await page.waitForTimeout(8000);
    
    // Drive forward
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(3000);
    
    const state = await page.evaluate(() => ({
      racing: window.__raceState?.status === 'racing',
      speed: window.__allKarts?.[0]?.speed?.toFixed(1),
      blend: window.__allKarts?.[0]?.surfaceBlend?.toFixed(3),
      karts: window.__allKarts?.length,
      allBlend: window.__allKarts?.every(k => k.surfaceBlend !== undefined),
    }));
    
    console.log(`${tracks[t]}: racing=${state.racing} speed=${state.speed} blend=${state.blend} karts=${state.karts} allBlend=${state.allBlend}`);
    await page.keyboard.up('KeyW');
  }
  
  console.log('\nErrors:', errors.length);
  if (errors.length > 0) errors.slice(0, 5).forEach(e => console.log('  ERR:', e));
  console.log(errors.length === 0 ? '✅ All tracks clean' : '❌ Errors found');
  
  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });

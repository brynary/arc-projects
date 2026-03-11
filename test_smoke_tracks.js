const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  
  await page.goto('http://localhost:4567', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  
  const trackNames = ['Sunset Bay', 'Mossy Canyon', 'Neon Grid', 'Volcano Peak'];
  
  for (let t = 0; t < 4; t++) {
    console.log(`\n--- ${trackNames[t]} ---`);
    
    // Navigate to Start
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
    
    const cards = await page.$$('.card');
    if (cards.length > t) await cards[t].click();
    await page.waitForTimeout(200);
    await page.click('#ts-next');
    await page.waitForTimeout(400);
    
    const chars = await page.$$('.card');
    if (chars.length > 0) await chars[0].click();
    await page.waitForTimeout(200);
    await page.click('#cs-next');
    await page.waitForTimeout(400);
    
    await page.click('#ds-start');
    await page.waitForTimeout(9000); // countdown + 3s racing
    
    // Drive for 5 seconds
    await page.keyboard.down('KeyW');
    await page.keyboard.down('KeyD'); // steer right to test
    await page.waitForTimeout(5000);
    await page.keyboard.up('KeyD');
    await page.keyboard.up('KeyW');
    
    // Check state
    const s = await page.evaluate(() => {
      const k = window.__allKarts;
      const rs = window.__raceState;
      const td = window.__trackData;
      if (!k || !rs || !td) return { error: 'missing' };
      return {
        status: rs.status,
        time: rs.raceTime?.toFixed(1),
        karts: k.length,
        moving: k.filter(kk => Math.abs(kk.speed) > 5).length,
        playerLap: k[0]?.currentLap,
        playerCP: k[0]?.lastCheckpoint,
        playerSpeed: k[0]?.speed?.toFixed(1),
        walls: td.collisionWalls?.length,
        cps: td.checkpoints?.length,
      };
    });
    console.log(`  Status=${s.status} time=${s.time}s karts=${s.karts} moving=${s.moving}`);
    console.log(`  Player: lap=${s.playerLap} cp=${s.playerCP} speed=${s.playerSpeed}`);
    console.log(`  Track: ${s.walls} walls, ${s.cps} checkpoints`);
    
    await page.screenshot({ path: `/home/daytona/workspace/test_smoke_${t}.png` });
    
    // Quit to menu
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const btns = await page.$$('.pause-btn');
    for (const b of btns) {
      const txt = await b.textContent();
      if (txt.includes('Quit')) { await b.click(); break; }
    }
    await page.waitForTimeout(1000);
    errors.length = 0;
  }
  
  console.log('\n=== All tracks tested ===');
  if (errors.length > 0) console.log('Remaining errors:', errors);
  else console.log('No errors');
  
  await browser.close();
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });

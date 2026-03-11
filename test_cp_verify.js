const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  
  await page.goto('http://localhost:4567', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  
  // Quick start: Enter → select track 0 → Next → select char 0 → Next → Start
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);
  
  // Click first track card
  const cards = await page.$$('.card');
  if (cards.length > 0) await cards[0].click();
  await page.waitForTimeout(200);
  await page.click('#ts-next');
  await page.waitForTimeout(500);
  
  // Click first char card
  const chars = await page.$$('.card');
  if (chars.length > 0) await chars[0].click();
  await page.waitForTimeout(200);
  await page.click('#cs-next');
  await page.waitForTimeout(500);
  
  // Start race
  await page.click('#ds-start');
  
  // Wait for countdown to finish (6s countdown)
  await page.waitForTimeout(9000);
  
  // Start driving
  await page.keyboard.down('KeyW');
  
  // Check state every 2 seconds
  for (let sec = 0; sec < 15; sec += 2) {
    await page.waitForTimeout(2000);
    const s = await page.evaluate(() => {
      const k = window.__allKarts;
      const rs = window.__raceState;
      if (!k || !rs) return null;
      const p = k[0];
      return {
        time: rs.raceTime?.toFixed(1),
        status: rs.status,
        speed: p?.speed?.toFixed(1),
        lap: p?.currentLap,
        cp: p?.lastCheckpoint,
        pos: `${p?.position?.x?.toFixed(0)},${p?.position?.y?.toFixed(1)},${p?.position?.z?.toFixed(0)}`,
        racePos: p?.racePosition,
        moving: k.filter(kk => Math.abs(kk.speed) > 5).length,
      };
    });
    console.log(`t+${sec+2}s:`, JSON.stringify(s));
  }
  
  await page.keyboard.up('KeyW');
  await page.screenshot({ path: '/home/daytona/workspace/test_cp_ss.png' });
  
  if (errors.length > 0) console.log('ERRORS:', errors);
  else console.log('No errors');
  
  await browser.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });

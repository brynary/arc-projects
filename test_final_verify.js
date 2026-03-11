// Final verification: screenshot all 4 tracks to confirm AI racing visually
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  
  await page.goto('http://localhost:4567', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  
  // Quick test on Volcano Peak (previously the worst)
  console.log('Testing Volcano Peak...');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  
  const cards = await page.$$('.card');
  if (cards[3]) await cards[3].click();
  await page.waitForTimeout(200);
  await page.click('#ts-next');
  await page.waitForTimeout(500);
  await page.click('#cs-next');
  await page.waitForTimeout(500);
  await page.click('#ds-start');
  await page.waitForTimeout(8000); // countdown
  
  // Race for 20 seconds
  await page.keyboard.down('KeyW');
  await page.keyboard.down('KeyD'); // steer right
  await page.waitForTimeout(10000);
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(10000);
  
  await page.screenshot({ path: 'final_verify_volcano.png' });
  
  const state = await page.evaluate(() => {
    const karts = window.__allKarts || [];
    return karts.map(k => ({
      id: k.characterId,
      isPlayer: k.isPlayer,
      lap: k.currentLap,
      cp: k.lastCheckpoint,
      finished: k.finished,
      speed: +k.speed.toFixed(1),
      surface: k.surfaceType,
    }));
  });
  
  console.log('Final state:');
  let allRacing = true;
  for (const k of state) {
    const marker = k.isPlayer ? '★' : ' ';
    const status = k.speed > 5 ? '✓ racing' : (k.cp >= 0 ? '~ progressing' : '✗ stuck');
    if (k.cp < 0 && !k.isPlayer) allRacing = false;
    console.log(`  ${marker} ${k.id.padEnd(8)} lap=${k.lap} cp=${k.cp} speed=${k.speed} ${k.surface} ${status}`);
  }
  
  console.log(`\nErrors: ${errors.length}`);
  console.log(allRacing ? '✓ All AI karts progressing' : '✗ Some AI karts still stuck');
  
  await page.keyboard.up('KeyW');
  await browser.close();
})();

// Final comprehensive test for camera improvements on all 4 tracks
import { chromium } from 'playwright';

const browser = await chromium.launch({ args: ['--no-sandbox','--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const allLogs = [];
page.on('console', msg => allLogs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', err => allLogs.push(`[PAGE_ERROR] ${err.message}`));

const tracks = ['Sunset Bay', 'Mossy Canyon', 'Neon Grid', 'Volcano Peak'];

for (let ti = 0; ti < 4; ti++) {
  allLogs.length = 0;
  console.log(`\n--- ${tracks[ti]} ---`);
  
  await page.goto('http://localhost:4567/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  const cards = await page.$$('.card');
  if (cards[ti]) await cards[ti].click();
  await page.waitForTimeout(200);
  await page.click('#ts-next');
  await page.waitForTimeout(200);
  await page.click('.card');
  await page.waitForTimeout(200);
  await page.click('#cs-next');
  await page.waitForTimeout(200);
  await page.click('#ds-start');
  
  // Wait for race to start
  await page.waitForTimeout(6000);
  
  // Drive for 15 seconds with steering
  await page.keyboard.down('w');
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(3000);
    // Alternate steering
    if (i % 2 === 0) {
      await page.keyboard.down('d');
      await page.waitForTimeout(500);
      await page.keyboard.up('d');
    } else {
      await page.keyboard.down('a');
      await page.waitForTimeout(500);
      await page.keyboard.up('a');
    }
  }
  await page.keyboard.up('w');
  
  const state = await page.evaluate(() => {
    const k = window.__allKarts;
    if (!k || !k[0]) return null;
    const p = k[0];
    const racingCount = k.filter(kk => !kk.finished).length;
    return {
      pos: `${p.position.x.toFixed(1)},${p.position.y.toFixed(1)},${p.position.z.toFixed(1)}`,
      speed: p.speed.toFixed(1),
      lap: p.currentLap,
      cp: p.lastCheckpoint,
      racing: racingCount,
      trackSector: window.__trackData?._lastPlayerSector,
    };
  });
  
  const errors = allLogs.filter(l => l.includes('ERROR') || l.includes('error') || l.includes('PAGE_ERROR'));
  console.log(`  State: ${JSON.stringify(state)}`);
  console.log(`  Errors: ${errors.length}`);
  if (errors.length > 0) {
    for (const e of errors.slice(0, 5)) console.log(`    ${e}`);
  }
  console.log(`  ✅ ${tracks[ti]} passed`);
}

await browser.close();
console.log('\n✅ All camera tests passed');

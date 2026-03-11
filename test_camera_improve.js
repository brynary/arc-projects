// Test camera improvements - wall anti-clip, speed-dependent distance, height floor
import { chromium } from 'playwright';

const browser = await chromium.launch({ args: ['--no-sandbox','--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const logs = [];
page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', err => logs.push(`[PAGE_ERROR] ${err.message}`));

async function runTrackTest(trackIdx, name) {
  console.log(`\n=== Testing ${name} (track ${trackIdx}) ===`);
  
  await page.goto('http://localhost:4567/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  // Start a race
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  
  // Select track
  const cards = await page.$$('.card');
  if (cards[trackIdx]) await cards[trackIdx].click();
  await page.waitForTimeout(300);
  await page.click('#ts-next');
  await page.waitForTimeout(300);
  await page.click('.card'); // select first character
  await page.waitForTimeout(300);
  await page.click('#cs-next');
  await page.waitForTimeout(300);
  await page.click('#ds-start');
  await page.waitForTimeout(1000);

  // Screenshot during countdown
  await page.screenshot({ path: `test_cam_${name}_countdown.png` });

  // Wait for race start
  await page.waitForTimeout(5000);

  // Drive and turn
  await page.keyboard.down('w');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `test_cam_${name}_racing.png` });

  // Test tight turn to check camera behavior
  await page.keyboard.down('d');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `test_cam_${name}_turning.png` });
  await page.keyboard.up('d');

  // Check state
  const state = await page.evaluate(() => {
    const karts = window.__allKarts;
    if (!karts || !karts[0]) return null;
    const p = karts[0];
    return {
      pos: `${p.position.x.toFixed(1)}, ${p.position.y.toFixed(1)}, ${p.position.z.toFixed(1)}`,
      speed: p.speed.toFixed(1),
      lap: p.currentLap,
      cp: p.lastCheckpoint,
    };
  });
  console.log(`  Player: ${JSON.stringify(state)}`);
  
  await page.keyboard.up('w');
  await page.waitForTimeout(500);
  
  // Check errors
  const errors = logs.filter(l => l.includes('ERROR') || l.includes('error'));
  console.log(`  Errors: ${errors.length}`);
  for (const e of errors.slice(-5)) console.log(`    ${e}`);
  logs.length = 0;
}

// Test all 4 tracks
await runTrackTest(0, 'SunsetBay');
await runTrackTest(1, 'MossyCanyon');
await runTrackTest(2, 'NeonGrid');
await runTrackTest(3, 'VolcanoPeak');

await browser.close();
console.log('\n✅ Camera improvement test complete');

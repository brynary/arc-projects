// Test all 4 tracks load correctly with optimizations
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();

const errors = [];
page.on('pageerror', err => errors.push(err.message));
page.on('console', msg => {
  if (msg.type() === 'error') errors.push(msg.text());
});

async function testTrack(trackIdx, trackName) {
  console.log(`\nTesting track ${trackIdx}: ${trackName}`);
  errors.length = 0;
  
  await page.goto('http://localhost:4567/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  
  // Press Enter
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);
  
  // Select track
  const cards = await page.$$('.card');
  if (cards[trackIdx]) await cards[trackIdx].click();
  await page.waitForTimeout(300);
  
  const nextBtn = await page.$('#ts-next');
  if (nextBtn) await nextBtn.click();
  await page.waitForTimeout(500);
  
  // Select first character
  const charCard = await page.$('.card');
  if (charCard) await charCard.click();
  await page.waitForTimeout(300);
  
  const csNext = await page.$('#cs-next');
  if (csNext) await csNext.click();
  await page.waitForTimeout(300);
  
  // Start race
  const startBtn = await page.$('#ds-start');
  if (startBtn) await startBtn.click();
  
  // Wait for countdown + some racing
  await page.waitForTimeout(8000);
  
  // Hold W to drive
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(3000);
  await page.keyboard.up('KeyW');
  
  await page.screenshot({ path: `/home/daytona/workspace/perf_track_${trackIdx}.png` });
  
  if (errors.length > 0) {
    console.log(`  ERRORS on ${trackName}:`);
    for (const e of errors) console.log(`    ${e}`);
    return false;
  }
  console.log(`  ${trackName}: OK (no errors)`);
  return true;
}

let allOk = true;
allOk &= await testTrack(0, 'Sunset Bay');
allOk &= await testTrack(1, 'Mossy Canyon');
allOk &= await testTrack(2, 'Neon Grid');
allOk &= await testTrack(3, 'Volcano Peak');

console.log('\n' + (allOk ? 'ALL TRACKS PASSED' : 'SOME TRACKS FAILED'));
await browser.close();

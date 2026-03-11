// Test race restart and quit (dispose/cleanup path)
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();

const errors = [];
page.on('pageerror', err => errors.push(err.message));
page.on('console', msg => {
  if (msg.type() === 'error') errors.push(msg.text());
});

await page.goto('http://localhost:4567/', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);

// Start a race
await page.keyboard.press('Enter');
await page.waitForTimeout(800);
const nextBtn = await page.$('#ts-next');
if (nextBtn) await nextBtn.click();
await page.waitForTimeout(500);
const csNext = await page.$('#cs-next');
if (csNext) await csNext.click();
await page.waitForTimeout(300);
const startBtn = await page.$('#ds-start');
if (startBtn) await startBtn.click();
await page.waitForTimeout(8000);
console.log('Race started, driving...');

await page.keyboard.down('KeyW');
await page.waitForTimeout(2000);
await page.keyboard.up('KeyW');

// Pause and restart
console.log('Pausing...');
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
await page.screenshot({ path: '/home/daytona/workspace/perf_paused.png' });

// Click restart
const restartBtn = await page.evaluate(() => {
  const btns = document.querySelectorAll('.pause-btn');
  for (const b of btns) {
    if (b.textContent.includes('Restart')) { b.click(); return true; }
  }
  return false;
});
console.log('Restart clicked:', restartBtn);
await page.waitForTimeout(8000);

// Drive a bit in the restarted race
await page.keyboard.down('KeyW');
await page.waitForTimeout(2000);
await page.keyboard.up('KeyW');
await page.screenshot({ path: '/home/daytona/workspace/perf_restarted.png' });

// Pause and quit to menu
console.log('Quitting to menu...');
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
const quitBtn = await page.evaluate(() => {
  const btns = document.querySelectorAll('.pause-btn');
  for (const b of btns) {
    if (b.textContent.includes('Quit')) { b.click(); return true; }
  }
  return false;
});
console.log('Quit clicked:', quitBtn);
await page.waitForTimeout(1000);
await page.screenshot({ path: '/home/daytona/workspace/perf_menu.png' });

// Start a new race on a DIFFERENT track to test cleanup
await page.keyboard.press('Enter');
await page.waitForTimeout(800);
const cards = await page.$$('.card');
if (cards[2]) await cards[2].click();
await page.waitForTimeout(300);
const nextBtn2 = await page.$('#ts-next');
if (nextBtn2) await nextBtn2.click();
await page.waitForTimeout(500);
const csNext2 = await page.$('#cs-next');
if (csNext2) await csNext2.click();
await page.waitForTimeout(300);
const startBtn2 = await page.$('#ds-start');
if (startBtn2) await startBtn2.click();
await page.waitForTimeout(8000);

await page.keyboard.down('KeyW');
await page.waitForTimeout(2000);
await page.keyboard.up('KeyW');
await page.screenshot({ path: '/home/daytona/workspace/perf_new_track.png' });

if (errors.length > 0) {
  console.log('ERRORS found:');
  for (const e of errors) console.log('  ', e);
} else {
  console.log('No errors during restart/quit/new track cycle!');
}

await browser.close();
console.log('Cleanup test complete!');

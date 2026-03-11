// Performance verification test
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();

// Collect console logs
const logs = [];
const errors = [];
page.on('console', msg => {
  logs.push(`[${msg.type()}] ${msg.text()}`);
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', err => errors.push(err.message));

console.log('Loading game...');
await page.goto('http://localhost:4567/', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

// Take screenshot of title screen
await page.screenshot({ path: '/home/daytona/workspace/perf_title.png' });
console.log('Title screen loaded');

// Press Enter to start
await page.keyboard.press('Enter');
await page.waitForTimeout(1000);

// Select track (click first card)
const trackCard = await page.$('.card');
if (trackCard) await trackCard.click();
await page.waitForTimeout(500);

// Click Next
const nextBtn = await page.$('#ts-next');
if (nextBtn) await nextBtn.click();
await page.waitForTimeout(500);

// Select character
const charCard = await page.$('.card');
if (charCard) await charCard.click();
await page.waitForTimeout(500);

// Click Next
const csNext = await page.$('#cs-next');
if (csNext) await csNext.click();
await page.waitForTimeout(500);

// Click Start Race
const startBtn = await page.$('#ds-start');
if (startBtn) await startBtn.click();
await page.waitForTimeout(2000);

// Screenshot during countdown
await page.screenshot({ path: '/home/daytona/workspace/perf_countdown.png' });
console.log('Countdown screenshot taken');

// Wait for race to start
await page.waitForTimeout(6000);
await page.screenshot({ path: '/home/daytona/workspace/perf_racing.png' });
console.log('Racing screenshot taken');

// Now measure frame times during active racing
const frameMetrics = await page.evaluate(() => {
  return new Promise(resolve => {
    const frameTimes = [];
    let lastTime = performance.now();
    let count = 0;
    
    function measure() {
      const now = performance.now();
      frameTimes.push(now - lastTime);
      lastTime = now;
      count++;
      if (count < 120) {
        requestAnimationFrame(measure);
      } else {
        // Compute stats
        frameTimes.sort((a, b) => a - b);
        const avg = frameTimes.reduce((s, v) => s + v, 0) / frameTimes.length;
        const p99 = frameTimes[Math.floor(frameTimes.length * 0.99)];
        const p95 = frameTimes[Math.floor(frameTimes.length * 0.95)];
        const min = frameTimes[0];
        const max = frameTimes[frameTimes.length - 1];
        resolve({ avg: avg.toFixed(2), p95: p95.toFixed(2), p99: p99.toFixed(2), min: min.toFixed(2), max: max.toFixed(2), count });
      }
    }
    requestAnimationFrame(measure);
  });
});

console.log('Frame time metrics (ms):', JSON.stringify(frameMetrics));

// Hold accelerate for a bit and measure objects in scene
await page.keyboard.down('KeyW');
await page.waitForTimeout(3000);
await page.keyboard.up('KeyW');

const sceneStats = await page.evaluate(() => {
  const renderer = document.querySelector('canvas')?.__renderer;
  // Count objects in scene by traversing
  let meshCount = 0;
  let groupCount = 0;
  let totalGeometries = 0;
  
  // Check Three.js renderer info if accessible 
  return {
    note: 'Scene object counts need renderer.info',
  };
});

await page.screenshot({ path: '/home/daytona/workspace/perf_driving.png' });
console.log('After driving screenshot taken');

// Check for errors
if (errors.length > 0) {
  console.log('ERRORS found:');
  for (const e of errors) console.log('  ERROR:', e);
} else {
  console.log('No errors found!');
}

// Print relevant console logs
const relevantLogs = logs.filter(l => l.includes('error') || l.includes('Error') || l.includes('warn'));
if (relevantLogs.length > 0) {
  console.log('Relevant logs:', relevantLogs.slice(0, 10));
}

await browser.close();
console.log('Test complete!');

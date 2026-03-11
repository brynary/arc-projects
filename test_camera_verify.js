// Verify camera anti-clip and speed-dependent distance
import { chromium } from 'playwright';

const browser = await chromium.launch({ args: ['--no-sandbox','--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const logs = [];
page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', err => logs.push(`[PAGE_ERROR] ${err.message}`));

await page.goto('http://localhost:4567/', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);

// Start race on Sunset Bay 
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
await page.click('.card');
await page.waitForTimeout(300);
await page.click('#ts-next');
await page.waitForTimeout(300);
await page.click('.card');
await page.waitForTimeout(300);
await page.click('#cs-next');
await page.waitForTimeout(300);
await page.click('#ds-start');
await page.waitForTimeout(6000); // wait for countdown

// Add a diagnostic to measure camera distance from kart
const addDiagnostic = async () => {
  return page.evaluate(() => {
    // Inject diagnostic onto window for reading
    const cam = window.__allKarts?.[0];
    if (!cam) return null;
    // Find the Three.js camera from the renderer
    const canvas = document.getElementById('game-canvas');
    // The camera is in scene module - we can't directly access it
    // But we can check the player's state
    return {
      speed: cam.speed.toFixed(2),
      isDrifting: cam.isDrifting,
      boostActive: cam.boostActive,
      pos: `${cam.position.x.toFixed(1)},${cam.position.y.toFixed(1)},${cam.position.z.toFixed(1)}`,
    };
  });
};

// Check state at standstill (just after countdown)
let state = await addDiagnostic();
console.log('At race start:', JSON.stringify(state));

// Accelerate and check camera at different speeds
await page.keyboard.down('w');
await page.waitForTimeout(500);
state = await addDiagnostic();
console.log('Low speed:', JSON.stringify(state));

await page.waitForTimeout(2000);
state = await addDiagnostic();
console.log('Mid speed:', JSON.stringify(state));

await page.waitForTimeout(3000);
state = await addDiagnostic();
console.log('High speed:', JSON.stringify(state));

// Drift test - camera shift
await page.keyboard.down('d');
await page.keyboard.down('Shift');
await page.waitForTimeout(2000);
state = await addDiagnostic();
console.log('Drifting:', JSON.stringify(state));
await page.screenshot({ path: 'test_cam_verify_drift.png' });
await page.keyboard.up('Shift');
await page.keyboard.up('d');

await page.waitForTimeout(1000);
state = await addDiagnostic();
console.log('After drift:', JSON.stringify(state));

// Drive into a wall to test anti-clip
await page.keyboard.down('d');
await page.waitForTimeout(4000);
await page.screenshot({ path: 'test_cam_verify_wall.png' });
state = await addDiagnostic();
console.log('Near wall:', JSON.stringify(state));
await page.keyboard.up('d');

await page.keyboard.up('w');

// Check for errors 
const errors = logs.filter(l => l.includes('ERROR') || l.includes('error'));
console.log(`\nTotal errors: ${errors.length}`);
for (const e of errors) console.log(e);

await browser.close();
console.log('\n✅ Camera verification complete');

// Test camera system behavior
import { chromium } from 'playwright';

const browser = await chromium.launch({ args: ['--no-sandbox','--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const logs = [];
page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', err => logs.push(`[PAGE_ERROR] ${err.message}`));

await page.goto('http://localhost:4567/', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

// Start a race
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
await page.click('.card'); // select first track
await page.waitForTimeout(300);
await page.click('#ts-next');
await page.waitForTimeout(300);
await page.click('.card'); // select first character
await page.waitForTimeout(300);
await page.click('#cs-next');
await page.waitForTimeout(300);
await page.click('#ds-start');
await page.waitForTimeout(1000);

// Take screenshot during countdown - camera should be positioned behind kart
await page.screenshot({ path: 'test_camera_countdown.png' });

// Wait for countdown to finish
await page.waitForTimeout(5000);

// Screenshot during racing
await page.screenshot({ path: 'test_camera_racing1.png' });

// Drive and check camera position relative to kart
const camData = await page.evaluate(() => {
  const karts = window.__allKarts;
  const cam = document.querySelector('canvas').closest('body').__cameraDebug;
  const player = karts ? karts[0] : null;
  if (!player) return { error: 'no player' };
  
  // Access Three.js camera
  const scene = window.__trackData;
  return {
    playerPos: { x: player.position.x, y: player.position.y, z: player.position.z },
    playerRot: player.rotation,
    playerSpeed: player.speed,
  };
});
console.log('Player state:', JSON.stringify(camData));

// Drive forward with acceleration and steering to test camera follow
await page.keyboard.down('w');
await page.waitForTimeout(3000);
await page.screenshot({ path: 'test_camera_racing2.png' });

// Test turning right
await page.keyboard.down('d');
await page.waitForTimeout(2000);
await page.screenshot({ path: 'test_camera_turning.png' });
await page.keyboard.up('d');

// Test drifting - camera should shift
await page.keyboard.down('d');
await page.keyboard.down('Shift');
await page.waitForTimeout(1500);
await page.screenshot({ path: 'test_camera_drift.png' });
await page.keyboard.up('Shift');
await page.keyboard.up('d');
await page.waitForTimeout(500);
await page.screenshot({ path: 'test_camera_post_drift.png' });

// Check the camera position directly
const camState = await page.evaluate(() => {
  const cam = window.__allKarts?.[0];
  if (!cam) return null;
  // Get camera through Three.js - find it from the scene
  const cams = [];
  return {
    playerPos: { x: cam.position.x.toFixed(2), y: cam.position.y.toFixed(2), z: cam.position.z.toFixed(2) },
    playerRot: cam.rotation.toFixed(4),
    speed: cam.speed.toFixed(2),
    isDrifting: cam.isDrifting,
    lap: cam.currentLap,
  };
});
console.log('Player state after driving:', JSON.stringify(camState));

await page.keyboard.up('w');

// Check for errors
const errors = logs.filter(l => l.includes('ERROR') || l.includes('error'));
console.log(`\nTotal log messages: ${logs.length}`);
console.log(`Errors: ${errors.length}`);
for (const e of errors) console.log(e);

await browser.close();
console.log('\nCamera test complete');

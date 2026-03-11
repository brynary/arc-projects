// Browser verification for Fabro Racer review
import { chromium } from 'playwright';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

console.log('=== Loading game ===');
await page.goto('http://localhost:4569/', { waitUntil: 'networkidle', timeout: 30000 });
await sleep(2000);

// Check title screen
const titleText = await page.textContent('#menu-layer');
console.log('Title screen contains:', titleText?.includes('FABRO RACER') ? 'FABRO RACER ✅' : 'MISSING ❌');
await page.screenshot({ path: 'review-01-title.png' });

// Click RACE
await page.click('#btn-race');
await sleep(500);
const trackMenu = await page.textContent('#menu-layer');
console.log('Track select:', trackMenu?.includes('Select Track') ? '✅' : '❌');
console.log('Sunset Circuit:', trackMenu?.includes('Sunset Circuit') ? '✅' : '❌');
console.log('Fungal Canyon:', trackMenu?.includes('Fungal Canyon') ? '✅' : '❌');
console.log('Neon Grid:', trackMenu?.includes('Neon Grid') ? '✅' : '❌');
console.log('Frostbite Pass:', trackMenu?.includes('Frostbite Pass') ? '✅' : '❌');
await page.screenshot({ path: 'review-02-track-select.png' });

// Select first track (already selected) and confirm
await page.click('#btn-confirm-track');
await sleep(500);
const charMenu = await page.textContent('#menu-layer');
console.log('Char select:', charMenu?.includes('Select Character') ? '✅' : '❌');
// Check all 8 chars
for (const name of ['Blip', 'Grumble', 'Zephyr', 'Cinder', 'Tundra', 'Pixel', 'Mossworth', 'Stardust']) {
  console.log(`  Character ${name}:`, charMenu?.includes(name) ? '✅' : '❌');
}
await page.screenshot({ path: 'review-03-char-select.png' });

// Select character
await page.click('#btn-confirm-char');
await sleep(500);
const preRace = await page.textContent('#menu-layer');
console.log('Pre-race options:', preRace?.includes('Race Setup') ? '✅' : '❌');
console.log('Difficulty option:', preRace?.includes('Difficulty') ? '✅' : '❌');
console.log('Mirror option:', preRace?.includes('Mirror') ? '✅' : '❌');
await page.screenshot({ path: 'review-04-prerace.png' });

// Test difficulty cycling
await page.click('#btn-diff');
await sleep(200);
const diffText = await page.textContent('#btn-diff');
console.log('Difficulty after click:', diffText);

// Start race  
await page.click('#btn-start');
await sleep(3000); // Wait for track loading + countdown

await page.screenshot({ path: 'review-05-race-start.png' });

// Check HUD elements
const hudPos = await page.textContent('#hud-position');
const hudLap = await page.textContent('#hud-lap');
const hudTimer = await page.textContent('#hud-timer');
console.log('\n=== HUD Check ===');
console.log('Position:', hudPos);
console.log('Lap:', hudLap);
console.log('Timer:', hudTimer);

// Check canvas has content
const canvas = await page.$('#game-canvas');
const canvasSize = await canvas.boundingBox();
console.log('Canvas size:', canvasSize?.width, 'x', canvasSize?.height);

// Wait for countdown to complete and start driving
await sleep(2000);

// Drive forward
await page.keyboard.down('KeyW');
await sleep(2000);
await page.screenshot({ path: 'review-06-driving.png' });

// Check speed changed
const gameState = await page.evaluate(() => {
  if (!window._game) return null;
  const { playerKart, allKarts, track, racingState } = window._game;
  return {
    playerSpeed: playerKart?.speed,
    playerPos: playerKart?.racePosition,
    playerLap: playerKart?.currentLap,
    totalKarts: allKarts?.length,
    cpuMoving: allKarts?.filter(k => !k.isPlayer && Math.abs(k.speed) > 1).length,
    trackName: track?.trackDef?.name,
    totalLength: track?.totalLength,
    checkpoints: track?.checkpoints?.length,
    itemBoxes: allKarts[0] ? true : false,
  };
});
console.log('\n=== Game State ===');
console.log(JSON.stringify(gameState, null, 2));

// Test steering
await page.keyboard.down('KeyA');
await sleep(500);
await page.keyboard.up('KeyA');
await sleep(500);

// Test drift
await page.keyboard.down('KeyD');
await sleep(100);
await page.keyboard.down('Space');
await sleep(1500);
await page.keyboard.up('Space');
await page.keyboard.up('KeyD');
await sleep(500);

const driftState = await page.evaluate(() => {
  const kart = window._game?.playerKart;
  return {
    speed: kart?.speed,
    isDrifting: kart?.isDrifting,
    boostTimer: kart?.boostTimer,
    boostPower: kart?.boostPower,
  };
});
console.log('\n=== After Drift Attempt ===');
console.log(JSON.stringify(driftState, null, 2));

await page.screenshot({ path: 'review-07-after-drift.png' });

// Continue driving for a while
await sleep(3000);

// Check AI progress
const aiState = await page.evaluate(() => {
  if (!window._game) return null;
  const { allKarts } = window._game;
  return allKarts.map(k => ({
    name: k.character?.name,
    isPlayer: k.isPlayer,
    speed: Math.abs(k.speed).toFixed(1),
    position: k.racePosition,
    lap: k.currentLap,
    checkpoint: k.lastCheckpoint,
    item: k.heldItem,
  }));
});
console.log('\n=== All Karts Status ===');
console.table(aiState);

await page.screenshot({ path: 'review-08-racing.png' });

// Test pause menu
await page.keyboard.press('Escape');
await sleep(500);
const pauseMenu = await page.textContent('#menu-layer');
console.log('\n=== Pause Menu ===');
console.log('Pause visible:', pauseMenu?.includes('Paused') ? '✅' : '❌');
console.log('Resume option:', pauseMenu?.includes('Resume') ? '✅' : '❌');
console.log('Restart option:', pauseMenu?.includes('Restart') ? '✅' : '❌');
console.log('Quit option:', pauseMenu?.includes('Quit') ? '✅' : '❌');
await page.screenshot({ path: 'review-09-pause.png' });

// Resume
await page.click('#btn-resume');
await sleep(500);

// Keep driving for 10 more seconds
await page.keyboard.down('KeyW');
await sleep(10000);
await page.keyboard.up('KeyW');

const lateState = await page.evaluate(() => {
  if (!window._game) return null;
  const { playerKart, allKarts, racingState, itemState } = window._game;
  return {
    playerSpeed: playerKart?.speed?.toFixed(1),
    playerPos: playerKart?.racePosition,
    playerLap: playerKart?.currentLap,
    raceTime: racingState?.raceTime?.toFixed(1),
    anyFinished: allKarts.some(k => k.finished),
    cpuLaps: allKarts.filter(k => !k.isPlayer).map(k => k.currentLap),
    activeProjectiles: itemState?.projectiles?.length,
    activeGroundItems: itemState?.groundItems?.length,
  };
});
console.log('\n=== Late Race State ===');
console.log(JSON.stringify(lateState, null, 2));
await page.screenshot({ path: 'review-10-late-race.png' });

// Check minimap canvas has content
const minimapContent = await page.evaluate(() => {
  const c = document.getElementById('minimap-canvas');
  if (!c) return false;
  const ctx2d = c.getContext('2d');
  const data = ctx2d.getImageData(0, 0, c.width, c.height).data;
  let nonZero = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] + data[i+1] + data[i+2] > 0) nonZero++;
  }
  return nonZero;
});
console.log('Minimap pixels:', minimapContent);

console.log('\n=== JS Errors ===');
if (errors.length === 0) {
  console.log('No JavaScript errors! ✅');
} else {
  for (const e of errors) console.log('ERROR:', e);
}

await browser.close();
console.log('\n=== Review verification complete ===');

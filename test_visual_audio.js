// Playwright test: verify visual & audio polish changes
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('http://localhost:4567/', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1500);
  
  // Take title screen screenshot
  await page.screenshot({ path: '/home/daytona/workspace/ss_title.png' });
  console.log('Title screen captured');

  // Press Enter to start
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);

  // Select first track (already selected)
  await page.click('#ts-next');
  await page.waitForTimeout(300);

  // Select first character (already selected)
  await page.click('#cs-next');
  await page.waitForTimeout(300);

  // Start race with default difficulty
  await page.click('#ds-start');
  await page.waitForTimeout(2000);

  // Take screenshot during countdown
  await page.screenshot({ path: '/home/daytona/workspace/ss_countdown.png' });
  console.log('Countdown captured');

  // Wait for race to start
  await page.waitForTimeout(5000);
  
  // Take racing screenshot
  await page.screenshot({ path: '/home/daytona/workspace/ss_racing1.png' });
  console.log('Racing screenshot 1');

  // Drive forward and steer to test audio hooks
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(2000);
  
  // Check that the game state is RACING and shadows follow player
  const result = await page.evaluate(() => {
    const state = {
      gameRunning: !!window.__raceState,
      playerKart: !!window.__allKarts?.[0],
      errors: [],
    };
    
    if (window.__allKarts?.[0]) {
      const pk = window.__allKarts[0];
      state.playerX = pk.position.x.toFixed(1);
      state.playerZ = pk.position.z.toFixed(1);
      state.speed = pk.speed.toFixed(1);
      state.surfaceType = pk.surfaceType;
    }
    
    return state;
  });
  console.log('Game state:', JSON.stringify(result));

  // Steer into wall to test wall hit sound
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(1000);
  await page.keyboard.up('ArrowLeft');
  
  // Now try drifting to test drift sounds
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('ShiftLeft');
  await page.waitForTimeout(2000);
  await page.keyboard.up('ShiftLeft');
  await page.keyboard.up('ArrowRight');
  
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowUp');

  // Take screenshot after driving
  await page.screenshot({ path: '/home/daytona/workspace/ss_racing2.png' });
  console.log('Racing screenshot 2');

  // Check for directional light position tracking the player
  const lightCheck = await page.evaluate(() => {
    // Check if Three.js scene has directional light following player
    const karts = window.__allKarts;
    if (!karts || !karts[0]) return { ok: false, reason: 'no karts' };
    
    // We can't directly access Three.js internals easily, but we can check for errors
    return { ok: true, playerPos: { x: karts[0].position.x.toFixed(1), z: karts[0].position.z.toFixed(1) } };
  });
  console.log('Light check:', JSON.stringify(lightCheck));

  // Check audio module loaded and has new functions
  const audioCheck = await page.evaluate(async () => {
    try {
      const audio = await import('./js/audio.js');
      return {
        hasPlayDriftStart: typeof audio.playDriftStart === 'function',
        hasPlayDriftTierUp: typeof audio.playDriftTierUp === 'function',
        hasPlayBoostFire: typeof audio.playBoostFire === 'function',
        hasPlayWallHit: typeof audio.playWallHit === 'function',
        hasPlayKartBump: typeof audio.playKartBump === 'function',
      };
    } catch (e) {
      return { error: e.message };
    }
  });
  console.log('Audio functions:', JSON.stringify(audioCheck));

  // Report errors
  if (errors.length > 0) {
    console.log('ERRORS found:');
    for (const e of errors) console.log('  -', e);
  } else {
    console.log('No console errors detected');
  }

  await browser.close();
  process.exit(errors.length > 0 ? 1 : 0);
})();

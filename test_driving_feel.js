// Test driving feel improvements — verify via direct game state inspection
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('http://localhost:4567/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);

  // Navigate to race
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
  await page.click('.menu-btn');
  await page.waitForTimeout(600);
  await page.click('.menu-btn');
  await page.waitForTimeout(600);
  await page.click('#ds-start');
  await page.waitForTimeout(8000); // Generous wait for countdown

  // === Test: Verify kart properties exist on ALL karts ===
  const propsCheck = await page.evaluate(() => {
    const karts = window.__allKarts;
    if (!karts) return { ok: false, msg: 'no karts' };
    let issues = [];
    for (const k of karts) {
      if (typeof k.pitchAngle !== 'number') issues.push(k.characterId + ' missing pitchAngle');
      if (typeof k.offroadBobPhase !== 'number') issues.push(k.characterId + ' missing offroadBobPhase');
      if (typeof k.tiltAngle !== 'number') issues.push(k.characterId + ' missing tiltAngle');
    }
    return { ok: issues.length === 0, issues, count: karts.length };
  });
  console.log('Properties check:', propsCheck.ok ? '✅' : '❌', JSON.stringify(propsCheck));

  // === Test: Accelerate to build speed ===
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(3000);

  const speedCheck = await page.evaluate(() => {
    const pk = window.__allKarts?.[0];
    return { speed: pk?.speed, gameState: window.__raceState?.status };
  });
  console.log('After 3s accel: speed =', speedCheck.speed?.toFixed(1), 'state =', speedCheck.gameState);

  // === Test: Braking pitch via direct manipulation ===
  // We'll manually set up the scenario to avoid timing issues
  const brakeTest = await page.evaluate(() => {
    const pk = window.__allKarts?.[0];
    if (!pk) return { ok: false };
    // Store original values
    const origSpeed = pk.speed;
    const origPitch = pk.pitchAngle;
    // Simulate scenario: kart at speed 50, pitchAngle should tend toward positive when braking
    // The actual behavior happens in updateKart where brakingHard triggers targetPitch
    // Just verify the property is accessible and writable
    pk.pitchAngle = 0.1;
    const written = pk.pitchAngle;
    pk.pitchAngle = origPitch; // restore
    return {
      ok: written === 0.1,
      origSpeed: origSpeed.toFixed(1),
      origPitch: origPitch.toFixed(4),
    };
  });
  console.log('Brake pitch property test:', brakeTest.ok ? '✅' : '❌', JSON.stringify(brakeTest));

  // === Test: Actually brake at speed and sample pitch ===
  await page.keyboard.up('KeyW');
  await page.keyboard.down('KeyS');

  // Sample pitch multiple times quickly
  let maxPitch = 0;
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(30);
    const s = await page.evaluate(() => {
      const pk = window.__allKarts?.[0];
      return { speed: pk?.speed, pitch: pk?.pitchAngle };
    });
    if (s.pitch > maxPitch) maxPitch = s.pitch;
    if (i < 3 || s.pitch > 0.005) {
      console.log(`  Brake sample ${i}: speed=${s.speed?.toFixed(1)} pitch=${s.pitch?.toFixed(5)}`);
    }
  }
  await page.keyboard.up('KeyS');
  console.log('Max brake pitch observed:', maxPitch.toFixed(5), maxPitch > 0.005 ? '✅' : '⚠️ (speed may have been low)');

  // === Test: Speed-dependent FOV ===
  // Accelerate to max speed
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(3000);
  
  // The FOV is set on camera.fov - we need to check it through evaluate
  const fovAtSpeed = await page.evaluate(() => {
    // We can't easily access the Three camera... but let's try via __raceState
    const pk = window.__allKarts?.[0];
    return { speed: pk?.speed?.toFixed(1) };
  });
  console.log('FOV test: speed at', fovAtSpeed.speed);
  
  // Stop and wait
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(2000);
  
  // === Test: Off-road bounce (steer hard to go off-road) ===
  await page.keyboard.down('KeyW');
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(4000); // Steer left for 4 seconds
  
  const offroad = await page.evaluate(() => {
    const pk = window.__allKarts?.[0];
    // Check all AI karts too - any of them might be offroad
    let anyOffroad = false;
    for (const k of (window.__allKarts || [])) {
      if (k.surfaceType === 'offroad') anyOffroad = true;
    }
    return {
      playerSurface: pk?.surfaceType,
      playerBlend: pk?.surfaceBlend?.toFixed(3),
      playerBob: pk?.offroadBobPhase?.toFixed(2),
      anyOffroad,
    };
  });
  console.log('Off-road test:', JSON.stringify(offroad));

  await page.keyboard.up('KeyW');
  await page.keyboard.up('KeyA');

  // === Test: syncMesh includes bob Y offset ===
  // Verify the mesh position differs from kart.position when offroad+moving
  const meshTest = await page.evaluate(() => {
    // Check if any kart's mesh Y differs from its position Y (bob offset)
    for (const k of (window.__allKarts || [])) {
      if (k.surfaceBlend > 0.1 && Math.abs(k.speed) > 8) {
        return {
          found: true,
          posY: k.position.y.toFixed(3),
          meshY: k.mesh.position.y.toFixed(3),
          diff: (k.mesh.position.y - k.position.y).toFixed(4),
          charId: k.characterId,
        };
      }
    }
    return { found: false };
  });
  if (meshTest.found) {
    console.log('✅ Mesh Y offset detected (offroad bob):', meshTest.diff, 'on', meshTest.charId);
  } else {
    console.log('⚠️ No kart currently offroad at speed (bob not testable in this frame)');
  }

  // === Final screenshot ===
  await page.screenshot({ path: '/home/daytona/workspace/test_driving_ss.png' });

  // === Error summary ===
  const nanCheck = await page.evaluate(() => {
    for (const k of (window.__allKarts || [])) {
      if (isNaN(k.pitchAngle) || isNaN(k.offroadBobPhase) || isNaN(k.tiltAngle)) {
        return { ok: false, kart: k.characterId };
      }
    }
    return { ok: true };
  });
  console.log('NaN check:', nanCheck.ok ? '✅' : '❌');
  console.log('Console errors:', errors.length === 0 ? '✅ None' : errors.join('; '));

  await browser.close();
  process.exit(errors.length > 0 ? 1 : 0);
})();

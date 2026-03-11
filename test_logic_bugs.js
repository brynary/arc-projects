// Deep logic bug check — look for specific issues
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(`PAGE ERROR: ${err.message}`));

  await page.goto('http://localhost:4567', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Start a race
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  const nextBtn = await page.$('#ts-next');
  if (nextBtn) await nextBtn.click();
  await page.waitForTimeout(500);
  const csNext = await page.$('#cs-next');
  if (csNext) await csNext.click();
  await page.waitForTimeout(500);
  const startBtn = await page.$('#ds-start');
  if (startBtn) await startBtn.click();
  await page.waitForTimeout(8000); // wait for countdown to finish + some racing

  // Test 1: Check turboPepper boost bug
  console.log('=== Test 1: TurboPepper boostInitialMultiplier ===');
  const turboBugResult = await page.evaluate(() => {
    const kart = window.__allKarts?.[0];
    if (!kart) return 'no kart';
    
    // Simulate turboPepper activation
    const beforeBIM = kart.boostInitialMultiplier;
    
    // Activate turbo pepper directly
    kart.boostActive = true;
    kart.boostMultiplier = 1.45;
    kart.boostDuration = 1.5;
    kart.boostTimer = 1.5;
    // NOTE: activateTurboPepper does NOT set boostInitialMultiplier!
    
    const afterBIM = kart.boostInitialMultiplier;
    
    // Simulate one frame of decay
    const t = 1.4 / 1.5; // after ~0.1s
    const decayed = 1 + (kart.boostInitialMultiplier - 1) * t;
    
    // Reset
    kart.boostActive = false;
    kart.boostMultiplier = 1;
    kart.boostTimer = 0;
    
    return {
      beforeBIM,
      afterBIM,
      decayedValue: decayed,
      bug: decayed < 1.1 ? 'BUG: Turbo pepper boost decays to ~1.0 immediately because boostInitialMultiplier not set' : 'OK'
    };
  });
  console.log(JSON.stringify(turboBugResult, null, 2));

  // Test 2: Check state leak after quit
  console.log('\n=== Test 2: State cleanup on quit ===');
  
  // Quit to menu
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const quitBtn = await page.$('[data-act="quit"]');
  if (quitBtn) await quitBtn.click();
  await page.waitForTimeout(1000);

  const stateAfterQuit = await page.evaluate(() => {
    return {
      debugAllKarts: window.__allKarts?.length,
      debugTrackData: !!window.__trackData,
      debugRaceStatus: window.__raceState?.status,
      note: 'window.__allKarts still points to OLD array after allKarts=[] creates new one'
    };
  });
  console.log(JSON.stringify(stateAfterQuit, null, 2));

  // Test 3: Check shield double-add visual leak
  console.log('\n=== Test 3: Shield double-add check ===');
  
  // Start new race
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  const nextBtn2 = await page.$('#ts-next');
  if (nextBtn2) await nextBtn2.click();
  await page.waitForTimeout(500);
  const csNext2 = await page.$('#cs-next');
  if (csNext2) await csNext2.click();
  await page.waitForTimeout(500);
  const startBtn2 = await page.$('#ds-start');
  if (startBtn2) await startBtn2.click();
  await page.waitForTimeout(8000);

  const shieldResult = await page.evaluate(() => {
    const kart = window.__allKarts?.[0];
    if (!kart) return 'no kart';
    
    // Count current shieldBubble children
    let bubbleCount = 0;
    kart.mesh.traverse(c => { if (c.name === 'shieldBubble') bubbleCount++; });
    const before = bubbleCount;
    
    // Activate shield twice (simulating double pickup)
    // First activation
    kart.shieldActive = true;
    kart.shieldTimer = 8;
    const geo1 = new THREE.SphereGeometry(3.5, 16, 12);
    const mat1 = new THREE.MeshBasicMaterial({ color: 0x33CCFF, transparent: true, opacity: 0.3 });
    const mesh1 = new THREE.Mesh(geo1, mat1);
    mesh1.name = 'shieldBubble';
    kart.mesh.add(mesh1);
    
    // Second activation (without removing first)
    kart.shieldActive = true;
    kart.shieldTimer = 8;
    const geo2 = new THREE.SphereGeometry(3.5, 16, 12);
    const mat2 = new THREE.MeshBasicMaterial({ color: 0x33CCFF, transparent: true, opacity: 0.3 });
    const mesh2 = new THREE.Mesh(geo2, mat2);
    mesh2.name = 'shieldBubble';
    kart.mesh.add(mesh2);
    
    bubbleCount = 0;
    kart.mesh.traverse(c => { if (c.name === 'shieldBubble') bubbleCount++; });
    
    // Cleanup
    kart.mesh.remove(mesh1); geo1.dispose(); mat1.dispose();
    kart.mesh.remove(mesh2); geo2.dispose(); mat2.dispose();
    kart.shieldActive = false;
    kart.shieldTimer = 0;
    
    return {
      beforeBubbles: before,
      afterTwoActivations: bubbleCount,
      bug: bubbleCount > 1 ? 'BUG: Multiple shield bubbles can accumulate' : 'OK'
    };
  });
  console.log(JSON.stringify(shieldResult, null, 2));

  // Test 4: Check if raceState fields are properly reset in initRace
  console.log('\n=== Test 4: Race state field completeness ===');
  const raceReset = await page.evaluate(() => {
    const rs = window.__raceState;
    return {
      status: rs.status,
      startBoostWindow: rs.startBoostWindow,
      countdownNumber: rs.countdownNumber,
    };
  });
  console.log(JSON.stringify(raceReset, null, 2));

  console.log('\nErrors:', errors.length);
  errors.forEach(e => console.log('  ERR:', e));

  await browser.close();
})().catch(e => { console.error('Test failed:', e); process.exit(1); });

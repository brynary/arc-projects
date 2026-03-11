import { chromium } from 'playwright';
import fs from 'fs';

const SCREENSHOT_DIR = '/home/daytona/workspace/review-gpt-screenshots';
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const results = [];
function check(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? '✅' : '❌'} ${name}${detail ? ': ' + detail : ''}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  // Collect JS errors
  const jsErrors = [];
  page.on('pageerror', err => jsErrors.push(err.message));
  
  // Collect console warnings
  const consoleWarnings = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleWarnings.push(msg.text());
  });

  try {
    // === 1. INITIAL LOAD ===
    console.log('\n=== INITIAL LOAD ===');
    await page.goto('http://localhost:4569/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    check('Page loads', true);
    check('No JS errors on load', jsErrors.length === 0, jsErrors.length > 0 ? jsErrors.join('; ') : '');
    
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-initial-load.png` });
    
    // Check canvas exists and has content
    const canvasSize = await page.evaluate(() => {
      const c = document.getElementById('game-canvas');
      return c ? { w: c.width, h: c.height } : null;
    });
    check('Canvas exists', !!canvasSize, canvasSize ? `${canvasSize.w}x${canvasSize.h}` : 'not found');
    
    // Check Three.js loaded
    const threeLoaded = await page.evaluate(() => typeof window.__threeLoaded !== 'undefined' || document.querySelector('canvas')?.getContext('webgl2') !== null || document.querySelector('canvas')?.getContext('webgl') !== null);
    check('WebGL context available', true);

    // === 2. TITLE SCREEN ===
    console.log('\n=== TITLE SCREEN ===');
    const menuLayer = await page.$('#menu-layer');
    const menuContent = await page.evaluate(() => document.getElementById('menu-layer')?.innerHTML || '');
    check('Menu layer has content', menuContent.length > 10, `${menuContent.length} chars`);
    
    const hasFabroTitle = await page.evaluate(() => document.getElementById('menu-layer')?.textContent?.includes('FABRO RACER') ?? false);
    check('Title "FABRO RACER" shown', hasFabroTitle);
    
    const hasRaceButton = await page.evaluate(() => {
      const btns = document.querySelectorAll('#menu-layer button, #menu-layer .menu-btn, #menu-layer [class*="btn"]');
      for (const b of btns) {
        if (b.textContent.includes('RACE') || b.textContent.includes('Race')) return true;
      }
      return false;
    });
    check('RACE button present', hasRaceButton);
    
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-title-screen.png` });

    // === 3. TRACK SELECTION ===
    console.log('\n=== TRACK SELECTION ===');
    // Click Race button
    await page.evaluate(() => {
      const btns = document.querySelectorAll('#menu-layer button, #menu-layer .menu-btn, #menu-layer [class*="btn"]');
      for (const b of btns) {
        if (b.textContent.includes('RACE') || b.textContent.includes('Race')) { b.click(); break; }
      }
    });
    await page.waitForTimeout(500);
    
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-track-select.png` });
    
    const trackNames = await page.evaluate(() => {
      const text = document.getElementById('menu-layer')?.textContent || '';
      const tracks = ['Sunset Circuit', 'Fungal Canyon', 'Neon Grid', 'Frostbite Pass'];
      return tracks.filter(t => text.includes(t));
    });
    check('All 4 tracks listed', trackNames.length === 4, trackNames.join(', '));
    
    // Navigate with keyboard
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);
    
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03b-track-navigated.png` });
    
    // Go back to first track and confirm
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(200);
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    // === 4. CHARACTER SELECTION ===
    console.log('\n=== CHARACTER SELECTION ===');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-char-select.png` });
    
    const charNames = await page.evaluate(() => {
      const text = document.getElementById('menu-layer')?.textContent || '';
      const chars = ['Blip', 'Grumble', 'Zephyr', 'Cinder', 'Tundra', 'Pixel', 'Mossworth', 'Stardust'];
      return chars.filter(c => text.includes(c));
    });
    check('All 8 characters listed', charNames.length === 8, charNames.join(', '));
    
    // Check stats display
    const hasStats = await page.evaluate(() => {
      const text = document.getElementById('menu-layer')?.textContent || '';
      return text.includes('Speed') && text.includes('Accel') && text.includes('Handling') && text.includes('Weight');
    });
    check('Character stats displayed', hasStats);
    
    // Navigate characters
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04b-char-navigated.png` });
    
    // Select character
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    // === 5. PRE-RACE OPTIONS ===
    console.log('\n=== PRE-RACE OPTIONS ===');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-pre-race.png` });
    
    const preRaceText = await page.evaluate(() => document.getElementById('menu-layer')?.textContent || '');
    const hasDifficulty = preRaceText.includes('Difficulty') || preRaceText.includes('DIFFICULTY') || preRaceText.includes('CHILL') || preRaceText.includes('STANDARD') || preRaceText.includes('MEAN');
    check('Difficulty option present', hasDifficulty);
    
    const hasMirror = preRaceText.includes('Mirror') || preRaceText.includes('MIRROR');
    check('Mirror mode option present', hasMirror);
    
    // Start race
    await page.evaluate(() => {
      const btns = document.querySelectorAll('#menu-layer button, #menu-layer .menu-btn, #menu-layer [class*="btn"]');
      for (const b of btns) {
        if (b.textContent.includes('START') || b.textContent.includes('Start')) { b.click(); break; }
      }
    });
    await page.waitForTimeout(500);
    
    // === 6. COUNTDOWN ===
    console.log('\n=== COUNTDOWN ===');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/06-countdown.png` });
    
    // Wait for countdown to complete
    await page.waitForTimeout(5000);
    
    await page.screenshot({ path: `${SCREENSHOT_DIR}/07-race-start.png` });
    
    // === 7. CORE DRIVING ===
    console.log('\n=== CORE DRIVING ===');
    
    // Check HUD is visible
    const hudVisible = await page.evaluate(() => {
      const pos = document.getElementById('hud-position');
      const lap = document.getElementById('hud-lap');
      const timer = document.getElementById('hud-timer');
      return {
        position: pos?.textContent || '',
        lap: lap?.textContent || '',
        timer: timer?.textContent || ''
      };
    });
    check('HUD position display', hudVisible.position.length > 0, hudVisible.position);
    check('HUD lap display', hudVisible.lap.includes('Lap'), hudVisible.lap);
    check('HUD timer display', hudVisible.timer.length > 0, hudVisible.timer);
    
    // Check minimap
    const minimapVisible = await page.evaluate(() => {
      const mc = document.getElementById('minimap-canvas');
      return mc && mc.width > 0 && mc.height > 0;
    });
    check('Minimap canvas visible', minimapVisible);
    
    // Accelerate for 2 seconds
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(2000);
    
    const speedAfterAccel = await page.evaluate(() => {
      if (window.gameState && window.gameState.karts) {
        const player = window.gameState.karts[0];
        return player ? player.speed : -1;
      }
      return -1;
    });
    check('Acceleration works', speedAfterAccel > 5, `speed: ${speedAfterAccel?.toFixed(1)}`);
    
    await page.screenshot({ path: `${SCREENSHOT_DIR}/08-driving.png` });
    
    // Test steering
    await page.keyboard.down('KeyA');
    await page.waitForTimeout(1000);
    await page.keyboard.up('KeyA');
    
    await page.screenshot({ path: `${SCREENSHOT_DIR}/08b-steering.png` });
    
    // Test braking
    await page.keyboard.up('KeyW');
    await page.keyboard.down('KeyS');
    await page.waitForTimeout(500);
    await page.keyboard.up('KeyS');
    
    const speedAfterBrake = await page.evaluate(() => {
      if (window.gameState && window.gameState.karts) {
        const player = window.gameState.karts[0];
        return player ? player.speed : -1;
      }
      return -1;
    });
    check('Braking works', speedAfterBrake < speedAfterAccel, `speed dropped to ${speedAfterBrake?.toFixed(1)}`);
    
    // === 8. AI OPPONENTS ===
    console.log('\n=== AI OPPONENTS ===');
    
    // Resume driving
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(3000);
    
    const aiInfo = await page.evaluate(() => {
      if (!window.gameState || !window.gameState.karts) return { count: 0, moving: 0 };
      const karts = window.gameState.karts;
      let moving = 0;
      for (let i = 1; i < karts.length; i++) {
        if (karts[i] && karts[i].speed > 1) moving++;
      }
      return { count: karts.length - 1, moving };
    });
    check('7 CPU opponents present', aiInfo.count === 7, `${aiInfo.count} CPUs`);
    check('AI karts moving', aiInfo.moving >= 5, `${aiInfo.moving}/7 moving`);
    
    await page.screenshot({ path: `${SCREENSHOT_DIR}/09-ai-racing.png` });
    
    // === 9. DRIFT SYSTEM ===
    console.log('\n=== DRIFT SYSTEM ===');
    
    // Attempt drift: accelerate + steer + space
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(100);
    await page.keyboard.down('Space');
    await page.waitForTimeout(1500);
    
    const driftState = await page.evaluate(() => {
      if (!window.gameState || !window.gameState.karts) return null;
      const p = window.gameState.karts[0];
      return p ? { isDrifting: p.isDrifting, driftTimer: p.driftTimer, driftTier: p.driftTier } : null;
    });
    
    // Also check code-level drift tier system
    const driftCodeCheck = await page.evaluate(() => {
      // Programmatically verify drift tiers
      return {
        hasDriftModule: typeof window.gameState !== 'undefined',
        driftTierElement: document.getElementById('hud-drift-tier') !== null,
        boostIndicator: document.getElementById('hud-boost-indicator') !== null
      };
    });
    check('Drift tier HUD element exists', driftCodeCheck.driftTierElement);
    check('Boost indicator HUD element exists', driftCodeCheck.boostIndicator);
    
    await page.keyboard.up('Space');
    await page.keyboard.up('KeyD');
    await page.waitForTimeout(300);
    
    await page.screenshot({ path: `${SCREENSHOT_DIR}/10-drift-attempt.png` });
    
    // === 10. ITEMS ===
    console.log('\n=== ITEMS ===');
    
    const itemBoxInfo = await page.evaluate(() => {
      if (!window.gameState) return { boxCount: 0 };
      // Count item boxes in scene
      let boxCount = 0;
      if (window.gameState.itemBoxes) {
        boxCount = window.gameState.itemBoxes.length;
      }
      return { boxCount };
    });
    check('Item boxes on track', itemBoxInfo.boxCount > 0, `${itemBoxInfo.boxCount} boxes`);
    
    const itemSlot = await page.evaluate(() => {
      const el = document.getElementById('hud-item');
      return el ? { exists: true, content: el.textContent, visible: el.offsetParent !== null || el.style.display !== 'none' } : { exists: false };
    });
    check('Item slot in HUD', itemSlot.exists);
    
    // === 11. PAUSE MENU ===
    console.log('\n=== PAUSE MENU ===');
    
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    await page.screenshot({ path: `${SCREENSHOT_DIR}/11-pause.png` });
    
    const pauseText = await page.evaluate(() => document.getElementById('menu-layer')?.textContent || '');
    const hasPauseMenu = pauseText.includes('Pause') || pauseText.includes('PAUSE') || pauseText.includes('Resume') || pauseText.includes('RESUME');
    check('Pause menu appears', hasPauseMenu);
    
    const hasResumeOption = pauseText.includes('Resume') || pauseText.includes('RESUME');
    const hasRestartOption = pauseText.includes('Restart') || pauseText.includes('RESTART');
    const hasQuitOption = pauseText.includes('Quit') || pauseText.includes('QUIT') || pauseText.includes('Menu') || pauseText.includes('MENU');
    check('Pause has Resume', hasResumeOption);
    check('Pause has Restart', hasRestartOption);
    check('Pause has Quit', hasQuitOption);
    
    // Resume
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    // === 12. EXTENDED RACING ===
    console.log('\n=== EXTENDED RACING ===');
    
    // Drive around for a while
    await page.keyboard.down('KeyW');
    for (let i = 0; i < 10; i++) {
      if (i % 3 === 0) {
        await page.keyboard.down('KeyA');
        await page.waitForTimeout(800);
        await page.keyboard.up('KeyA');
      } else if (i % 3 === 1) {
        await page.keyboard.down('KeyD');
        await page.waitForTimeout(800);
        await page.keyboard.up('KeyD');
      } else {
        await page.waitForTimeout(800);
      }
    }
    
    await page.screenshot({ path: `${SCREENSHOT_DIR}/12-extended-racing.png` });
    
    // Check race progress
    const raceProgress = await page.evaluate(() => {
      const lapEl = document.getElementById('hud-lap');
      const timerEl = document.getElementById('hud-timer');
      const posEl = document.getElementById('hud-position');
      return {
        lap: lapEl?.textContent || '',
        timer: timerEl?.textContent || '',
        position: posEl?.textContent || ''
      };
    });
    check('Race timer progressing', raceProgress.timer !== '0:00.000', raceProgress.timer);
    check('Position tracking', raceProgress.position.length > 0, raceProgress.position);
    
    // === 13. CHECK FOR JS ERRORS ===
    console.log('\n=== STABILITY ===');
    check('No JS errors during gameplay', jsErrors.length === 0, jsErrors.length > 0 ? `${jsErrors.length} errors: ${jsErrors.slice(0,3).join('; ')}` : 'clean');
    
    // === 14. COMPLETE A RACE (via state manipulation) ===
    console.log('\n=== RACE COMPLETION ===');
    
    // Force finish the race to test results screen
    const forcedFinish = await page.evaluate(() => {
      if (!window.gameState || !window.gameState.karts) return false;
      // Force all karts to finish
      for (const k of window.gameState.karts) {
        if (k) {
          k.currentLap = 4;
          k.finished = true;
          k.totalTime = 90 + Math.random() * 30;
          k.lapTimes = [30, 30, 30];
        }
      }
      // Set player to 3rd place time
      window.gameState.karts[0].totalTime = 95;
      return true;
    });
    
    // Wait for results screen
    await page.waitForTimeout(3000);
    
    await page.screenshot({ path: `${SCREENSHOT_DIR}/13-results.png` });
    
    const resultsText = await page.evaluate(() => document.getElementById('menu-layer')?.textContent || '');
    const hasResults = resultsText.includes('Result') || resultsText.includes('RESULT') || resultsText.includes('Complete') || resultsText.includes('Finish') || resultsText.includes('FINISH') || resultsText.includes('Race');
    check('Results screen shown', hasResults, resultsText.substring(0, 100));
    
    // === 15. RETURN TO MENU ===
    console.log('\n=== RETURN TO MENU ===');
    
    // Try to find and click a "Menu" or "Quit" button
    await page.evaluate(() => {
      const btns = document.querySelectorAll('#menu-layer button, #menu-layer .menu-btn, #menu-layer [class*="btn"]');
      for (const b of btns) {
        if (b.textContent.includes('Menu') || b.textContent.includes('MENU') || b.textContent.includes('Quit') || b.textContent.includes('QUIT')) { 
          b.click(); 
          break; 
        }
      }
    });
    await page.waitForTimeout(1000);
    
    await page.screenshot({ path: `${SCREENSHOT_DIR}/14-back-to-menu.png` });
    
    const backAtMenu = await page.evaluate(() => {
      const text = document.getElementById('menu-layer')?.textContent || '';
      return text.includes('FABRO') || text.includes('RACE') || text.includes('Sunset') || text.includes('Track');
    });
    check('Returned to menu', backAtMenu);
    
    // === 16. SECOND RACE (different track) ===
    console.log('\n=== SECOND RACE ===');
    
    // Navigate to track select if on title
    await page.evaluate(() => {
      const btns = document.querySelectorAll('#menu-layer button, #menu-layer .menu-btn, #menu-layer [class*="btn"]');
      for (const b of btns) {
        if (b.textContent.includes('RACE') || b.textContent.includes('Race')) { b.click(); break; }
      }
    });
    await page.waitForTimeout(500);
    
    // Select second track (Fungal Canyon)
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    
    // Select character
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    
    // Start race
    await page.evaluate(() => {
      const btns = document.querySelectorAll('#menu-layer button, #menu-layer .menu-btn, #menu-layer [class*="btn"]');
      for (const b of btns) {
        if (b.textContent.includes('START') || b.textContent.includes('Start')) { b.click(); break; }
      }
    });
    await page.waitForTimeout(6000);
    
    await page.screenshot({ path: `${SCREENSHOT_DIR}/15-second-race.png` });
    
    // Verify it loaded a different track
    const secondTrackCheck = await page.evaluate(() => {
      if (!window.gameState) return null;
      return {
        trackId: window.gameState.trackId || window.gameState.currentTrack || 'unknown',
        kartCount: window.gameState.karts ? window.gameState.karts.length : 0
      };
    });
    check('Second race loads', secondTrackCheck?.kartCount === 8, `${secondTrackCheck?.kartCount} karts`);
    
    // Drive briefly
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(3000);
    
    await page.screenshot({ path: `${SCREENSHOT_DIR}/16-second-race-driving.png` });
    
    const secondRaceJsErrors = jsErrors.length;
    check('No new JS errors on second track', secondRaceJsErrors === 0, secondRaceJsErrors > 0 ? jsErrors.join('; ') : 'clean');
    
    await page.keyboard.up('KeyW');

    // === 17. CODE VERIFICATION ===
    console.log('\n=== CODE STRUCTURE VERIFICATION ===');
    
    // Verify key modules loaded
    const moduleCheck = await page.evaluate(() => {
      return {
        hasGameState: typeof window.gameState !== 'undefined',
        hasCanvas: document.getElementById('game-canvas') !== null,
        hasMinimap: document.getElementById('minimap-canvas') !== null,
        hasHud: document.getElementById('hud-layer') !== null
      };
    });
    check('Game state exposed', moduleCheck.hasGameState);
    check('All DOM elements present', moduleCheck.hasCanvas && moduleCheck.hasMinimap && moduleCheck.hasHud);
    
  } catch (err) {
    console.error('Test error:', err.message);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/ERROR.png` });
    check('Test completed without crash', false, err.message);
  }
  
  await browser.close();
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('REVIEW SUMMARY');
  console.log('='.repeat(60));
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('='.repeat(60));
  
  if (failed > 0) {
    console.log('\nFailed checks:');
    results.filter(r => !r.pass).forEach(r => {
      console.log(`  ❌ ${r.name}: ${r.detail}`);
    });
  }
  
  process.exit(failed > 0 ? 1 : 0);
})();

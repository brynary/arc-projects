// verify_race_finish.js — Verify that a full race completes with results screen
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, '.workflow', 'screenshots');

(async () => {
  if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader']
  });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();

  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('http://localhost:4567/', { waitUntil: 'networkidle', timeout: 30000 });
  
  // Wait for countdown (6s) + buffer
  await new Promise(r => setTimeout(r, 8000));
  
  console.log('Race started, driving aggressively...');
  
  // Drive with continuous acceleration and periodic drift boosts
  await page.keyboard.down('KeyW');
  
  let raceFinished = false;
  let lapsSeen = new Set();
  
  for (let sec = 0; sec < 180; sec++) { // Up to 3 minutes
    await new Promise(r => setTimeout(r, 1000));
    
    // Periodic drift boosts for speed
    if (sec % 8 === 3) {
      await page.keyboard.down('ShiftLeft');
      await page.keyboard.down('KeyD');
      await new Promise(r => setTimeout(r, 700));
      await page.keyboard.up('ShiftLeft');
      await page.keyboard.up('KeyD');
    }
    
    // Slight steering adjustments to follow track
    if (sec % 6 === 0) {
      await page.keyboard.down('KeyA');
      await new Promise(r => setTimeout(r, 300));
      await page.keyboard.up('KeyA');
    }
    
    const state = await page.evaluate(() => {
      const lapEl = document.getElementById('hud-lap');
      const resultsEl = document.getElementById('hud-results');
      const timerEl = document.getElementById('hud-timer');
      const posEl = document.getElementById('hud-position');
      return {
        lap: lapEl ? lapEl.textContent.trim() : '',
        timer: timerEl ? timerEl.textContent.trim() : '',
        position: posEl ? posEl.textContent.trim() : '',
        resultsVisible: resultsEl ? (resultsEl.style.display !== 'none' && resultsEl.style.display !== '' && resultsEl.innerHTML.includes('Race Results')) : false,
      };
    });
    
    // Track laps we've seen
    if (state.lap) lapsSeen.add(state.lap);
    
    if (sec % 10 === 0) {
      console.log(`[${sec}s] Lap: ${state.lap}, Timer: ${state.timer}, Pos: ${state.position}`);
    }
    
    if (state.resultsVisible) {
      raceFinished = true;
      console.log(`\n🏁 RACE FINISHED at ${sec}s! Timer: ${state.timer}`);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '10_race_complete.png') });
      
      // Read results table
      const resultsHTML = await page.evaluate(() => {
        const el = document.getElementById('hud-results');
        return el ? el.textContent : '';
      });
      console.log('Results:', resultsHTML.replace(/\s+/g, ' ').trim());
      break;
    }
  }
  
  console.log('\nLaps observed:', [...lapsSeen].join(', '));
  console.log('Race finished:', raceFinished);
  console.log('JS errors:', errors.length > 0 ? errors.join('; ') : 'none');
  
  await page.keyboard.up('KeyW');
  await browser.close();
  
  // Write result
  const result = { raceFinished, lapsSeen: [...lapsSeen], errors };
  fs.writeFileSync(
    path.join(__dirname, '.workflow', 'verify-race-finish.json'),
    JSON.stringify(result, null, 2)
  );
  
  process.exit(raceFinished ? 0 : 1);
})();

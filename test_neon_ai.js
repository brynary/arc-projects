// Test AI by exposing allKarts and monitoring for 60 seconds on each track
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  
  await page.goto('http://localhost:4567', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  
  // Patch main.js to expose allKarts on window
  await page.evaluate(() => {
    // Periodically check for kart meshes in the scene
    setInterval(() => {
      const scene = window.__threeScene;
      if (!scene) return;
      // Find kart-like objects (groups with userData)
    }, 1000);
  });

  // Test track 2 (Neon Grid) - seemed to have issues with AI lap completion
  console.log('=== Testing Neon Grid (AI focus) ===');
  
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
  
  // Select Neon Grid (index 2)
  const trackCards = await page.$$('.card');
  if (trackCards[2]) await trackCards[2].click();
  await page.waitForTimeout(200);
  await page.click('#ts-next');
  await page.waitForTimeout(600);
  await page.click('#cs-next');
  await page.waitForTimeout(600);
  await page.click('#ds-start');
  
  // Wait for race to start
  await page.waitForTimeout(8000);
  
  // Hold W to drive forward
  await page.keyboard.down('KeyW');
  
  // Take screenshots every 10 seconds
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(10000);
    await page.screenshot({ path: `neon_ai_${i*10+10}s.png` });
    
    const state = await page.evaluate(() => {
      const hp = document.getElementById('hp');
      const hl = document.getElementById('hl');
      const htm = document.getElementById('ht-main');
      return {
        position: hp?.textContent || 'N/A',
        lap: hl?.textContent || 'N/A',
        time: htm?.textContent || 'N/A',
      };
    });
    console.log(`[${i*10+10}s] Pos=${state.position.trim()} Lap=${state.lap} Time=${state.time}`);
  }
  
  await page.keyboard.up('KeyW');
  
  console.log(`\nErrors: ${errors.length}`);
  for (const e of errors.slice(0, 10)) console.log(`  ERR: ${e}`);
  
  await browser.close();
})();

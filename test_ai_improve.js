// Test AI reliability across all 4 tracks
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Collect console messages
  const errors = [];
  const warnings = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
    if (msg.type() === 'warning') warnings.push(msg.text());
  });
  
  await page.goto('http://localhost:4567', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  
  // Start a race on each track and observe AI behavior
  const tracks = ['Sunset Bay', 'Mossy Canyon', 'Neon Grid', 'Volcano Peak'];
  
  for (let trackIdx = 0; trackIdx < 4; trackIdx++) {
    console.log(`\n=== Testing Track ${trackIdx}: ${tracks[trackIdx]} ===`);
    
    // Navigate menus
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    // Select track
    const trackCards = await page.$$('.card');
    if (trackCards[trackIdx]) {
      await trackCards[trackIdx].click();
      await page.waitForTimeout(200);
    }
    await page.click('#ts-next');
    await page.waitForTimeout(500);
    
    // Select character (default)
    await page.click('#cs-next');
    await page.waitForTimeout(500);
    
    // Select difficulty and start
    await page.click('#ds-start');
    await page.waitForTimeout(8000); // Wait through countdown
    
    // Now race for 30 seconds and check AI state
    const results = await page.evaluate(() => {
      return new Promise(resolve => {
        let checks = [];
        let checkInterval = setInterval(() => {
          // Access game state to check AI karts
          const karts = window.__allKarts || [];
          if (karts.length === 0) {
            // Try to find via module scope - not accessible directly
            checks.push({ t: Date.now(), note: 'no karts accessible' });
            return;
          }
          
          const aiData = karts.filter(k => !k.isPlayer).map(k => ({
            id: k.characterId,
            pos: { x: k.position?.x?.toFixed(1), y: k.position?.y?.toFixed(1), z: k.position?.z?.toFixed(1) },
            speed: k.speed?.toFixed(1),
            finished: k.finished,
            lap: k.currentLap,
            cp: k.lastCheckpoint,
            stuck: k.ai?.stuckTimer?.toFixed(2),
            reversing: k.ai?.reverseTimer > 0,
          }));
          checks.push({ t: Date.now(), karts: aiData });
        }, 5000);
        
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve(checks);
        }, 30000);
      });
    });
    
    console.log(`Collected ${results.length} check(s)`);
    for (const check of results) {
      if (check.karts) {
        for (const k of check.karts) {
          console.log(`  ${k.id}: pos(${k.pos?.x},${k.pos?.y},${k.pos?.z}) speed=${k.speed} lap=${k.lap} cp=${k.cp} stuck=${k.stuck} rev=${k.reversing}`);
        }
      } else {
        console.log(`  ${check.note}`);
      }
    }
    
    // Take a screenshot
    await page.screenshot({ path: `test_ai_track${trackIdx}.png` });
    
    // Quit to menu for next test
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const quitBtn = await page.$('[data-act="quit"]');
    if (quitBtn) await quitBtn.click();
    await page.waitForTimeout(1000);
  }
  
  console.log(`\nErrors: ${errors.length}`);
  for (const e of errors.slice(0, 10)) console.log(`  ERR: ${e}`);
  console.log(`Warnings: ${warnings.length}`);
  
  await browser.close();
})();

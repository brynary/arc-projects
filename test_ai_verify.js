// Test AI reliability improvements: curvature braking, off-road recovery, emergency respawn
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  
  await page.goto('http://localhost:4567', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  
  const trackNames = ['Sunset Bay', 'Mossy Canyon', 'Neon Grid', 'Volcano Peak'];
  
  for (let trackIdx = 0; trackIdx < 4; trackIdx++) {
    console.log(`\n=== Track ${trackIdx}: ${trackNames[trackIdx]} ===`);
    
    // Navigate menus
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    const trackCards = await page.$$('.card');
    if (trackCards[trackIdx]) await trackCards[trackIdx].click();
    await page.waitForTimeout(200);
    await page.click('#ts-next');
    await page.waitForTimeout(500);
    await page.click('#cs-next');
    await page.waitForTimeout(500);
    await page.click('#ds-start');
    
    // Wait for countdown + race start
    await page.waitForTimeout(9000);
    
    // Hold accelerate
    await page.keyboard.down('KeyW');
    
    // Monitor AI state every 10 game-seconds
    for (let s = 0; s < 5; s++) {
      await page.waitForTimeout(8000);
      
      const state = await page.evaluate(() => {
        const karts = window.__allKarts || [];
        const rs = window.__raceState;
        if (karts.length === 0) return null;
        
        return {
          raceTime: rs?.raceTime?.toFixed(1) || '?',
          raceStatus: rs?.status || '?',
          karts: karts.map(k => ({
            id: k.characterId,
            isPlayer: k.isPlayer,
            pos: { x: +k.position.x.toFixed(0), y: +k.position.y.toFixed(0), z: +k.position.z.toFixed(0) },
            speed: +k.speed.toFixed(1),
            lap: k.currentLap,
            cp: k.lastCheckpoint,
            finished: k.finished,
            surface: k.surfaceType,
            stuck: k.ai?.stuckTimer?.toFixed(2) || '0',
            consStucks: k.ai?.consecutiveStucks || 0,
            cpStall: k.ai?.checkpointStallTimer?.toFixed(1) || '0',
          })),
        };
      });
      
      if (state) {
        console.log(`  [Race time ${state.raceTime}s, status=${state.raceStatus}]`);
        for (const k of state.karts) {
          const marker = k.isPlayer ? '★' : ' ';
          console.log(`  ${marker} ${k.id.padEnd(8)} pos(${k.pos.x},${k.pos.y},${k.pos.z}) spd=${k.speed} lap=${k.lap} cp=${k.cp} ${k.surface} stuck=${k.stuck} stalls=${k.cpStall} consStuck=${k.consStucks}${k.finished?' FINISHED':''}`);
        }
      } else {
        console.log('  No kart data available');
      }
    }
    
    await page.keyboard.up('KeyW');
    await page.screenshot({ path: `verify_ai_t${trackIdx}.png` });
    
    // Quit to menu
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const quitBtn = await page.$('[data-act="quit"]');
    if (quitBtn) await quitBtn.click();
    await page.waitForTimeout(1000);
  }
  
  console.log(`\n=== Error Summary ===`);
  console.log(`Total errors: ${errors.length}`);
  for (const e of errors.slice(0, 15)) console.log(`  ERR: ${e}`);
  
  await browser.close();
  
  if (errors.length > 0) {
    console.log('\nFAIL: Errors detected');
    process.exit(1);
  } else {
    console.log('\nPASS: No errors');
    process.exit(0);
  }
})();

// Test race flow on all 4 tracks
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  let errors = [];
  page.on('pageerror', e => errors.push(e.message));
  
  const tracks = ['Sunset Bay', 'Mossy Canyon', 'Neon Grid', 'Volcano Peak'];
  
  for (let trackIdx = 0; trackIdx < 4; trackIdx++) {
    await page.goto('http://localhost:4567', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    errors = [];
    
    // Navigate to race
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
    
    // Select track
    const trackCards = await page.$$('.card');
    if (trackCards[trackIdx]) await trackCards[trackIdx].click();
    await page.waitForTimeout(200);
    await page.click('#ts-next');
    await page.waitForTimeout(300);
    
    // Select character
    const charCards = await page.$$('.card');
    if (charCards[0]) await charCards[0].click();
    await page.waitForTimeout(200);
    await page.click('#cs-next');
    await page.waitForTimeout(300);
    
    // Start race
    await page.click('#ds-start');
    await page.waitForTimeout(9000); // Wait for countdown
    
    // Drive forward for 8 seconds
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(8000);
    
    const state = await page.evaluate(() => {
      const rs = window.__raceState;
      const pk = window.__allKarts?.find(k => k.isPlayer);
      const numCPs = window.__trackData?.checkpoints?.length;
      const aiLaps = window.__allKarts?.filter(k => !k.isPlayer).map(k => k.currentLap);
      return {
        status: rs?.status,
        raceTime: rs?.raceTime?.toFixed(1),
        playerLap: pk?.currentLap,
        playerLastCP: pk?.lastCheckpoint,
        lapTimesCount: pk?.lapTimes?.length,
        numCheckpoints: numCPs,
        aiMaxLap: Math.max(...(aiLaps || [0])),
        hudLap: document.getElementById('hl')?.textContent,
        kartsCount: window.__allKarts?.length,
      };
    });
    
    await page.keyboard.up('ArrowUp');
    
    const noFalseLap = state.playerLap === 0 && state.lapTimesCount === 0;
    const aiNoFalseLap = state.aiMaxLap <= 1; // AI might complete 1 real lap in 8s on easy tracks
    console.log(`${tracks[trackIdx]}: playerLap=${state.playerLap}, playerLastCP=${state.playerLastCP}, lapTimes=${state.lapTimesCount}, aiMaxLap=${state.aiMaxLap}, HUD=${state.hudLap}, karts=${state.kartsCount}, errors=${errors.length} — ${noFalseLap ? 'PASS' : 'FAIL'}`);
    if (errors.length > 0) console.log('  Errors:', errors.slice(0, 3).join('; '));
  }
  
  await browser.close();
  console.log('Done');
})();

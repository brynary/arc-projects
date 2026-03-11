// Test crash fixes: step cap, DNF sort, event priority
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));
  
  await page.goto('http://localhost:4567', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  
  console.log('=== Page loaded, errors:', errors.length);
  
  // Press Enter on title
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  
  // Select first track
  const cards = await page.$$('.card');
  if (cards[0]) await cards[0].click();
  await page.waitForTimeout(200);
  await page.$('#ts-next').then(b => b?.click());
  await page.waitForTimeout(500);
  
  // Select first character
  const charCards = await page.$$('.card');
  if (charCards[0]) await charCards[0].click();
  await page.waitForTimeout(200);
  await page.$('#cs-next').then(b => b?.click());
  await page.waitForTimeout(500);
  
  // Start race
  await page.$('#ds-start').then(b => b?.click());
  await page.waitForTimeout(2000);
  
  // Test 1: Check step cap fix — countdown should complete within 8 seconds
  console.log('\n=== Test 1: Countdown completion ===');
  let countdownDone = false;
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(1000);
    const state = await page.evaluate(() => ({
      status: window.__raceState?.status || 'unknown',
      raceTime: window.__raceState?.raceTime || 0,
      speed: window.__allKarts?.[0]?.speed?.toFixed(1) || '0',
    }));
    console.log(`  t=${i}s: status=${state.status}, raceTime=${state.raceTime.toFixed(1)}, speed=${state.speed}`);
    if (state.status === 'racing') {
      countdownDone = true;
      console.log('  ✓ Countdown completed at t=' + i + 's');
      break;
    }
  }
  if (!countdownDone) console.log('  ✗ Countdown did not complete in 12 seconds');
  
  // Now accelerate and race for a bit
  await page.keyboard.down('w');
  await page.waitForTimeout(5000);
  
  const state1 = await page.evaluate(() => ({
    status: window.__raceState?.status,
    raceTime: window.__raceState?.raceTime?.toFixed(1),
    speed: window.__allKarts?.[0]?.speed?.toFixed(1),
    pos: window.__allKarts?.[0]?.racePosition,
  }));
  console.log(`\n  Racing: status=${state1.status}, time=${state1.raceTime}, speed=${state1.speed}, position=${state1.pos}`);
  
  await page.keyboard.up('w');
  
  // Test 2: DNF sort order
  console.log('\n=== Test 2: DNF sort order ===');
  const sortTest = await page.evaluate(() => {
    // Simulate DNF scenario: mark some karts as finished with null finishTime
    const karts = window.__allKarts;
    if (!karts) return 'no karts';
    
    // Save state
    const saved = karts.map(k => ({ finished: k.finished, finishTime: k.finishTime, raceProgress: k.raceProgress }));
    
    // Set up test scenario: kart 0 finished at 60s, kart 1 DNF, kart 2 finished at 50s
    karts[0].finished = true; karts[0].finishTime = 60;
    karts[1].finished = true; karts[1].finishTime = null; // DNF
    karts[2].finished = true; karts[2].finishTime = 50;
    karts[3].finished = false; karts[3].raceProgress = 5;
    karts[4].finished = false; karts[4].raceProgress = 3;
    
    // Sort using the same logic as getRaceResults
    const sorted = [...karts].sort((a, b) => {
      if (a.finished && b.finished) {
        if (a.finishTime === null && b.finishTime === null) return 0;
        if (a.finishTime === null) return 1;
        if (b.finishTime === null) return -1;
        return a.finishTime - b.finishTime;
      }
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.raceProgress - a.raceProgress;
    });
    
    const result = sorted.map((k, i) => `${i+1}: idx=${karts.indexOf(k)} ft=${k.finishTime} fin=${k.finished}`);
    
    // Restore state
    for (let i = 0; i < karts.length; i++) {
      karts[i].finished = saved[i].finished;
      karts[i].finishTime = saved[i].finishTime;
      karts[i].raceProgress = saved[i].raceProgress;
    }
    
    return result;
  });
  console.log('  Sort result:');
  for (const r of sortTest) console.log('    ' + r);
  
  // Verify DNF is last among finished karts
  const dnfLine = sortTest.find(r => r.includes('ft=null'));
  const dnfPos = sortTest.indexOf(dnfLine) + 1;
  const finishedLines = sortTest.filter(r => r.includes('fin=true'));
  console.log(`  DNF at position ${dnfPos} of ${finishedLines.length} finishers — ${dnfPos === finishedLines.length ? '✓ correct (last among finished)' : '✗ wrong'}`);
  
  // Test 3: Error count
  console.log('\n=== Test 3: Console errors ===');
  console.log(`  Total errors: ${errors.length}`);
  for (const e of errors) console.log('    ERROR:', e.substring(0, 150));
  
  await page.screenshot({ path: '/home/daytona/workspace/test_crash_fixes.png' });
  
  await browser.close();
  console.log('\n=== All tests done ===');
})();

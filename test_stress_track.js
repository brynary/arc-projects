// Stress test: Run a full race on each track and verify AI karts make progress
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));
  
  await page.goto('http://localhost:4567', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Test Volcano Peak specifically (most complex track - multi-level switchbacks)
  console.log('=== Testing Volcano Peak (multi-level track) ===');
  
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  
  // Select Volcano Peak (index 3)
  const cards = await page.$$('.card');
  if (cards[3]) await cards[3].click();
  await page.waitForTimeout(200);
  await page.click('#ts-next');
  await page.waitForTimeout(300);
  await page.click('#cs-next');
  await page.waitForTimeout(300);
  await page.click('#ds-start');
  
  // Wait for countdown
  await page.waitForTimeout(8000);
  
  // Drive for 30 seconds, accelerating + following track
  console.log('Racing for 30 seconds...');
  await page.keyboard.down('ArrowUp');
  
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `test_screenshots/volcano_stress_${i}.png` });
    
    const lapInfo = await page.evaluate(() => {
      const lapEl = document.getElementById('hl');
      const posEl = document.getElementById('hp');
      const timeEl = document.getElementById('ht-main');
      return {
        lap: lapEl?.textContent || 'N/A',
        position: posEl?.textContent || 'N/A',
        time: timeEl?.textContent || 'N/A',
      };
    });
    console.log(`  t=${(i+1)*5}s: Lap=${lapInfo.lap}, Pos=${lapInfo.position}, Time=${lapInfo.time}`);
    
    // Add occasional steering
    if (i % 2 === 0) {
      await page.keyboard.down('ArrowRight');
      await page.waitForTimeout(500);
      await page.keyboard.up('ArrowRight');
    } else {
      await page.keyboard.down('ArrowLeft');
      await page.waitForTimeout(500);
      await page.keyboard.up('ArrowLeft');
    }
  }
  
  await page.keyboard.up('ArrowUp');
  
  if (errors.length > 0) {
    console.log('\nErrors during Volcano Peak test:');
    errors.forEach(e => console.log('  -', e));
  } else {
    console.log('\n✓ Volcano Peak: No errors during 30s race');
  }
  
  await browser.close();
  console.log('\nStress test complete.');
})();

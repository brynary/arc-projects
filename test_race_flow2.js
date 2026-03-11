// Quick visual verification test
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  
  await page.goto('http://localhost:4567/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Navigate through menus quickly
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const nextBtn = await page.$('#ts-next');
  if (nextBtn) await nextBtn.click();
  await page.waitForTimeout(300);
  const csNext = await page.$('#cs-next');
  if (csNext) await csNext.click();
  await page.waitForTimeout(300);
  const startBtn = await page.$('#ds-start');
  if (startBtn) await startBtn.click();
  
  // Wait through countdown, take screenshot during race
  await page.waitForTimeout(15000);
  await page.screenshot({ path: 'race_flow_racing.png' });
  
  // Let it run a bit more
  await page.waitForTimeout(5000);
  
  // Verify no errors
  const criticalErrors = errors.filter(e => !e.includes('404') && !e.includes('net::ERR'));
  if (criticalErrors.length > 0) {
    console.log('ERRORS:', criticalErrors);
  } else {
    console.log('No critical errors during race');
  }
  
  // Test quit-to-menu: verify stale timeouts don't fire
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const quitBtn = await page.$('[data-act="quit"]');
  if (quitBtn) {
    await quitBtn.click();
    await page.waitForTimeout(2000);
    
    // Verify we're back at title
    const titleVisible = await page.evaluate(() => {
      const menu = document.getElementById('menu-overlay');
      return menu && !menu.classList.contains('hidden');
    });
    console.log('Back at title:', titleVisible);
    
    // Wait for any stale timeouts to fire (they shouldn't cause issues)
    await page.waitForTimeout(4000);
    
    // Check no stale results appeared
    const resultsVisible = await page.evaluate(() => {
      const results = document.getElementById('results-panel');
      return results && !results.classList.contains('hidden');
    });
    console.log('Stale results visible (should be false):', resultsVisible);
    
    if (resultsVisible) {
      console.log('FAIL: Stale setTimeout fired after quit');
      await browser.close();
      process.exit(1);
    }
    console.log('PASS: No stale setTimeouts after quit');
  }
  
  await page.screenshot({ path: 'race_flow_menu.png' });
  
  const finalErrors = errors.filter(e => !e.includes('404') && !e.includes('net::ERR'));
  console.log('Total errors:', finalErrors.length);
  
  console.log('\nVisual verification complete');
  await browser.close();
  process.exit(0);
})();

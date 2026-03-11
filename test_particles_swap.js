// test_particles_swap.js — Verify particle swap-and-pop works during active race
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  
  await page.goto('http://localhost:4567/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1500);
  
  // Quick start a race
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  await page.click('#ts-next');
  await page.waitForTimeout(300);
  await page.click('#cs-next');
  await page.waitForTimeout(300);
  await page.click('#ds-start');
  await page.waitForTimeout(7000); // Wait for countdown to finish
  
  // Hold accelerate and drift for 5s to generate lots of particles
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(2000);
  
  // Start drifting to generate spark particles
  await page.keyboard.down('ArrowLeft');
  await page.keyboard.down('ShiftLeft');
  await page.waitForTimeout(3000);
  
  await page.keyboard.up('ShiftLeft');
  await page.keyboard.up('ArrowLeft');
  await page.waitForTimeout(1000);
  
  // Check for errors (swap-and-pop bugs would cause index errors)
  console.log('Errors after heavy particle use:', errors.length > 0 ? errors.join('; ') : 'none');
  
  await page.screenshot({ path: 'test_particles_verified.png' });
  
  if (errors.length > 0) {
    console.log('FAIL');
    process.exit(1);
  }
  console.log('PASS: Particles work correctly with swap-and-pop');
  
  await browser.close();
})();

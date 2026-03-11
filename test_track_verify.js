// Verify track integrity improvements
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('http://localhost:4567', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);

  const tracks = ['Sunset Bay', 'Mossy Canyon', 'Neon Grid', 'Volcano Peak'];

  for (let idx = 0; idx < 4; idx++) {
    console.log(`\n=== ${tracks[idx]} ===`);

    const cards = await page.$$('.card');
    if (cards[idx]) await cards[idx].click();
    await page.waitForTimeout(200);
    await page.click('#ts-next');
    await page.waitForTimeout(200);
    await page.click('#cs-next');
    await page.waitForTimeout(200);
    await page.click('#ds-start');
    await page.waitForTimeout(6000);

    const result = await page.evaluate(() => {
      const td = window.__trackData;
      if (!td) return { error: 'No track data' };

      const samples = td.samples;
      const walls = td.collisionWalls;

      // 1. Verify last sample exactly matches first (closure fix)
      const first = samples[0];
      const last = samples[samples.length - 1];
      const posMatch = first.pos.x === last.pos.x && first.pos.y === last.pos.y && first.pos.z === last.pos.z;
      const leftMatch = first.leftEdge.x === last.leftEdge.x && first.leftEdge.z === last.leftEdge.z;
      const rightMatch = first.rightEdge.x === last.rightEdge.x && first.rightEdge.z === last.rightEdge.z;

      // 2. Verify wall sampleT values exist and are in [0,1]
      let wallsWithT = 0;
      let badT = 0;
      for (const w of walls) {
        if (w.sampleT !== undefined) {
          wallsWithT++;
          if (w.sampleT < 0 || w.sampleT > 1) badT++;
        }
      }

      // 3. Verify sectors are populated based on t-values
      const sectors = td.sectors;
      let emptyCount = 0;
      for (const s of sectors) {
        if (s.wallIndices.length === 0) emptyCount++;
      }

      // 4. Wall closure: find walls near t=0 and t=1 and verify coverage
      const wallsNearStart = walls.filter(w => w.sampleT !== undefined && (w.sampleT < 0.02 || w.sampleT > 0.98));
      
      // 5. Verify a point just outside the track at t=0 hits a wall
      const testPoint = {
        x: first.leftEdge.x + (first.leftEdge.x - first.pos.x) * 0.2,
        z: first.leftEdge.z + (first.leftEdge.z - first.pos.z) * 0.2,
      };
      let hitsWall = false;
      const radius = 2.5;
      for (const w of wallsNearStart) {
        const dx = w.p2.x - w.p1.x;
        const dz = w.p2.z - w.p1.z;
        const lenSq = dx * dx + dz * dz;
        if (lenSq < 0.01) continue;
        let t = ((testPoint.x - w.p1.x) * dx + (testPoint.z - w.p1.z) * dz) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const cx = w.p1.x + t * dx;
        const cz = w.p1.z + t * dz;
        const d = Math.sqrt((testPoint.x - cx) ** 2 + (testPoint.z - cz) ** 2);
        if (d < radius) { hitsWall = true; break; }
      }

      // 6. Race state
      const rs = window.__raceState;

      return {
        posMatch,
        leftMatch,
        rightMatch,
        totalWalls: walls.length,
        wallsWithT,
        badT,
        emptySectors: emptyCount,
        wallsNearStart: wallsNearStart.length,
        testPointHitsWall: hitsWall,
        raceStatus: rs?.status,
        kartCount: window.__allKarts?.length,
      };
    });

    console.log(JSON.stringify(result, null, 2));

    // Take screenshot
    await page.screenshot({ path: `track_verify_${idx}.png` });

    // Quit
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const quitBtn = await page.$('[data-act="quit"]');
    if (quitBtn) await quitBtn.click();
    await page.waitForTimeout(800);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
  }

  console.log('\nConsole errors:', errors.length > 0 ? errors : 'None');
  console.log('\n=== ALL TRACKS VERIFIED ===');
  await browser.close();
})();

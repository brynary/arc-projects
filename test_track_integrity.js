// Test track integrity: gaps, wall coverage, checkpoint placement
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const tracks = [
    { name: 'Sunset Bay', idx: 0 },
    { name: 'Mossy Canyon', idx: 1 },
    { name: 'Neon Grid', idx: 2 },
    { name: 'Volcano Peak', idx: 3 },
  ];

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('http://localhost:4567', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);

  for (const track of tracks) {
    console.log(`\n=== Testing ${track.name} ===`);

    const cards = await page.$$('.card');
    if (cards[track.idx]) {
      await cards[track.idx].click();
      await page.waitForTimeout(200);
    }

    await page.click('#ts-next');
    await page.waitForTimeout(300);
    await page.click('#cs-next');
    await page.waitForTimeout(300);
    await page.click('#ds-start');
    await page.waitForTimeout(5000);

    const diagnostics = await page.evaluate(() => {
      const td = window.__trackData;
      if (!td) return { error: 'No track data' };

      const samples = td.samples;
      const walls = td.collisionWalls;
      const checkpoints = td.checkpoints;
      const sectors = td.sectors;

      // 1. Road ribbon closure
      const first = samples[0];
      const last = samples[samples.length - 1];
      const closureDist = Math.sqrt(
        (first.pos.x - last.pos.x) ** 2 +
        (first.pos.y - last.pos.y) ** 2 +
        (first.pos.z - last.pos.z) ** 2
      );

      // 2. Empty sectors
      const emptySectors = sectors.filter(s => s.wallIndices.length === 0).length;

      // 3. Wall closure gaps
      let leftGap = null, rightGap = null;
      if (walls.length >= 4) {
        const lastLeft = walls[walls.length - 2];
        const firstLeft = walls[0];
        if (lastLeft && firstLeft) {
          leftGap = Math.sqrt((lastLeft.p2.x - firstLeft.p1.x) ** 2 + (lastLeft.p2.z - firstLeft.p1.z) ** 2);
        }
        const lastRight = walls[walls.length - 1];
        const firstRight = walls[1];
        if (lastRight && firstRight) {
          rightGap = Math.sqrt((lastRight.p2.x - firstRight.p1.x) ** 2 + (lastRight.p2.z - firstRight.p1.z) ** 2);
        }
      }

      // 4. Sector-to-t alignment test: for each sector, compute the t-value range of its walls
      // based on their sequential position in the wall array
      const wallsPerSector = Math.ceil(walls.length / sectors.length);
      let sectorAlignmentIssues = 0;
      for (let s = 0; s < sectors.length; s++) {
        const idxs = sectors[s].wallIndices;
        if (idxs.length === 0) continue;
        // Wall i corresponds to sample floor(i/2), t = floor(i/2)/(samples.length-1)
        const tMin = Math.floor(idxs[0] / 2) / (samples.length - 1);
        const tMax = Math.floor(idxs[idxs.length - 1] / 2) / (samples.length - 1);
        const expectedT = s / sectors.length;
        // Check if expectedT falls within [tMin-margin, tMax+margin]
        const margin = 2 / sectors.length;
        if (expectedT < tMin - margin || expectedT > tMax + margin) {
          sectorAlignmentIssues++;
        }
      }

      // 5. Count large wall gaps (>5 units)
      let largeGapCount = 0;
      let maxWallGap = 0;
      for (let i = 0; i < walls.length - 2; i += 2) {
        const w1 = walls[i], w2 = walls[i + 2];
        if (!w1 || !w2) continue;
        const gap = Math.sqrt((w1.p2.x - w2.p1.x) ** 2 + (w1.p2.z - w2.p1.z) ** 2);
        if (gap > maxWallGap) maxWallGap = gap;
        if (gap > 5) largeGapCount++;
      }

      // 6. Kart positions and on-road status
      const karts = window.__allKarts;
      const kartInfo = karts ? karts.map(k => ({
        id: k.characterId,
        pos: { x: k.position.x.toFixed(1), y: k.position.y.toFixed(1), z: k.position.z.toFixed(1) },
        surface: k.surfaceType,
        onGround: k.onGround,
      })) : [];

      return {
        sampleCount: samples.length,
        wallCount: walls.length,
        closureDist: closureDist.toFixed(4),
        emptySectors,
        leftClosureGap: leftGap?.toFixed(4),
        rightClosureGap: rightGap?.toFixed(4),
        sectorAlignmentIssues,
        largeGapCount,
        maxWallGap: maxWallGap.toFixed(4),
        checkpointCount: checkpoints.length,
        kartCount: karts?.length,
        kartSample: kartInfo.slice(0, 3),
      };
    });

    console.log('Diagnostics:', JSON.stringify(diagnostics, null, 2));
    await page.screenshot({ path: `track_${track.idx}_integrity.png` });

    // Quit back to menu
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const quitBtn = await page.$('[data-act="quit"]');
    if (quitBtn) {
      await quitBtn.click();
      await page.waitForTimeout(1000);
    }
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
  }

  console.log('\n\nConsole errors:', errors.length > 0 ? errors : 'None');
  await browser.close();
})();

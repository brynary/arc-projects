// 2D minimap renderer – vanilla ES module, no dependencies
// Draws a top-down track outline with kart dots on a 180×180 canvas.

const SIZE = 180;
const PADDING = 14;
const TRACK_SAMPLES = 50;

let ctx = null;

/**
 * Grab the existing #minimap-canvas element and store its 2D context.
 * @returns {CanvasRenderingContext2D}
 */
export function initMinimap() {
  const canvas = document.getElementById('minimap-canvas');
  ctx = canvas.getContext('2d');
  return ctx;
}

/**
 * Draw one frame of the minimap.
 * @param {object} track   – runtime track object (has .spline)
 * @param {object[]} karts – all kart entities
 * @param {object} playerKart – the player's kart entity
 */
export function updateMinimap(track, karts, playerKart) {
  if (!ctx) return;

  // ── Sample the track spline ──────────────────────────────────────
  const points = [];
  for (let i = 0; i < TRACK_SAMPLES; i++) {
    const t = i / TRACK_SAMPLES;
    const p = track.spline.getPointAt(t);
    points.push({ x: p.x, z: p.z });
  }

  // ── Compute bounding box of sampled points ───────────────────────
  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }

  const rangeX = maxX - minX || 1;
  const rangeZ = maxZ - minZ || 1;
  const drawSize = SIZE - PADDING * 2;
  const scale = Math.min(drawSize / rangeX, drawSize / rangeZ);
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;

  // Project world XZ → canvas XY (before rotation).
  // X maps to canvas-x, Z maps to canvas-y.
  function project(wx, wz) {
    return {
      x: (wx - cx) * scale + SIZE / 2,
      y: (wz - cz) * scale + SIZE / 2,
    };
  }

  // ── Clear & background ───────────────────────────────────────────
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // ── Apply rotation so player faces up ────────────────────────────
  ctx.save();
  ctx.translate(SIZE / 2, SIZE / 2);
  ctx.rotate(-playerKart.rotationY);
  ctx.translate(-SIZE / 2, -SIZE / 2);

  // ── Draw track outline ───────────────────────────────────────────
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const p = project(points[i].x, points[i].z);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 3;
  ctx.stroke();

  // ── Draw kart dots ───────────────────────────────────────────────
  for (const kart of karts) {
    const p = project(kart.position.x, kart.position.z);

    if (kart.isPlayer) {
      // Player: larger yellow dot
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#FFD700';
      ctx.fill();
    } else {
      // CPU: smaller dot in character colour
      const color = (kart.character && kart.character.colors && kart.character.colors.primary)
        ? kart.character.colors.primary
        : '#FFFFFF';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }

  ctx.restore();
}

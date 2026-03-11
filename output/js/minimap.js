import * as THREE from 'three';

const CANVAS_SIZE = 150;
const MARGIN = 5;
const DRAW_SIZE = CANVAS_SIZE - MARGIN * 2; // 140
const TRACK_SAMPLES = 200;

const DOT_COLORS = ['#FFFFFF', '#FF4444', '#4488FF', '#44FF44'];
const DOT_RADII  = [5, 4, 4, 4];

/**
 * Creates a minimap that renders a top-down view of the track with racer dots.
 * @param {HTMLElement} containerEl - DOM element to append the canvas to
 * @param {{ curve: THREE.CatmullRomCurve3, widthProfile: any }} collisionData
 * @param {{ controlPoints: any[], name: string }} trackData
 */
export function createMinimap(containerEl, collisionData, trackData) {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  canvas.className = 'minimap-canvas';

  const wrapper = document.createElement('div');
  wrapper.className = 'minimap-container';
  wrapper.appendChild(canvas);
  containerEl.appendChild(wrapper);

  const ctx = canvas.getContext('2d');

  // Sample the track curve to get 2D points (X, Z)
  const trackPoints = [];
  for (let i = 0; i <= TRACK_SAMPLES; i++) {
    const t = i / TRACK_SAMPLES;
    const p = collisionData.curve.getPointAt(t);
    trackPoints.push({ x: p.x, z: p.z });
  }

  // Compute bounding box
  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (const p of trackPoints) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }

  const rangeX = maxX - minX || 1;
  const rangeZ = maxZ - minZ || 1;
  const range = Math.max(rangeX, rangeZ);

  // Center offset so the track is centered in the canvas
  const offsetX = (range - rangeX) / 2;
  const offsetZ = (range - rangeZ) / 2;

  function mapX(worldX) {
    return ((worldX - minX + offsetX) / range) * DRAW_SIZE + MARGIN;
  }

  function mapZ(worldZ) {
    return ((worldZ - minZ + offsetZ) / range) * DRAW_SIZE + MARGIN;
  }

  // Pre-compute mapped track points
  const mappedTrack = trackPoints.map(p => ({ x: mapX(p.x), y: mapZ(p.z) }));

  function drawTrackOutline() {
    ctx.beginPath();
    ctx.moveTo(mappedTrack[0].x, mappedTrack[0].y);
    for (let i = 1; i < mappedTrack.length; i++) {
      ctx.lineTo(mappedTrack[i].x, mappedTrack[i].y);
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawDot(worldX, worldZ, color, radius) {
    const cx = mapX(worldX);
    const cz = mapZ(worldZ);
    ctx.beginPath();
    ctx.arc(cx, cz, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function update(allKarts, playerKart) {
    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Track outline
    drawTrackOutline();

    // Draw CPU karts first (so player draws on top)
    let colorIndex = 0;
    for (const kart of allKarts) {
      if (kart === playerKart) continue;
      colorIndex++;
      const idx = Math.min(colorIndex, DOT_COLORS.length - 1);
      const pos = kart.position || kart.mesh?.position;
      if (pos) {
        drawDot(pos.x, pos.z, DOT_COLORS[idx], DOT_RADII[idx]);
      }
    }

    // Draw player on top
    if (playerKart) {
      const pos = playerKart.position || playerKart.mesh?.position;
      if (pos) {
        drawDot(pos.x, pos.z, DOT_COLORS[0], DOT_RADII[0]);
      }
    }
  }

  function destroy() {
    wrapper.remove();
  }

  return { update, destroy };
}

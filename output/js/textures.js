// Procedural texture generation via offscreen canvas
import * as THREE from 'three';

// Road texture: dark gray base with grid lines and dashed center line
export function createRoadTexture(baseColor = '#555555') {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Base
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);

  // Subtle noise
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const brightness = Math.random() * 30 - 15;
    ctx.fillStyle = `rgba(${128 + brightness}, ${128 + brightness}, ${128 + brightness}, 0.15)`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Grid lines (subtle)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i < size; i += 8) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  // Center line (dashed yellow)
  ctx.strokeStyle = '#CCAA00';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(size / 2, 0);
  ctx.lineTo(size / 2, size);
  ctx.stroke();
  ctx.setLineDash([]);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

// Off-road texture: per-theme noise pattern
export function createOffroadTexture(baseColor = '#50C878') {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);

  // Noise
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const brightness = Math.random() * 50 - 25;
    const c = hexToRGB(baseColor);
    ctx.fillStyle = `rgba(${clampC(c.r + brightness)}, ${clampC(c.g + brightness)}, ${clampC(c.b + brightness)}, 0.5)`;
    ctx.fillRect(x, y, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Boost pad texture: chevron arrows
export function createBoostPadTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#FF8800';
  ctx.fillRect(0, 0, 32, 64);

  ctx.fillStyle = '#FFCC00';
  // Draw chevrons
  for (let row = 0; row < 4; row++) {
    const y = row * 16;
    ctx.beginPath();
    ctx.moveTo(0, y + 12);
    ctx.lineTo(16, y + 4);
    ctx.lineTo(32, y + 12);
    ctx.lineTo(32, y + 16);
    ctx.lineTo(16, y + 8);
    ctx.lineTo(0, y + 16);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Checker texture for start/finish
export function createCheckerTexture() {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const cellSize = size / 4;
  for (let x = 0; x < 4; x++) {
    for (let y = 0; y < 4; y++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#FFFFFF' : '#222222';
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Ice texture
export function createIceTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Gradient blue
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#88CCEE');
  grad.addColorStop(1, '#AADDFF');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // White specks
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillRect(x, y, 1, 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function hexToRGB(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function clampC(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

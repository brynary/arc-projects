// js/camera.js — Chase camera with smooth follow, drift shift, look-behind,
//                 wall anti-clip, speed-dependent distance, road-height floor

import * as THREE from 'three';
import { lerp, lerpAngle, clamp } from './utils.js';

const _desiredPos = new THREE.Vector3();
const _desiredLook = new THREE.Vector3();
const _currentLook = new THREE.Vector3();
const _offset = new THREE.Vector3();
const _clipTest = new THREE.Vector3();

// Camera state
let driftShift = 0;
let lookBehind = false;
let _trackData = null;  // reference to track data for wall anti-clip + height floor

export const cameraState = {
  mode: 'chase',  // 'chase', 'orbit', 'flyover'
  orbitAngle: 0,
  orbitTarget: null,
};

/**
 * Provide track data reference so the camera can avoid clipping through walls
 * and stay above the road surface. Call once per race start.
 */
export function setCameraTrackData(td) {
  _trackData = td;
}

export function updateCamera(camera, kart, input, dt) {
  if (!kart) return;
  lookBehind = input.isDown('lookBehind');

  // Drift camera shift
  let targetShift = 0;
  if (kart.isDrifting) {
    targetShift = kart.driftDirection * -3;
  }
  driftShift = lerp(driftShift, targetShift, 1 - Math.pow(0.05, dt));

  // Speed-dependent FOV: wider at high speed / boost for dramatic "speed rush"
  // Base 65° → up to 75° at boost overspeed. Narrows slightly to 63° at standstill.
  const speedRatioFov = clamp(Math.abs(kart.speed) / (kart.topSpeed || 90), 0, 1.4);
  const targetFov = 63 + speedRatioFov * 8.5; // 63 → 71.5 at top speed, up to ~75 at 1.4× (boost)
  const newFov = lerp(camera.fov, targetFov, 1 - Math.pow(0.1, dt));
  // Only rebuild the projection matrix when FOV changes by more than 0.05°
  // — avoids a full matrix recompute (~30 multiplies) on frames with negligible change
  if (Math.abs(newFov - camera.fov) > 0.05) {
    camera.fov = newFov;
    camera.updateProjectionMatrix();
  }

  if (cameraState.mode === 'chase') {
    updateChaseCamera(camera, kart, dt);
  } else if (cameraState.mode === 'orbit') {
    updateOrbitCamera(camera, kart, dt);
  }
}

function updateChaseCamera(camera, kart, dt) {
  const heading = kart.rotation;
  const sinH = Math.sin(heading);
  const cosH = Math.cos(heading);

  // Speed-dependent chase distance: closer at low speed for a tighter view,
  // further at high speed for a sense of speed.
  // Range: 13 (stationary) → 18 (full speed) → 20 (boost overspeed)
  const speedRatio = clamp(Math.abs(kart.speed) / (kart.topSpeed || 90), 0, 1.3);
  const baseDist = lookBehind ? 12 : lerp(13, 18, speedRatio);
  const baseHeight = lookBehind ? 6 : lerp(7, 8.5, speedRatio);

  if (lookBehind) {
    _offset.set(0, baseHeight, baseDist);
  } else {
    _offset.set(driftShift, baseHeight, -baseDist);
  }

  // Rotate offset by kart heading
  const rx = _offset.x * cosH + _offset.z * sinH;
  const rz = -_offset.x * sinH + _offset.z * cosH;

  _desiredPos.set(
    kart.position.x + rx,
    kart.position.y + _offset.y,
    kart.position.z + rz
  );

  // --- Camera height floor: keep camera above the road surface ---
  // Use the player kart's cached nearest spline point if available, or fall back
  // to the kart's Y. This prevents the camera from dipping below the road on
  // elevation changes (e.g., Volcano Peak's switchbacks and downhill plunge).
  if (_trackData && kart._cachedNearest) {
    const roadY = kart._cachedNearest.point.y;
    const minCamY = roadY + 3; // at least 3 units above the road surface
    if (_desiredPos.y < minCamY) {
      _desiredPos.y = minCamY;
    }
  }

  // --- Wall anti-clip: pull camera closer if walls block the view ---
  // Cast a line from the kart to the desired camera position and check against
  // nearby wall segments. If any wall intersection is found, clamp camera to just
  // in front of the intersection point.
  if (_trackData && _trackData.collisionWalls && !lookBehind) {
    const clipped = clipCameraToWalls(
      kart.position.x, kart.position.z, kart.position.y,
      _desiredPos.x, _desiredPos.z, _desiredPos.y
    );
    if (clipped < 1.0) {
      // Pull camera to clipped fraction (with a small margin so we don't sit on the wall)
      const margin = Math.max(0.05, clipped - 0.05);
      _desiredPos.x = kart.position.x + (rx) * margin;
      _desiredPos.z = kart.position.z + (rz) * margin;
      // Keep the Y proportionally but ensure minimum height
      _desiredPos.y = kart.position.y + _offset.y * margin;
      if (_trackData && kart._cachedNearest) {
        const minY = kart._cachedNearest.point.y + 3;
        if (_desiredPos.y < minY) _desiredPos.y = minY;
      }
    }
  }

  // Look at target
  if (lookBehind) {
    _desiredLook.copy(kart.position);
    _desiredLook.y += 2;
  } else {
    // Look ahead of kart
    _desiredLook.set(
      kart.position.x + sinH * 10,
      kart.position.y + 2,
      kart.position.z + cosH * 10
    );
  }

  // Smooth follow
  const posFactor = lookBehind ? 0.2 : 0.08;
  const lookFactor = lookBehind ? 0.2 : 0.12;

  const pLerp = 1 - Math.pow(1 - posFactor, dt * 60);
  const lLerp = 1 - Math.pow(1 - lookFactor, dt * 60);

  camera.position.lerp(_desiredPos, pLerp);
  _currentLook.lerp(_desiredLook, lLerp);
  camera.lookAt(_currentLook);
}

/**
 * Check if the line from kart → desired camera position intersects any nearby walls.
 * Returns the fraction (0–1) along the line of the nearest intersection, or 1.0 if clear.
 * Uses the kart's cached sector for efficiency.
 */
function clipCameraToWalls(kx, kz, ky, cx, cz, cy) {
  if (!_trackData || !_trackData.sectors) return 1.0;

  const walls = _trackData.collisionWalls;
  const sectors = _trackData.sectors;

  // Determine sector from player kart's cached nearest point
  // (we use the player kart's position directly via a quick approach)
  // Check all walls in a ±3 sector range for safety
  let sectorIdx = 0;
  if (_trackData._lastPlayerSector !== undefined) {
    sectorIdx = _trackData._lastPlayerSector;
  }

  let bestT = 1.0;
  const camDx = cx - kx;
  const camDz = cz - kz;
  const camLenSq = camDx * camDx + camDz * camDz;
  if (camLenSq < 0.01) return 1.0;

  for (let s = sectorIdx - 3; s <= sectorIdx + 3; s++) {
    const idx = ((s % sectors.length) + sectors.length) % sectors.length;
    const sector = sectors[idx];
    for (const wallIdx of sector.wallIndices) {
      const wall = walls[wallIdx];
      if (!wall) continue;

      // Y-level filter: skip walls on different elevation
      if (ky < wall.y - 3 || ky > wall.y + wall.height + 3) continue;

      // Ray-segment intersection in 2D (XZ plane)
      const t = raySegmentIntersect(kx, kz, camDx, camDz,
        wall.p1.x, wall.p1.z, wall.p2.x, wall.p2.z);
      if (t !== null && t < bestT) {
        bestT = t;
      }
    }
  }

  return bestT;
}

/**
 * 2D ray–line-segment intersection.
 * Ray: origin (ox,oz) + t*(dx,dz), t in [0,1]
 * Segment: (ax,az) → (bx,bz)
 * Returns t of intersection, or null if none.
 */
function raySegmentIntersect(ox, oz, dx, dz, ax, az, bx, bz) {
  const sx = bx - ax;
  const sz = bz - az;
  const denom = dx * sz - dz * sx;
  if (Math.abs(denom) < 1e-8) return null; // parallel

  const t = ((ax - ox) * sz - (az - oz) * sx) / denom;
  const u = ((ax - ox) * dz - (az - oz) * dx) / denom;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return t;
  return null;
}

function updateOrbitCamera(camera, kart, dt) {
  cameraState.orbitAngle += dt * (Math.PI * 2 / 3); // one revolution per 3s
  const target = cameraState.orbitTarget || kart.position;

  camera.position.set(
    target.x + Math.cos(cameraState.orbitAngle) * 15,
    target.y + 8,
    target.z + Math.sin(cameraState.orbitAngle) * 15
  );
  camera.lookAt(target.x, target.y + 2, target.z);
}

export function resetCamera(camera, kart) {
  const heading = kart.rotation;
  const sinH = Math.sin(heading);
  const cosH = Math.cos(heading);

  // Use the same base distance as chase at zero speed
  const dist = 13;
  const rx = 0 * cosH + (-dist) * sinH;
  const rz = -0 * sinH + (-dist) * cosH;

  camera.position.set(
    kart.position.x + rx,
    kart.position.y + 7,
    kart.position.z + rz
  );

  _currentLook.set(
    kart.position.x + sinH * 10,
    kart.position.y + 2,
    kart.position.z + cosH * 10
  );
  camera.lookAt(_currentLook);
  driftShift = 0;
  cameraState.mode = 'chase';
}
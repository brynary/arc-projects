// js/camera.js — Chase camera with smooth follow, drift shift, look-behind,
//                 wall anti-clip, speed-dependent distance, road-height floor,
//                 spline-aware look-ahead, camera shake, countdown flyover

import * as THREE from 'three';
import { lerp, lerpAngle, clamp } from './utils.js';
import { findNearestSplinePoint } from './track.js';

const _desiredPos = new THREE.Vector3();
const _desiredLook = new THREE.Vector3();
const _currentLook = new THREE.Vector3();
const _offset = new THREE.Vector3();
const _clipTest = new THREE.Vector3();
const _splineAhead = new THREE.Vector3(); // reusable for spline look-ahead

// Camera state
let driftShift = 0;
let lookBehind = false;
let _trackData = null;  // reference to track data for wall anti-clip + height floor

// Camera shake state
let _shakeIntensity = 0;   // current shake strength (decays)
let _shakeDecay = 12;      // decay rate per second
const _shakeOffset = new THREE.Vector3();

// Flyover state
let _flyoverProgress = 0;  // 0→1 over flyover duration
let _flyoverDuration = 3;  // seconds
let _flyoverStartT = 0;    // spline t at the player's start position (computed once)

export const cameraState = {
  mode: 'chase',  // 'chase', 'orbit', 'flyover'
  orbitAngle: 0,
  orbitTarget: null,
};

/**
 * Trigger camera shake (e.g., on wall hit or item hit).
 * Intensity 0.0–1.0: wall hits ~0.3, item hits ~0.6
 */
export function triggerCameraShake(intensity) {
  _shakeIntensity = Math.max(_shakeIntensity, clamp(intensity, 0, 1));
}

/**
 * Provide track data reference so the camera can avoid clipping through walls
 * and stay above the road surface. Call once per race start.
 */
export function setCameraTrackData(td) {
  _trackData = td;
}

/**
 * Start the countdown flyover camera sweep.
 * Computes the player's start position on the spline once upfront.
 */
export function startFlyover(kart) {
  cameraState.mode = 'flyover';
  _flyoverProgress = 0;
  // Compute spline t at the player's start position
  if (_trackData && _trackData.centerCurve && kart) {
    const nearest = findNearestSplinePoint(
      _trackData.centerCurve, kart.position.x, kart.position.z, 100, kart.position.y
    );
    _flyoverStartT = nearest ? nearest.t : 0;
  } else {
    _flyoverStartT = 0;
  }
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

  // Camera shake: apply random offset that decays over time
  if (_shakeIntensity > 0.001) {
    const mag = _shakeIntensity * 0.6; // max displacement ~0.6 units
    _shakeOffset.set(
      (Math.random() - 0.5) * 2 * mag,
      (Math.random() - 0.5) * 2 * mag * 0.6, // less vertical
      (Math.random() - 0.5) * 2 * mag
    );
    _shakeIntensity *= Math.pow(0.001, dt / (1 / _shakeDecay)); // exponential decay
  } else {
    _shakeOffset.set(0, 0, 0);
    _shakeIntensity = 0;
  }

  if (cameraState.mode === 'flyover') {
    updateFlyoverCamera(camera, kart, dt);
  } else if (cameraState.mode === 'chase') {
    updateChaseCamera(camera, kart, dt);
  } else if (cameraState.mode === 'orbit') {
    updateOrbitCamera(camera, kart, dt);
  }

  // Apply shake offset after all camera modes
  if (_shakeIntensity > 0) {
    camera.position.add(_shakeOffset);
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

  // Look at target — spline-aware look-ahead for better corner anticipation
  if (lookBehind) {
    _desiredLook.copy(kart.position);
    _desiredLook.y += 2;
  } else {
    // Base look-ahead: 10 units forward along kart heading
    const baseAheadX = kart.position.x + sinH * 10;
    const baseAheadZ = kart.position.z + cosH * 10;

    // Spline-aware: sample a point ahead on the track spline to anticipate corners.
    // At higher speeds, blend more toward the spline direction so the camera
    // "looks into" upcoming corners instead of following the kart's heading alone.
    if (_trackData && _trackData.centerCurve && kart._cachedNearest) {
      const splineBlend = clamp(speedRatio * 0.45, 0, 0.4); // 0–40% blend toward spline
      const lookAheadT = (kart._cachedNearest.t + 0.04) % 1; // ~4% ahead on spline
      _trackData.centerCurve.getPointAt(lookAheadT, _splineAhead);
      _desiredLook.set(
        lerp(baseAheadX, _splineAhead.x, splineBlend),
        kart.position.y + 2,
        lerp(baseAheadZ, _splineAhead.z, splineBlend)
      );
    } else {
      _desiredLook.set(baseAheadX, kart.position.y + 2, baseAheadZ);
    }
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

/**
 * Countdown flyover: sweep the camera along the track at height, then
 * transition to behind-player chase position.
 * Per spec: "camera does a 3s sweeping aerial flyover of the track"
 */
function updateFlyoverCamera(camera, kart, dt) {
  if (!_trackData || !_trackData.centerCurve) {
    // Fallback: just do chase
    cameraState.mode = 'chase';
    updateChaseCamera(camera, kart, dt);
    return;
  }

  _flyoverProgress += dt / _flyoverDuration;

  if (_flyoverProgress >= 1.0) {
    // Flyover done — transition to chase behind player
    cameraState.mode = 'chase';
    resetCamera(camera, kart);
    return;
  }

  const curve = _trackData.centerCurve;
  // Start from ~10% before the player's start position, sweep ~35% of the track
  const startT = _flyoverStartT;
  const sweepRange = 0.35; // fraction of track to cover
  const eased = easeInOutSine(_flyoverProgress);

  // Camera follows the spline at height
  const camT = (startT - 0.1 + eased * sweepRange + 1) % 1;
  const lookT = (camT + 0.05) % 1; // look slightly ahead

  const camPt = curve.getPointAt(camT);
  const lookPt = curve.getPointAt(lookT);

  // Fly at altitude 30-40 units above the road, slightly offset to the side
  const flyHeight = 35 + Math.sin(eased * Math.PI) * 10; // peaks at midpoint
  const sideOffset = Math.cos(eased * Math.PI * 2) * 15; // gentle side sway

  // Get tangent for lateral offset direction
  const tangent = curve.getTangentAt(camT).normalize();
  const sideX = -tangent.z; // perpendicular in XZ plane
  const sideZ = tangent.x;

  _desiredPos.set(
    camPt.x + sideX * sideOffset,
    camPt.y + flyHeight,
    camPt.z + sideZ * sideOffset
  );
  _desiredLook.set(lookPt.x, lookPt.y + 2, lookPt.z);

  // Smooth but faster lerp for flyover (don't need as much smoothing)
  const flyLerp = 1 - Math.pow(0.02, dt);
  camera.position.lerp(_desiredPos, flyLerp);
  _currentLook.lerp(_desiredLook, flyLerp);
  camera.lookAt(_currentLook);
}

/** Sine ease-in-out for smooth flyover movement */
function easeInOutSine(t) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
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
  _shakeIntensity = 0;
  _shakeOffset.set(0, 0, 0);
  cameraState.mode = 'chase';
}
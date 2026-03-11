// js/physics.js — Arcade physics: wall/kart collision, off-road detection

import * as THREE from 'three';
import { clamp } from './utils.js';
import { findNearestSplinePoint } from './track.js';

const _pushVec = new THREE.Vector3();

/**
 * Run physics for all karts against track data.
 */
export function updatePhysics(karts, trackData, dt) {
  for (const kart of karts) {
    if (kart.frozenTimer > 0) continue;

    // Compute nearest spline point ONCE per kart per frame
    // Pass kartY to prevent snapping to wrong level on multi-level tracks
    if (trackData && trackData.centerCurve) {
      kart._cachedNearest = findNearestSplinePoint(
        trackData.centerCurve, kart.position.x, kart.position.z, 50, kart.position.y
      );
    }

    // Ground detection & surface type
    updateGroundDetection(kart, trackData);

    // Wall collisions (accumulated to prevent jitter in corners)
    checkWallCollisionsAccumulated(kart, trackData);
  }

  // Kart-to-kart collisions (with Y-level filtering)
  for (let i = 0; i < karts.length; i++) {
    for (let j = i + 1; j < karts.length; j++) {
      if (karts[i].frozenTimer > 0 || karts[j].frozenTimer > 0) continue;
      if (karts[i].finished || karts[j].finished) continue;
      checkKartCollision(karts[i], karts[j]);
    }
  }
}

function updateGroundDetection(kart, trackData) {
  if (!trackData || !trackData.centerCurve) return;

  const nearest = kart._cachedNearest;
  if (!nearest) return;

  // Check if on road using cached nearest point and width
  const idx = nearest.t * (trackData.samples.length - 1);
  const i0 = Math.floor(idx);
  const i1 = Math.min(i0 + 1, trackData.samples.length - 1);
  const frac = idx - i0;
  const width = trackData.samples[i0].width * (1 - frac) + trackData.samples[i1].width * frac;
  const onRoad = nearest.distance < width / 2;

  kart.surfaceType = onRoad ? 'road' : 'offroad';

  // Get road Y height from cached point
  const roadY = nearest.point.y;

  // Ground snapping
  if (kart.position.y <= roadY + 0.5 && kart.verticalVelocity <= 0) {
    kart.position.y = roadY + 0.5;
    kart.verticalVelocity = 0;
    kart.onGround = true;
  } else if (kart.position.y > roadY + 2) {
    kart.onGround = false;
  }
}

/**
 * Accumulated wall collision: gather all penetrating walls first, then resolve
 * as a combined push. This prevents jitter when a kart sits in a corner where
 * two walls meet — sequential resolve would push out of wall A into wall B
 * and vice versa, causing oscillation.
 */
function checkWallCollisionsAccumulated(kart, trackData) {
  if (!trackData || !trackData.collisionWalls) return;

  const kartX = kart.position.x;
  const kartZ = kart.position.z;
  const kartY = kart.position.y;
  const kartRadius = 2.5;

  // Use cached nearest spline point for sector lookup
  const nearest = kart._cachedNearest;
  if (!nearest) return;
  const sectorIdx = Math.floor(nearest.t * trackData.sectors.length);

  // Check current sector ± 2 (wider to catch walls at sector boundaries)
  const sectorsToCheck = [];
  for (let s = sectorIdx - 2; s <= sectorIdx + 2; s++) {
    const idx = ((s % trackData.sectors.length) + trackData.sectors.length) % trackData.sectors.length;
    sectorsToCheck.push(trackData.sectors[idx]);
  }

  // Phase 1: Collect all collisions
  let pushNx = 0, pushNz = 0;
  let maxOverlap = 0;
  let hitCount = 0;
  let worstWall = null;
  let worstCollision = null;

  for (const sector of sectorsToCheck) {
    for (const wallIdx of sector.wallIndices) {
      const wall = trackData.collisionWalls[wallIdx];
      if (!wall) continue;

      // Y-level filter: skip walls whose vertical extent doesn't overlap with kart
      // Wall spans from wall.y to wall.y + wall.height; kart is at kartY ± ~2
      const wallBottom = wall.y - 0.5;
      const wallTop = wall.y + wall.height + 0.5;
      if (kartY < wallBottom - 2 || kartY > wallTop + 2) continue;

      const collision = checkCircleLineSegment(
        kartX, kartZ, kartRadius,
        wall.p1.x, wall.p1.z, wall.p2.x, wall.p2.z
      );

      if (collision) {
        // Accumulate push direction (weighted by overlap)
        pushNx += collision.nx * collision.overlap;
        pushNz += collision.nz * collision.overlap;
        hitCount++;

        // Track the worst (deepest) collision for heading response
        if (collision.overlap > maxOverlap) {
          maxOverlap = collision.overlap;
          worstWall = wall;
          worstCollision = collision;
        }
      }
    }
  }

  // Phase 2: Apply combined push
  if (hitCount > 0) {
    // Normalize the accumulated push direction
    const pushLen = Math.sqrt(pushNx * pushNx + pushNz * pushNz);
    if (pushLen > 0.001) {
      const nx = pushNx / pushLen;
      const nz = pushNz / pushLen;
      // Push distance is the maximum overlap (not sum, to avoid over-push)
      kart.position.x += nx * maxOverlap * 1.1;
      kart.position.z += nz * maxOverlap * 1.1;
    }

    // Apply heading response based on worst collision only
    if (worstCollision) {
      resolveWallHeading(kart, worstCollision);
    }
  }
}

function checkCircleLineSegment(cx, cz, r, x1, z1, x2, z2) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 0.01) return null;

  // Project circle center onto line
  let t = ((cx - x1) * dx + (cz - z1) * dz) / lenSq;
  t = clamp(t, 0, 1);

  const closestX = x1 + t * dx;
  const closestZ = z1 + t * dz;

  const distX = cx - closestX;
  const distZ = cz - closestZ;
  const distSq = distX * distX + distZ * distZ;

  if (distSq < r * r) {
    const dist = Math.sqrt(distSq);
    const overlap = r - dist;
    const nx = dist > 0 ? distX / dist : 0;
    const nz = dist > 0 ? distZ / dist : 1;
    return { overlap, nx, nz, dist };
  }

  return null;
}

/**
 * Apply heading correction and speed penalty from a wall hit.
 * Position push is already handled by the accumulated resolver.
 */
function resolveWallHeading(kart, collision) {

  // Compute collision angle
  const heading = kart.rotation;
  const headingX = Math.sin(heading);
  const headingZ = Math.cos(heading);

  const dot = headingX * collision.nx + headingZ * collision.nz;
  const angle = Math.acos(clamp(Math.abs(dot), 0, 1));

  // Wall tangent direction (along the wall surface)
  const tangentX = -collision.nz;
  const tangentZ = collision.nx;
  const tangentDot = headingX * tangentX + headingZ * tangentZ;

  if (angle < Math.PI / 6) {
    // Glancing hit: smoothly deflect along wall, 15% speed loss
    kart.speed *= 0.85;
    // Blend toward wall-tangent heading rather than snapping
    const deflectedHeading = Math.atan2(
      tangentX * Math.sign(tangentDot),
      tangentZ * Math.sign(tangentDot)
    );
    // Smooth blend: 70% toward deflected heading (feels natural, no jarring snap)
    let diff = deflectedHeading - kart.rotation;
    diff = ((diff + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (diff < -Math.PI) diff += Math.PI * 2;
    kart.rotation += diff * 0.7;
  } else {
    // Hard hit: proportional speed loss based on angle severity, brief reduced control
    const severity = clamp((angle - Math.PI / 6) / (Math.PI / 3), 0, 1);
    const speedLoss = 0.75 - severity * 0.15;  // 25%-40% speed loss
    kart.speed *= speedLoss;
    kart.stunTimer = Math.max(kart.stunTimer, 0.2 + severity * 0.15);
    // Blend toward reflected heading
    const reflectX = headingX - 2 * dot * collision.nx;
    const reflectZ = headingZ - 2 * dot * collision.nz;
    const reflectedHeading = Math.atan2(reflectX, reflectZ);
    let diff = reflectedHeading - kart.rotation;
    diff = ((diff + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (diff < -Math.PI) diff += Math.PI * 2;
    kart.rotation += diff * 0.6;
  }
}

function checkKartCollision(kartA, kartB) {
  const dx = kartB.position.x - kartA.position.x;
  const dz = kartB.position.z - kartA.position.z;
  const dy = kartB.position.y - kartA.position.y;

  // Y-level filter: karts on different elevation levels shouldn't collide.
  // This prevents false collisions on multi-level tracks like Volcano Peak
  // where karts on switchbacks above/below each other are close in XZ.
  if (Math.abs(dy) > 4) return;

  const distSqXZ = dx * dx + dz * dz;
  const minDist = 5; // kart collision radius sum

  if (distSqXZ < minDist * minDist && distSqXZ > 0.01) {
    const dist = Math.sqrt(distSqXZ);
    const overlap = minDist - dist;
    const nx = dx / dist;
    const nz = dz / dist;

    // Separate karts
    const totalWeight = kartA.weight + kartB.weight;
    const pushA = kartB.weight / totalWeight;
    const pushB = kartA.weight / totalWeight;

    // Tusk's immovable trait
    let modA = pushA;
    let modB = pushB;
    if (kartA.characterId === 'tusk') modA *= 0.5;
    if (kartB.characterId === 'tusk') modB *= 0.5;

    kartA.position.x -= nx * overlap * modA;
    kartA.position.z -= nz * overlap * modA;
    kartB.position.x += nx * overlap * modB;
    kartB.position.z += nz * overlap * modB;

    // Speed loss based on collision angle
    const headingAx = Math.sin(kartA.rotation);
    const headingAz = Math.cos(kartA.rotation);
    const dot = headingAx * nx + headingAz * nz;
    const speedLoss = Math.abs(dot) < 0.5 ? 0.05 : 0.2;

    kartA.speed *= (1 - speedLoss * modA);
    kartB.speed *= (1 - speedLoss * modB);
  }
}
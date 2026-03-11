// js/race.js — Race state: checkpoints, laps, positions, finish logic, countdown

import * as THREE from 'three';
import { findNearestSplinePoint } from './track.js';

const TOTAL_LAPS = 3;
const COUNTDOWN_DURATION = 6; // 3s flyover + 3s countdown (3, 2, 1, GO)

export const raceState = {
  status: 'pre',       // 'pre', 'countdown', 'racing', 'finished'
  countdownTimer: 0,
  raceTime: 0,
  finishedKarts: [],
  allFinished: false,
  countdownNumber: 0,   // 3, 2, 1, 0 (GO)
  startBoostWindow: false,
};

/**
 * Initialize race state for all karts.
 */
export function initRace(allKarts, trackData) {
  raceState.status = 'countdown';
  raceState.countdownTimer = COUNTDOWN_DURATION;
  raceState.raceTime = 0;
  raceState.finishedKarts = [];
  raceState.allFinished = false;
  raceState.countdownNumber = -1;
  raceState.startBoostWindow = false;

  for (const kart of allKarts) {
    kart.currentLap = 0;
    kart.lastCheckpoint = -1;
    kart.checkpointFraction = 0;
    kart.raceProgress = 0;
    kart.racePosition = kart.racerIndex + 1;
    kart.lapTimes = [];
    kart.finishTime = null;
    kart.finished = false;
    kart.raceStartTime = 0;
    kart.speed = 0;
    kart.heldItem = null;
    kart.boostActive = false;
    kart.stunTimer = 0;
    kart.invincibleTimer = 0;
    kart.frozenTimer = 0;
  }
}

/**
 * Update race logic each frame.
 * Returns events: { countdownTick, raceStarted, lapCompleted, raceFinished }
 */
export function updateRace(allKarts, trackData, dt) {
  const events = {
    countdownTick: 0,
    raceStarted: false,
    lapCompleted: null,  // { kart, lap }
    raceFinished: null,  // kart that finished
  };

  if (raceState.status === 'countdown') {
    raceState.countdownTimer -= dt;

    // Countdown phase (last 3 seconds)
    const timeLeft = raceState.countdownTimer;
    let newNumber = -1;
    if (timeLeft <= 3 && timeLeft > 2) newNumber = 3;
    else if (timeLeft <= 2 && timeLeft > 1) newNumber = 2;
    else if (timeLeft <= 1 && timeLeft > 0) newNumber = 1;
    else if (timeLeft <= 0) newNumber = 0;

    if (newNumber !== raceState.countdownNumber && newNumber >= 0) {
      raceState.countdownNumber = newNumber;
      events.countdownTick = newNumber;
    }

    // All karts frozen during countdown
    for (const kart of allKarts) {
      kart.speed = 0;
      kart.frozenTimer = 0.1;
    }

    if (raceState.countdownTimer <= 0) {
      raceState.status = 'racing';
      raceState.raceTime = 0;
      raceState.startBoostWindow = true;
      events.raceStarted = true;

      // Unfreeze all karts
      for (const kart of allKarts) {
        kart.frozenTimer = 0;
        kart.raceStartTime = 0;
      }

      // Start boost window closes after 0.3s (handled externally)
      setTimeout(() => { raceState.startBoostWindow = false; }, 300);
    }

    return events;
  }

  if (raceState.status === 'racing') {
    raceState.raceTime += dt;

    // Update checkpoints and laps for all karts
    for (const kart of allKarts) {
      if (kart.finished) continue;

      const cpEvent = updateCheckpoints(kart, trackData);
      if (cpEvent === 'lap') {
        events.lapCompleted = { kart, lap: kart.currentLap };

        // Check for race finish (3 laps)
        if (kart.currentLap >= TOTAL_LAPS) {
          kart.finished = true;
          kart.finishTime = raceState.raceTime;
          raceState.finishedKarts.push(kart);
          events.raceFinished = kart;
        }
      }
    }

    // Update race positions
    updatePositions(allKarts, trackData);
  }

  return events;
}

/**
 * Update checkpoint tracking for a single kart.
 * Returns 'lap' if a new lap was completed, null otherwise.
 */
function updateCheckpoints(kart, trackData) {
  if (!trackData || !trackData.checkpoints || trackData.checkpoints.length === 0) return null;

  const checkpoints = trackData.checkpoints;
  const numCheckpoints = checkpoints.length;
  const nextCP = (kart.lastCheckpoint + 1) % numCheckpoints;
  const cp = checkpoints[nextCP];

  if (!cp || !cp.position) return null;

  const dx = kart.position.x - cp.position.x;
  const dz = kart.position.z - cp.position.z;
  const dist = Math.sqrt(dx * dx + dz * dz);

  const checkWidth = cp.width || 28;
  if (dist < checkWidth * 0.6) {
    const forward = cp.forward || { x: 0, z: 1 };

    // Position-based gate: kart must be within the checkpoint's width band
    const posDot = dx * forward.x + dz * forward.z;
    if (Math.abs(posDot) > 15) return null;

    // Direction validation: kart's travel direction must roughly agree with
    // checkpoint's forward vector (dot > 0 means same general direction).
    // This prevents triggering checkpoints while driving in reverse.
    const kartDirX = Math.sin(kart.rotation);
    const kartDirZ = Math.cos(kart.rotation);
    const dirDot = kartDirX * forward.x + kartDirZ * forward.z;

    // Allow a wide cone: dirDot > -0.2 (roughly ±100° from forward)
    // Negative speed inverts the effective direction
    const effectiveDirDot = kart.speed >= 0 ? dirDot : -dirDot;
    if (effectiveDirDot < -0.2) return null;

    kart.lastCheckpoint = nextCP;
    kart.lastCheckpointPos.set(cp.position.x, cp.position.y || 0, cp.position.z);
    if (cp.forward) {
      kart.lastCheckpointRot = Math.atan2(cp.forward.x, cp.forward.z);
    }

    // Lap completion
    if (nextCP === 0 && kart.currentLap >= 0) {
      const lapTime = raceState.raceTime - (kart.lapTimes.length > 0 ?
        kart.lapTimes.reduce((a, b) => a + b, 0) : 0);
      kart.lapTimes.push(lapTime);
      kart.currentLap++;
      return 'lap';
    }
  }

  return null;
}

/**
 * Compute race progress and assign positions 1-8.
 */
function updatePositions(allKarts, trackData) {
  if (!trackData || !trackData.checkpoints) return;

  const numCheckpoints = trackData.checkpoints.length;

  for (const kart of allKarts) {
    // Compute fraction to next checkpoint — reuse cached nearest from physics if available
    let fraction = 0;
    if (numCheckpoints > 0 && trackData.centerCurve) {
      if (kart._cachedNearest) {
        fraction = kart._cachedNearest.t;
      } else {
        const nearest = findNearestSplinePoint(trackData.centerCurve, kart.position.x, kart.position.z, 50, kart.position.y);
        fraction = nearest.t;
      }
    }
    kart.checkpointFraction = fraction;
    kart.raceProgress = (kart.currentLap * numCheckpoints) + kart.lastCheckpoint + 1 + fraction;
  }

  // Sort by progress descending (finished karts always first, by finish time)
  const sorted = [...allKarts].sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.raceProgress - a.raceProgress;
  });

  for (let i = 0; i < sorted.length; i++) {
    sorted[i].racePosition = i + 1;
  }
}

/**
 * Get formatted race time string.
 */
export function formatTime(seconds, decimals = 1) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (decimals === 3) {
    return `${mins}:${secs < 10 ? '0' : ''}${secs.toFixed(3)}`;
  }
  return `${mins}:${secs < 10 ? '0' : ''}${secs.toFixed(decimals)}`;
}

/**
 * Get race results (sorted standings).
 */
export function getRaceResults(allKarts) {
  return [...allKarts].sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.raceProgress - a.raceProgress;
  }).map((kart, i) => ({
    position: i + 1,
    characterId: kart.characterId,
    name: kart.character?.name || kart.characterId,
    finishTime: kart.finishTime,
    isPlayer: kart.isPlayer,
    lapTimes: kart.lapTimes,
  }));
}
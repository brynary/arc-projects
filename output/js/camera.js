/**
 * camera — smooth chase camera with drift offset and boost FOV effects.
 */
import * as THREE from 'three';
import { clamp, lerp } from './utils/mathUtils.js';

/**
 * Create a camera controller that smoothly follows a kart.
 *
 * @param {THREE.PerspectiveCamera} camera
 * @returns {object} controller with setTarget(), update(dt), and reset()
 */
export function createCameraController(camera) {
  const controller = {
    target: null,
    camera,

    /* ── Tuning ────────────────────────────────────────────────────── */
    offset: new THREE.Vector3(0, 4, -8),  // behind and above
    lookAheadDist: 5,
    smoothing: 0.08,                       // per-frame at 60 fps
    driftOffset: 0,                        // current lateral shift
    driftOffsetTarget: 0,
    driftLateralMax: 2.0,
    fovBase: 75,
    fovBoost: 85,
    fovCurrent: 75,

    /* ── Interpolated state ────────────────────────────────────────── */
    currentPos: new THREE.Vector3(),
    currentLookAt: new THREE.Vector3(),

    /* ── API ───────────────────────────────────────────────────────── */

    /**
     * Set the kart state object to follow.
     * @param {object} kartState
     */
    setTarget(kartState) {
      this.target = kartState;
    },

    /**
     * Update camera position and orientation.  Call once per frame.
     * @param {number} dt — frame delta in seconds
     */
    update(dt) {
      const t = this.target;
      if (!t) return;

      // Frame-rate-independent smoothing factor
      const factor = 1 - Math.pow(1 - this.smoothing, dt * 60);

      /* ── Drift lateral offset ──────────────────────────────────── */
      this.driftOffsetTarget = t.isDrifting
        ? t.driftDirection * this.driftLateralMax
        : 0;
      this.driftOffset = lerp(this.driftOffset, this.driftOffsetTarget, factor);

      /* ── Boost FOV ─────────────────────────────────────────────── */
      const targetFov = t.boostTimer > 0 ? this.fovBoost : this.fovBase;
      this.fovCurrent = lerp(this.fovCurrent, targetFov, factor);
      this.camera.fov = this.fovCurrent;
      this.camera.updateProjectionMatrix();

      /* ── Ideal position (behind kart, offset laterally for drift) */
      const h = t.heading;
      const sinH = Math.sin(h);
      const cosH = Math.cos(h);

      // "Behind" = negative forward direction
      // Forward: (sinH, cosH)
      // Left:    (-cosH, sinH)
      const behindDist = 8;
      const heightAbove = 4;

      const idealX = t.x - sinH * behindDist + (-cosH) * this.driftOffset;
      const idealY = t.y + heightAbove;
      const idealZ = t.z - cosH * behindDist + sinH * this.driftOffset;

      /* ── Ideal look-at (ahead of kart) ─────────────────────────── */
      const lookAtX = t.x + sinH * this.lookAheadDist;
      const lookAtY = t.y + 1;
      const lookAtZ = t.z + cosH * this.lookAheadDist;

      /* ── Smooth interpolation ──────────────────────────────────── */
      this.currentPos.x = lerp(this.currentPos.x, idealX, factor);
      this.currentPos.y = lerp(this.currentPos.y, idealY, factor);
      this.currentPos.z = lerp(this.currentPos.z, idealZ, factor);

      this.currentLookAt.x = lerp(this.currentLookAt.x, lookAtX, factor);
      this.currentLookAt.y = lerp(this.currentLookAt.y, lookAtY, factor);
      this.currentLookAt.z = lerp(this.currentLookAt.z, lookAtZ, factor);

      /* ── Apply to camera ───────────────────────────────────────── */
      this.camera.position.copy(this.currentPos);
      this.camera.lookAt(this.currentLookAt);
    },

    /**
     * Snap camera to ideal position immediately (no interpolation).
     * Useful after teleport / respawn / scene transitions.
     */
    reset() {
      const t = this.target;
      if (!t) return;

      this.driftOffset = 0;
      this.driftOffsetTarget = 0;
      this.fovCurrent = this.fovBase;
      this.camera.fov = this.fovBase;
      this.camera.updateProjectionMatrix();

      const h = t.heading;
      const sinH = Math.sin(h);
      const cosH = Math.cos(h);

      this.currentPos.set(
        t.x - sinH * 8,
        t.y + 4,
        t.z - cosH * 8,
      );
      this.currentLookAt.set(
        t.x + sinH * this.lookAheadDist,
        t.y + 1,
        t.z + cosH * this.lookAheadDist,
      );

      this.camera.position.copy(this.currentPos);
      this.camera.lookAt(this.currentLookAt);
    },
  };

  return controller;
}

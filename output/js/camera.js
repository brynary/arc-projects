// Chase camera with spring-damper follow
import * as THREE from 'three';
import { lerp, clamp } from './utils.js';

const DEFAULT_DISTANCE = 10;
const DEFAULT_HEIGHT = 4.5;
const LOOK_HEIGHT = 1.5;
const STIFFNESS = 6;
const DAMPING = 4;
const DRIFT_LATERAL_OFFSET = 2.5;
const DRIFT_SWING_SPEED = 3;
const BOOST_FOV = 82;
const NORMAL_FOV = 75;
const FOV_LERP_SPEED = 4;

export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.targetPosition = new THREE.Vector3();
    this.currentPosition = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.lateralOffset = 0;
    this.currentFOV = NORMAL_FOV;
    this.shakeTimer = 0;
    this.shakeIntensity = 0;
    this.lookBehind = false;
  }

  // Initialize camera position instantly (no spring)
  init(kart) {
    const forward = new THREE.Vector3(
      -Math.sin(kart.rotationY),
      0,
      -Math.cos(kart.rotationY)
    );
    const targetPos = kart.position.clone()
      .addScaledVector(forward, DEFAULT_DISTANCE)
      .add(new THREE.Vector3(0, DEFAULT_HEIGHT, 0));

    this.currentPosition.copy(targetPos);
    this.camera.position.copy(targetPos);

    const lookAt = kart.position.clone().add(new THREE.Vector3(0, LOOK_HEIGHT, 0));
    this.camera.lookAt(lookAt);
    this.velocity.set(0, 0, 0);
  }

  // Update camera each render frame
  update(kart, dt, alpha = 1) {
    if (dt <= 0) return;

    // Interpolated kart state
    const kartPos = kart.position.clone();
    const kartRot = kart.rotationY;

    const forward = new THREE.Vector3(
      -Math.sin(kartRot),
      0,
      -Math.cos(kartRot)
    );
    const right = new THREE.Vector3(-forward.z, 0, forward.x);

    // Drift lateral swing
    let targetLateral = 0;
    if (kart.isDrifting) {
      targetLateral = -kart.driftDirection * DRIFT_LATERAL_OFFSET;
    }
    this.lateralOffset = lerp(this.lateralOffset, targetLateral, DRIFT_SWING_SPEED * dt);

    // Look behind
    const dirMult = this.lookBehind ? -1 : 1;

    // Desired camera position
    const desired = kartPos.clone()
      .addScaledVector(forward, DEFAULT_DISTANCE * dirMult)
      .addScaledVector(right, this.lateralOffset)
      .add(new THREE.Vector3(0, DEFAULT_HEIGHT, 0));

    // Spring-damper
    const dx = desired.x - this.currentPosition.x;
    const dy = desired.y - this.currentPosition.y;
    const dz = desired.z - this.currentPosition.z;

    const springForceX = dx * STIFFNESS - this.velocity.x * DAMPING;
    const springForceY = dy * STIFFNESS - this.velocity.y * DAMPING;
    const springForceZ = dz * STIFFNESS - this.velocity.z * DAMPING;

    this.velocity.x += springForceX * dt;
    this.velocity.y += springForceY * dt;
    this.velocity.z += springForceZ * dt;

    this.currentPosition.x += this.velocity.x * dt;
    this.currentPosition.y += this.velocity.y * dt;
    this.currentPosition.z += this.velocity.z * dt;

    // Camera shake
    let shakeOffset = new THREE.Vector3();
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const intensity = this.shakeIntensity * (this.shakeTimer / 0.5);
      shakeOffset.set(
        (Math.random() - 0.5) * 2 * intensity,
        (Math.random() - 0.5) * 2 * intensity,
        (Math.random() - 0.5) * 2 * intensity
      );
    }

    this.camera.position.copy(this.currentPosition).add(shakeOffset);

    // Look at kart
    const lookAt = kartPos.clone().add(new THREE.Vector3(0, LOOK_HEIGHT, 0));
    this.camera.lookAt(lookAt);

    // FOV (boost = wider)
    const targetFOV = kart.boostTimer > 0 ? BOOST_FOV : NORMAL_FOV;
    this.currentFOV = lerp(this.currentFOV, targetFOV, FOV_LERP_SPEED * dt);
    this.camera.fov = this.currentFOV;
    this.camera.updateProjectionMatrix();
  }

  // Trigger camera shake (e.g., on item hit)
  shake(intensity = 0.3, duration = 0.5) {
    this.shakeIntensity = intensity;
    this.shakeTimer = duration;
  }
}

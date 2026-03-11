// js/camera.js — Chase camera with smooth follow, drift shift, look-behind

import * as THREE from 'three';
import { lerp, lerpAngle } from './utils.js';

const _desiredPos = new THREE.Vector3();
const _desiredLook = new THREE.Vector3();
const _currentLook = new THREE.Vector3();
const _offset = new THREE.Vector3();

// Camera state
let driftShift = 0;
let lookBehind = false;

export const cameraState = {
  mode: 'chase',  // 'chase', 'orbit', 'flyover'
  orbitAngle: 0,
  orbitTarget: null,
};

export function updateCamera(camera, kart, input, dt) {
  lookBehind = input.isDown('lookBehind');

  // Drift camera shift
  let targetShift = 0;
  if (kart.isDrifting) {
    targetShift = kart.driftDirection * -3;
  }
  driftShift = lerp(driftShift, targetShift, 1 - Math.pow(0.05, dt));

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

  if (lookBehind) {
    // Look behind: camera in front of kart looking back
    _offset.set(0, 6, 12);
  } else {
    // Normal chase: behind and above
    _offset.set(driftShift, 8, -18);
  }

  // Rotate offset by kart heading
  const rx = _offset.x * cosH + _offset.z * sinH;
  const rz = -_offset.x * sinH + _offset.z * cosH;

  _desiredPos.set(
    kart.position.x + rx,
    kart.position.y + _offset.y,
    kart.position.z + rz
  );

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

  const rx = 0 * cosH + (-18) * sinH;
  const rz = -0 * sinH + (-18) * cosH;

  camera.position.set(
    kart.position.x + rx,
    kart.position.y + 8,
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

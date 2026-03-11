// js/scene.js — Three.js scene, camera, WebGL renderer, lighting

import * as THREE from 'three';

const canvas = document.getElementById('game-canvas');

export const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap;

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

export const camera = new THREE.PerspectiveCamera(
  65,
  window.innerWidth / window.innerHeight,
  0.5,
  800
);
camera.position.set(0, 20, 30);
camera.lookAt(0, 0, 0);

export const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

export const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(50, 80, 30);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.set(1024, 1024);
directionalLight.shadow.camera.near = 1;
directionalLight.shadow.camera.far = 200;
directionalLight.shadow.camera.left = -60;
directionalLight.shadow.camera.right = 60;
directionalLight.shadow.camera.top = 60;
directionalLight.shadow.camera.bottom = -60;
scene.add(directionalLight);

export function setFog(color, near, far) {
  scene.fog = new THREE.Fog(color, near, far);
  scene.background = new THREE.Color(color);
}

export function setSunDirection(x, y, z) {
  directionalLight.position.set(x * 80, y * 80, z * 80);
}

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});

// Spline utilities wrapping THREE.CatmullRomCurve3
import * as THREE from 'three';

// Create a closed-loop Catmull-Rom spline from array of {x,y,z}
export function createClosedSpline(points) {
  const vectors = points.map(p => new THREE.Vector3(p.x, p.y, p.z));
  const curve = new THREE.CatmullRomCurve3(vectors, true, 'catmullrom', 0.5);
  return curve;
}

// Sample spline evenly by arc length, returning frames
export function sampleSplineEvenly(spline, spacing = 2) {
  const totalLength = spline.getLength();
  const count = Math.ceil(totalLength / spacing);
  const frames = [];
  const up = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const position = spline.getPointAt(t);
    const tangent = spline.getTangentAt(t).normalize();

    // Compute binormal and normal using Frenet-Serret with reference up
    const binormal = new THREE.Vector3().crossVectors(tangent, up).normalize();
    // If tangent is nearly parallel to up, use a fallback
    if (binormal.lengthSq() < 0.001) {
      binormal.set(1, 0, 0);
    }
    const normal = new THREE.Vector3().crossVectors(binormal, tangent).normalize();

    frames.push({ position, tangent, normal, binormal, t });
  }

  return frames;
}

// Project a world position onto the closest point on the spline
// Returns { t, distance, closestPoint }
export function projectOntoSpline(spline, worldPos, coarseSamples = 200) {
  let bestT = 0;
  let bestDist = Infinity;
  const pos = worldPos instanceof THREE.Vector3 ? worldPos : new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z);

  // Coarse pass
  for (let i = 0; i <= coarseSamples; i++) {
    const t = i / coarseSamples;
    const pt = spline.getPointAt(t);
    const d = pt.distanceToSquared(pos);
    if (d < bestDist) {
      bestDist = d;
      bestT = t;
    }
  }

  // Binary refinement
  let low = bestT - 1 / coarseSamples;
  let high = bestT + 1 / coarseSamples;
  for (let iter = 0; iter < 10; iter++) {
    const mid = (low + high) / 2;
    const tA = (low + mid) / 2;
    const tB = (mid + high) / 2;
    // Wrap t into [0,1]
    const ptA = spline.getPointAt(((tA % 1) + 1) % 1);
    const ptB = spline.getPointAt(((tB % 1) + 1) % 1);
    if (ptA.distanceToSquared(pos) < ptB.distanceToSquared(pos)) {
      high = mid;
    } else {
      low = mid;
    }
  }

  const finalT = ((((low + high) / 2) % 1) + 1) % 1;
  const closestPoint = spline.getPointAt(finalT);
  const distance = closestPoint.distanceTo(pos);

  return { t: finalT, distance, closestPoint };
}

// Get the spline frame at parameter t with optional banking
export function getSplineFrameAt(spline, t, bankAngle = 0) {
  const nt = ((t % 1) + 1) % 1;
  const position = spline.getPointAt(nt);
  const tangent = spline.getTangentAt(nt).normalize();
  const up = new THREE.Vector3(0, 1, 0);

  let binormal = new THREE.Vector3().crossVectors(tangent, up).normalize();
  if (binormal.lengthSq() < 0.001) {
    binormal.set(1, 0, 0);
  }
  let normal = new THREE.Vector3().crossVectors(binormal, tangent).normalize();

  // Apply banking
  if (bankAngle !== 0) {
    const q = new THREE.Quaternion().setFromAxisAngle(tangent, bankAngle);
    normal.applyQuaternion(q);
    binormal.applyQuaternion(q);
  }

  return { position, tangent, normal, binormal };
}

// Get arc-length distance from t=0 to t
export function distanceAlongSpline(spline, t) {
  const totalLength = spline.getLength();
  return t * totalLength;
}

// Get progress along spline [0,1] for a world position
export function getProgressAlongSpline(spline, worldPos) {
  const proj = projectOntoSpline(spline, worldPos);
  return proj.t;
}

// Get total spline length
export function getSplineLength(spline) {
  return spline.getLength();
}

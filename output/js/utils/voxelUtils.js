/**
 * voxelUtils — helpers for building merged and instanced voxel geometry.
 */
import * as THREE from 'three';

/**
 * Convert a hex color (number or string) to normalized {r, g, b}.
 * Accepts 0xRRGGBB, '#RRGGBB', or '#RGB'.
 * @param {number|string} hex
 * @returns {{r:number, g:number, b:number}}
 */
export function hexToRgb(hex) {
  let n;
  if (typeof hex === 'string') {
    let h = hex.replace('#', '');
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    n = parseInt(h, 16);
  } else {
    n = hex;
  }
  return {
    r: ((n >> 16) & 0xFF) / 255,
    g: ((n >> 8) & 0xFF) / 255,
    b: (n & 0xFF) / 255,
  };
}

/* ── Box face data ─────────────────────────────────────────────────── */

// Each face: 4 corner offsets (as fractions of w,h,d from center), normal, and
// two-triangle winding (indices into the 4 corners).
// Corner offsets are [sx, sy, sz] where s ∈ {-1, +1} selects the half-extent.

const FACE_DEFS = [
  // +X
  { corners: [[1,-1,-1],[1, 1,-1],[1, 1, 1],[1,-1, 1]], normal: [ 1, 0, 0] },
  // -X
  { corners: [[-1,-1, 1],[-1, 1, 1],[-1, 1,-1],[-1,-1,-1]], normal: [-1, 0, 0] },
  // +Y
  { corners: [[-1, 1,-1],[-1, 1, 1],[ 1, 1, 1],[ 1, 1,-1]], normal: [ 0, 1, 0] },
  // -Y
  { corners: [[-1,-1, 1],[-1,-1,-1],[ 1,-1,-1],[ 1,-1, 1]], normal: [ 0,-1, 0] },
  // +Z
  { corners: [[-1,-1, 1],[ 1,-1, 1],[ 1, 1, 1],[-1, 1, 1]], normal: [ 0, 0, 1] },
  // -Z
  { corners: [[ 1,-1,-1],[-1,-1,-1],[-1, 1,-1],[ 1, 1,-1]], normal: [ 0, 0,-1] },
];

// Two triangles per face: indices into the 4 corners (CCW winding).
const FACE_TRIS = [0, 1, 2, 0, 2, 3];

const VERTS_PER_BOX = 36; // 6 faces × 2 tris × 3 verts

/**
 * Build a single merged BufferGeometry from an array of box definitions.
 * Each box becomes 36 vertices with position, normal, and vertex color.
 *
 * @param {{x:number, y:number, z:number, w:number, h:number, d:number, color:number|string}[]} boxDefs
 * @returns {THREE.BufferGeometry}
 */
export function buildMergedBoxes(boxDefs) {
  const count = boxDefs.length;
  const totalVerts = count * VERTS_PER_BOX;

  const positions = new Float32Array(totalVerts * 3);
  const normals   = new Float32Array(totalVerts * 3);
  const colors    = new Float32Array(totalVerts * 3);

  let vi = 0; // vertex write index (in floats, stride 3)

  for (let b = 0; b < count; b++) {
    const def = boxDefs[b];
    const cx = def.x;
    const cy = def.y;
    const cz = def.z;
    const hw = def.w * 0.5;
    const hh = def.h * 0.5;
    const hd = def.d * 0.5;
    const { r, g, b: bl } = hexToRgb(def.color);

    for (let f = 0; f < 6; f++) {
      const face = FACE_DEFS[f];
      const nx = face.normal[0];
      const ny = face.normal[1];
      const nz = face.normal[2];

      // Expand the 4 corners to world positions
      const c = face.corners;
      const corners = [
        [cx + c[0][0] * hw, cy + c[0][1] * hh, cz + c[0][2] * hd],
        [cx + c[1][0] * hw, cy + c[1][1] * hh, cz + c[1][2] * hd],
        [cx + c[2][0] * hw, cy + c[2][1] * hh, cz + c[2][2] * hd],
        [cx + c[3][0] * hw, cy + c[3][1] * hh, cz + c[3][2] * hd],
      ];

      // 6 indices → 2 triangles
      for (let t = 0; t < 6; t++) {
        const corner = corners[FACE_TRIS[t]];
        positions[vi]     = corner[0];
        positions[vi + 1] = corner[1];
        positions[vi + 2] = corner[2];

        normals[vi]     = nx;
        normals[vi + 1] = ny;
        normals[vi + 2] = nz;

        colors[vi]     = r;
        colors[vi + 1] = g;
        colors[vi + 2] = bl;

        vi += 3;
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal',   new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('color',    new THREE.BufferAttribute(colors, 3));

  return geometry;
}

/**
 * Create an InstancedMesh from a shared geometry + material and per-instance transforms.
 *
 * @param {THREE.BufferGeometry} geometry
 * @param {THREE.Material} material
 * @param {{x:number, y:number, z:number, sx:number, sy:number, sz:number}[]} transforms
 * @returns {THREE.InstancedMesh}
 */
export function createInstancedVoxels(geometry, material, transforms) {
  const count = transforms.length;
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const matrix = new THREE.Matrix4();

  for (let i = 0; i < count; i++) {
    const t = transforms[i];
    matrix.compose(
      new THREE.Vector3(t.x, t.y, t.z),
      new THREE.Quaternion(), // identity rotation
      new THREE.Vector3(t.sx, t.sy, t.sz),
    );
    mesh.setMatrixAt(i, matrix);
  }

  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

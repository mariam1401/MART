// ueMath.js
//
// Conversion between Unreal Engine's camera convention (left-handed, Z-up,
// centimeters, Pitch/Yaw/Roll in degrees) and Three.js (right-handed, Y-up,
// meters, quaternion/Euler as usual).
//
// Approach: rather than trying to remap Euler angles directly (which is
// error-prone across conventions), we compute the camera's forward/right/up
// UNIT VECTORS in UE space using UE's own rotator formula, remap those
// vectors (and the position) into Three.js space with a single consistent
// axis relabelling, and then build the camera's orientation directly from
// those basis vectors. This sidesteps any Euler-order ambiguity entirely.

import * as THREE from 'three';

const DEG2RAD = Math.PI / 180;

/**
 * UE FRotator -> forward/right/up unit vectors, in UE's own (X-fwd, Y-right,
 * Z-up) space.
 *
 * Implemented via UE's own quaternion formula (Yaw*Pitch*Roll composition)
 * rather than a hand-assembled rotation matrix: an earlier hand-derived
 * matrix form produced a `right`/`up`/`forward` triple that was individually
 * unit-length but NOT mutually orthogonal for general Yaw (verified: it only
 * checked out for the degenerate Yaw=0 case). The quaternion form below is
 * verified orthogonal for arbitrary Pitch/Yaw/Roll.
 */
function ueBasisFromRotator(pitchDeg, yawDeg, rollDeg) {
  const p = (pitchDeg * DEG2RAD) / 2;
  const y = (yawDeg * DEG2RAD) / 2;
  const r = (rollDeg * DEG2RAD) / 2;

  const sp = Math.sin(p), cp = Math.cos(p);
  const sy = Math.sin(y), cy = Math.cos(y);
  const sr = Math.sin(r), cr = Math.cos(r);

  // UE FRotator::Quaternion()
  const q = {
    x: cr * sp * sy - sr * cp * cy,
    y: -(cr * sp * cy) - sr * cp * sy,
    z: cr * cp * sy - sr * sp * cy,
    w: cr * cp * cy + sr * sp * sy,
  };

  const rotate = (v) => {
    const qv = [q.x, q.y, q.z];
    const cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
    const c1 = cross(qv, v);
    const c2 = cross(qv, c1);
    return [
      v[0] + 2 * q.w * c1[0] + 2 * c2[0],
      v[1] + 2 * q.w * c1[1] + 2 * c2[1],
      v[2] + 2 * q.w * c1[2] + 2 * c2[2],
    ];
  };

  return {
    forward: rotate([1, 0, 0]),
    right: rotate([0, 1, 0]),
    up: rotate([0, 0, 1]),
  };
}

/** UE (X,Y,Z) cm -> Three.js (X,Y,Z) meters. Swaps Y/Z (fixes handedness
 *  LH->RH in one step) and converts units. */
function ueVectorToThree(v) {
  return new THREE.Vector3(v[0], v[2], v[1]);
}
function uePositionCmToThree(p) {
  return new THREE.Vector3(p[0], p[2], p[1]).multiplyScalar(0.01);
}

/** Vertical FOV (radians) from focal length + sensor(filmback) height, both mm. */
export function verticalFovFromFocalLength(focalLengthMm, sensorHeightMm) {
  return 2 * Math.atan(sensorHeightMm / 2 / focalLengthMm);
}

/**
 * Build a THREE.PerspectiveCamera fully positioned/oriented to match a given
 * Unreal Engine camera transform + focal length. `aspect`/`fov` on the
 * returned camera are placeholders; call applyCoverFit() after to match the
 * actual viewport (see below).
 */
export function buildCameraFromUE(camConfig) {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100000);

  const pos = uePositionCmToThree(camConfig.position_cm);
  camera.position.copy(pos);

  const { forward, right, up } = ueBasisFromRotator(
    camConfig.pitchDeg,
    camConfig.yawDeg,
    camConfig.rollDeg
  );
  const fwdThree = ueVectorToThree(forward).normalize();
  const rightThree = ueVectorToThree(right).normalize();
  const upThree = ueVectorToThree(up).normalize();

  // Three.js camera looks down its local -Z axis, +X right, +Y up.
  // World-space columns: X=right, Y=up, Z=-forward (since forward is the
  // viewing direction, which corresponds to local -Z).
  const basis = new THREE.Matrix4().makeBasis(
    rightThree,
    upThree,
    fwdThree.clone().negate()
  );
  camera.quaternion.setFromRotationMatrix(basis);

  camera.userData.nativeVFov = verticalFovFromFocalLength(
    camConfig.focalLengthMm,
    camConfig.sensorHeightMm
  );
  camera.userData.imageAspect = camConfig.imageWidth / camConfig.imageHeight;

  return camera;
}

/**
 * Match the camera's FOV/aspect to how the background photo is actually
 * being displayed with CSS `object-fit: cover` in a viewport of size
 * (viewW, viewH). This keeps the invisible geometry pixel-aligned with the
 * photo at any window size/orientation, matching the "cover" crop exactly
 * (crop along the long side, never stretch).
 */
export function applyCoverFit(camera, viewW, viewH) {
  const viewAspect = viewW / viewH;
  const imgAspect = camera.userData.imageAspect;
  const nativeVFov = camera.userData.nativeVFov; // radians

  camera.aspect = viewAspect;

  if (viewAspect >= imgAspect) {
    // Viewport relatively wider than the photo: photo fills full width,
    // is cropped top/bottom -> full horizontal FOV is visible, so derive
    // vertical FOV from the *native horizontal* FOV and the new aspect.
    const nativeHFov = 2 * Math.atan(Math.tan(nativeVFov / 2) * imgAspect);
    const vFov = 2 * Math.atan(Math.tan(nativeHFov / 2) / viewAspect);
    camera.fov = THREE.MathUtils.radToDeg(vFov);
  } else {
    // Viewport relatively taller/narrower than the photo: photo fills full
    // height -> the native vertical FOV is fully visible, unchanged.
    camera.fov = THREE.MathUtils.radToDeg(nativeVFov);
  }

  camera.updateProjectionMatrix();
}

export { ueBasisFromRotator, ueVectorToThree, uePositionCmToThree };

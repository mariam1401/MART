// config.js
//
// All scene-specific numbers live here: camera parameters (as given in
// Transform_cameras.txt, kept in their ORIGINAL Unreal units/format) and the
// floor model's world placement (found by matching the model against the
// photos - see README).
//
// Structure & field names are ours to define (task allows this); we mirror
// Transform_cameras.txt's own units (cm, degrees, Pitch/Yaw/Roll) so the
// config can be filled in directly from that file with no unit conversion -
// all conversion happens in code (ueMath.js), never here.

export const SENSOR_HEIGHT_MM = 13.365; // "16:9 Digital Film" filmback height

export const CAMERAS = {
  pogod_01: {
    label: 'Pogod_01',
    image: '/images/Pogod_01.jpg',
    imageWidth: 2048,
    imageHeight: 821,
    position_cm: [-8219.125682, 17917.186677, 21877.937132],
    pitchDeg: -16.484003,
    yawDeg: -90.036140,
    rollDeg: 0.0,
    focalLengthMm: 25.0,
    sensorHeightMm: SENSOR_HEIGHT_MM,
  },
  pogod_02: {
    label: 'Pogod_02',
    image: '/images/Pogod_02.jpg',
    imageWidth: 2048,
    imageHeight: 823,
    position_cm: [-26815.163848, -299.492574, 22587.838344],
    pitchDeg: -18.527453,
    yawDeg: -1.348379,
    rollDeg: -0.0,
    focalLengthMm: 25.0,
    sensorHeightMm: SENSOR_HEIGHT_MM,
  },
};

// Where the floor volume sits in the world (Three.js space: meters, Y-up).
// Found by matching the model's projected outline against the 7th floor
// band on the white tower in Pogod_01 (see README for methodology).
// Only translation + a rotation about the vertical axis are exposed here,
// per the brief: the model must NOT be rescaled.
export const MODEL_TRANSFORM = {
  position: [-88.7571, 166.7317, 6.3433],
  rotationYDeg: 0,
};

export const DEFAULT_CAMERA_KEY = 'pogod_01';

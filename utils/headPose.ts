// Head pose (pitch/yaw/roll) derived from MediaPipe FaceLandmarker's
// facial transformation matrix (a 4x4 matrix returned when
// outputFacialTransformationMatrixes is enabled). This is a real rotation
// matrix extracted from the 3D face mesh fit, not a naive single-point
// approximation.

export interface HeadPose {
  pitch: number; // degrees, negative = looking down
  yaw: number;   // degrees, negative = looking left (from viewer's POV)
  roll: number;  // degrees
}

// MediaPipe returns the transformation matrix data in row-major order.
export function headPoseFromMatrix(matrix: number[] | Float32Array): HeadPose {
  // Read the upper-left 3x3 rotation matrix.
  const m = matrix;
  const r00 = m[0], r01 = m[1], r02 = m[2];
  const r10 = m[4], r11 = m[5], r12 = m[6];
  const r20 = m[8], r21 = m[9], r22 = m[10];

  // Extract intrinsic XYZ angles. The previous extraction used yaw, pitch,
  // and roll axes from different conventions, which cross-wired directions.
  const pitch = Math.atan2(r21, r22);
  const yaw = Math.atan2(-r20, Math.sqrt(r00 * r00 + r10 * r10));
  const roll = Math.atan2(r10, r00);

  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  return {
    pitch: toDeg(pitch),
    yaw: toDeg(yaw),
    roll: toDeg(roll)
  };
}

export type HeadOrientationLabel =
  | 'Normal'
  | 'Looking Down'
  | 'Looking Up'
  | 'Looking Left'
  | 'Looking Right';

export function classifyHeadOrientation(
  pose: HeadPose,
  pitchDownThreshold = -15,
  pitchUpThreshold = 20,
  yawThreshold = 20
): HeadOrientationLabel {
  if (pose.pitch < pitchDownThreshold) return 'Looking Down';
  if (pose.pitch > pitchUpThreshold) return 'Looking Up';
  if (pose.yaw > yawThreshold) return 'Looking Right';
  if (pose.yaw < -yawThreshold) return 'Looking Left';
  return 'Normal';
}

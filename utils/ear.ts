// Eye Aspect Ratio (EAR) calculation from MediaPipe Face Landmarker points.
// MediaPipe FaceLandmarker (478-point mesh) landmark indices used per eye:
//   Left eye (viewer's left / subject's right in mirrored webcam view):
//     vertical pairs: (159, 145), (158, 153)
//     horizontal pair: (33, 133)
//   Right eye:
//     vertical pairs: (386, 374), (385, 380)
//     horizontal pair: (362, 263)

export interface Point3D {
  x: number;
  y: number;
  z?: number;
}

const LEFT_EYE = {
  p1: 33,   // left corner
  p4: 133,  // right corner
  p2: 159,  // top
  p6: 145,  // bottom
  p3: 158,  // top
  p5: 153   // bottom
};

const RIGHT_EYE = {
  p1: 362,
  p4: 263,
  p2: 386,
  p6: 374,
  p3: 385,
  p5: 380
};

function dist(a: Point3D, b: Point3D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function singleEyeEAR(lm: Point3D[], eye: typeof LEFT_EYE): number {
  const v1 = dist(lm[eye.p2], lm[eye.p6]);
  const v2 = dist(lm[eye.p3], lm[eye.p5]);
  const h = dist(lm[eye.p1], lm[eye.p4]);
  if (h === 0) return 0;
  return (v1 + v2) / (2 * h);
}

export function calculateEAR(landmarks: Point3D[]): {
  leftEAR: number;
  rightEAR: number;
  avgEAR: number;
} {
  const leftEAR = singleEyeEAR(landmarks, LEFT_EYE);
  const rightEAR = singleEyeEAR(landmarks, RIGHT_EYE);
  const avgEAR = (leftEAR + rightEAR) / 2;
  return { leftEAR, rightEAR, avgEAR };
}

// Mouth Aspect Ratio (MAR) from MediaPipe Face Landmarker points.
// Inner lip vertical points: 13 (top), 14 (bottom)
// Mouth corners (horizontal): 78 (left), 308 (right)
// A second vertical pair is used for stability: 82 / 87 and 312 / 317 averaged.

import type { Point3D } from './ear';

function dist(a: Point3D, b: Point3D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function calculateMAR(landmarks: Point3D[]): number {
  const vertical1 = dist(landmarks[13], landmarks[14]);
  const vertical2 = dist(landmarks[82], landmarks[87]);
  const vertical3 = dist(landmarks[312], landmarks[317]);
  const horizontal = dist(landmarks[78], landmarks[308]);

  if (horizontal === 0) return 0;

  const verticalAvg = (vertical1 + vertical2 + vertical3) / 3;
  return verticalAvg / horizontal;
}

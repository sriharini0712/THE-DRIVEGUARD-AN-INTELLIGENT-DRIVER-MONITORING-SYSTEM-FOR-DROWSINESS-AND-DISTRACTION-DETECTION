// Draws a light, non-distracting overlay of the key landmarks actually used
// for EAR/MAR/head-pose (rather than all 478 mesh points, which would be
// visually noisy) onto a canvas the same size as the video element.

import type { Point3D } from '../utils/ear';

const LEFT_EYE_RING = [33, 159, 158, 133, 153, 145];
const RIGHT_EYE_RING = [362, 386, 385, 263, 380, 374];
const MOUTH_RING = [78, 82, 13, 312, 308, 317, 14, 87];
const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379,
  378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127,
  162, 21, 54, 103, 67, 109
];

function drawRing(
  ctx: CanvasRenderingContext2D,
  landmarks: Point3D[],
  indices: number[],
  width: number,
  height: number,
  color: string
) {
  ctx.beginPath();
  indices.forEach((idx, i) => {
    const p = landmarks[idx];
    if (!p) return;
    const x = p.x * width;
    const y = p.y * height;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
}

export function drawFaceOverlay(
  ctx: CanvasRenderingContext2D,
  landmarks: Point3D[],
  width: number,
  height: number
) {
  ctx.clearRect(0, 0, width, height);
  drawRing(ctx, landmarks, FACE_OVAL, width, height, 'rgba(59,130,246,0.35)');
  drawRing(ctx, landmarks, LEFT_EYE_RING, width, height, '#22c55e');
  drawRing(ctx, landmarks, RIGHT_EYE_RING, width, height, '#22c55e');
  drawRing(ctx, landmarks, MOUTH_RING, width, height, '#eab308');
}

export function clearOverlay(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.clearRect(0, 0, width, height);
}

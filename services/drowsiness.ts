// "Prototype Drowsiness Index" — a composite 0-100 score built from several
// temporal signals, NOT a medical fatigue percentage and NOT a simple
// "yawn +2, blink +1" point system. Weights are documented and tunable;
// they are heuristic prototype values, not clinically validated.

export interface DrowsinessInputs {
  percentEyesClosed: number;   // 0-1, fraction of recent window with eyes closed
  longestClosureSec: number;   // seconds
  blinkRatePerMin: number;     // blinks per minute over recent window
  yawnRatePerMin: number;      // yawns per minute over recent window
  headDownPercent: number;     // 0-1, fraction of recent window with head pitched down
}

export type DrowsinessLevel = 'Low' | 'Moderate' | 'High' | 'Critical';

// Weights sum roughly to 100 across the sub-scores below.
const WEIGHTS = {
  eyesClosed: 35,
  longestClosure: 25,
  blinkRate: 10,
  yawnRate: 15,
  headDown: 15
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function calculateDrowsinessIndex(inputs: DrowsinessInputs): number {
  // Eyes-closed percentage: normal driving is near 0%; scale so 40%+ of a
  // window with eyes closed maxes this sub-score out.
  const eyesClosedScore = clamp01(inputs.percentEyesClosed / 0.4) * WEIGHTS.eyesClosed;

  // Longest single closure: 0-3+ seconds maps to 0-1 (microsleep range).
  const longestClosureScore = clamp01(inputs.longestClosureSec / 3) * WEIGHTS.longestClosure;

  // Blink rate: both very low (staring/fixation) and very high (fatigue
  // blinking) rates can indicate drowsiness. Normal resting blink rate is
  // roughly 15-20/min; we score deviation from that band.
  const normalLow = 10;
  const normalHigh = 25;
  let blinkDeviation = 0;
  if (inputs.blinkRatePerMin < normalLow) {
    blinkDeviation = (normalLow - inputs.blinkRatePerMin) / normalLow;
  } else if (inputs.blinkRatePerMin > normalHigh) {
    blinkDeviation = (inputs.blinkRatePerMin - normalHigh) / normalHigh;
  }
  const blinkRateScore = clamp01(blinkDeviation) * WEIGHTS.blinkRate;

  // Yawn rate: 3+ yawns/min in a monitoring window is treated as high.
  const yawnRateScore = clamp01(inputs.yawnRatePerMin / 3) * WEIGHTS.yawnRate;

  // Head-down percentage of recent window.
  const headDownScore = clamp01(inputs.headDownPercent / 0.3) * WEIGHTS.headDown;

  const total =
    eyesClosedScore + longestClosureScore + blinkRateScore + yawnRateScore + headDownScore;

  return Math.round(Math.max(0, Math.min(100, total)));
}

export function classifyDrowsinessLevel(index: number): DrowsinessLevel {
  if (index <= 30) return 'Low';
  if (index <= 60) return 'Moderate';
  if (index <= 80) return 'High';
  return 'Critical';
}

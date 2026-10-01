// Personalized EAR calibration. The user looks normally at the camera for a
// fixed window; we collect EAR samples and derive a baseline + a
// closure threshold as a fraction of that baseline, rather than assuming a
// single fixed EAR works for every eye shape/camera/lighting setup.

export interface CalibrationResult {
  baselineEAR: number;
  closureThreshold: number;
  sampleCount: number;
}

const THRESHOLD_RATIO = 0.75; // eyes considered "closed" below 75% of baseline
const MIN_VALID_SAMPLES = 20;

export class Calibrator {
  private samples: number[] = [];

  addSample(ear: number) {
    // Ignore obviously invalid/zero readings (face lost, bad landmarks)
    if (ear > 0.05 && ear < 0.7) {
      this.samples.push(ear);
    }
  }

  reset() {
    this.samples = [];
  }

  get sampleCount() {
    return this.samples.length;
  }

  isSufficient() {
    return this.samples.length >= MIN_VALID_SAMPLES;
  }

  finalize(): CalibrationResult | null {
    if (!this.isSufficient()) return null;

    // Use median for robustness against blink outliers during calibration
    const sorted = [...this.samples].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const baselineEAR =
      sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

    const closureThreshold = baselineEAR * THRESHOLD_RATIO;

    return {
      baselineEAR: Number(baselineEAR.toFixed(3)),
      closureThreshold: Number(closureThreshold.toFixed(3)),
      sampleCount: sorted.length
    };
  }
}

export const DEFAULT_CALIBRATION: CalibrationResult = {
  // Reasonable fallback if the user skips calibration, clearly a fallback,
  // not presented as a universal truth.
  baselineEAR: 0.3,
  closureThreshold: 0.22,
  sampleCount: 0
};

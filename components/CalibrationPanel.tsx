import { CalibrationResult } from '../utils/calibration';

interface Props {
  isCalibrating: boolean;
  progress: number; // 0-1
  result: CalibrationResult | null;
  onStart: () => void;
}

export default function CalibrationPanel({ isCalibrating, progress, result, onStart }: Props) {
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Calibration</h3>
      {!isCalibrating && (
        <>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Look normally at the camera for 5 seconds so we can learn your personal
            baseline eye-openness. This makes drowsiness detection accurate for your
            eye shape and current lighting instead of relying on one fixed number for
            everyone.
          </p>
          <button className="btn btn-outline" onClick={onStart}>
            {result ? 'Recalibrate' : 'Calibrate'}
          </button>
        </>
      )}

      {isCalibrating && (
        <div>
          <p>Look normally at the camera…</p>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, height: 10, overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.round(progress * 100)}%`,
                height: '100%',
                background: 'var(--accent)',
                transition: 'width 0.1s linear'
              }}
            />
          </div>
        </div>
      )}

      {result && !isCalibrating && (
        <div className="grid grid-cols-2" style={{ marginTop: 16 }}>
          <div>
            <div className="metric-label">Baseline EAR</div>
            <div className="metric-value" style={{ fontSize: '1.3rem' }}>{result.baselineEAR}</div>
          </div>
          <div>
            <div className="metric-label">Eye Closure Threshold</div>
            <div className="metric-value" style={{ fontSize: '1.3rem' }}>{result.closureThreshold}</div>
          </div>
        </div>
      )}
    </div>
  );
}

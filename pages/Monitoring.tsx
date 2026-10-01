import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CameraMonitor, { LiveMetrics } from '../components/CameraMonitor';
import CalibrationPanel from '../components/CalibrationPanel';
import AlertPanel, { AlertLevel } from '../components/AlertPanel';
import DrowsinessGauge from '../components/DrowsinessGauge';
import MetricCard from '../components/MetricCard';
import { Calibrator, CalibrationResult, DEFAULT_CALIBRATION } from '../utils/calibration';
import { saveSession, SessionSummary } from '../utils/storage';

const RESPONSE_TIMEOUT_MS = 15_000; // time to respond to "Are you alert?" before escalating
const CALIBRATION_DURATION_MS = 5_000;
const ALERT_SOUND_INTERVAL_MS = 2_000;

let alertAudioContext: AudioContext | null = null;

function prepareAlertAudio() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    alertAudioContext ||= new AudioContextClass();
    void alertAudioContext.resume();
  } catch {
    // Audio is optional; monitoring continues with visual alerts.
  }
}

function playAlertSound(level: AlertLevel) {
  try {
    prepareAlertAudio();
    if (!alertAudioContext) return;
    const ctx = alertAudioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = level >= 3 ? 'square' : 'sine';
    osc.frequency.value = level >= 3 ? 880 : level === 2 ? 660 : 520;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(level >= 2 ? 0.2 : 0.12, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (level >= 3 ? 0.8 : 0.5));
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (level >= 3 ? 0.8 : 0.5));
  } catch {
    // Audio not available/blocked — fail silently, visual alert still shows.
  }
}

export default function Monitoring() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [cameraActive, setCameraActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null);

  const [calibrating, setCalibrating] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [calibrationResult, setCalibrationResult] = useState<CalibrationResult | null>(null);
  const calibratorRef = useRef(new Calibrator());
  const calibrationStartRef = useRef(0);

  const [alertLevel, setAlertLevel] = useState<AlertLevel>(0);
  const [awaitingResponse, setAwaitingResponse] = useState(false);
  const [emergencyTriggered, setEmergencyTriggered] = useState(false);
  const [audioOn, setAudioOn] = useState(true);
  const [warningCount, setWarningCount] = useState(0);

  const responseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alertSoundTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef = useRef<number | null>(null);
  const lastLevelRef = useRef<AlertLevel>(0);

  const threshold = calibrationResult ? calibrationResult.closureThreshold : DEFAULT_CALIBRATION.closureThreshold;

  // --- Calibration ---
  useEffect(() => {
    if (!calibrating) return;
    calibratorRef.current.reset();
    calibrationStartRef.current = performance.now();
    setCalibrationProgress(0);

    const interval = setInterval(() => {
      const elapsed = performance.now() - calibrationStartRef.current;
      setCalibrationProgress(Math.min(1, elapsed / CALIBRATION_DURATION_MS));
      if (elapsed >= CALIBRATION_DURATION_MS) {
        clearInterval(interval);
        const result = calibratorRef.current.finalize();
        setCalibrationResult(result || DEFAULT_CALIBRATION);
        setCalibrating(false);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [calibrating]);

  function handleCalibrationSample(ear: number) {
    calibratorRef.current.addSample(ear);
  }

  function startCalibration() {
    if (!cameraActive) setCameraActive(true);
    setCalibrating(true);
  }

  // --- Camera lifecycle ---
  function handleStart() {
    setError(null);
    prepareAlertAudio();
    setCameraActive(true);
    setPaused(false);
    sessionStartRef.current = performance.now();
    setWarningCount(0);
    setAlertLevel(0);
    lastLevelRef.current = 0;
    setEmergencyTriggered(false);
    setAwaitingResponse(false);
  }

  function handleStop() {
    if (metrics && sessionStartRef.current && user) {
      const durationSeconds = Math.round((performance.now() - sessionStartRef.current) / 1000);
      const index = metrics.drowsinessIndex;
      const level =
        index <= 30 ? 'Low' : index <= 60 ? 'Moderate' : index <= 80 ? 'High' : 'Critical';

      const summary: SessionSummary = {
        id: crypto.randomUUID(),
        userId: user.uid,
        date: new Date().toISOString(),
        durationSeconds,
        averageEAR: Number(metrics.avgEARSession.toFixed(3)),
        lowestEAR: Number(metrics.lowestEARSession.toFixed(3)),
        longestEyeClosureSec: Number(metrics.longestClosureSec.toFixed(2)),
        blinkCount: metrics.blinkCount,
        yawnCount: metrics.yawnCount,
        averageMAR: Number(metrics.avgMARSession.toFixed(3)),
        maxMAR: Number(metrics.maxMARSession.toFixed(3)),
        averageHeadPitch: Number(metrics.avgHeadPitchSession.toFixed(1)),
        maxDownwardPitch: Number(metrics.maxDownwardPitchSession.toFixed(1)),
        warningCount,
        maxDrowsinessIndex: index,
        status: level
      };
      saveSession(summary);
    }
    setCameraActive(false);
    setPaused(false);
    setMetrics(null);
    setAlertLevel(0);
    lastLevelRef.current = 0;
    setAwaitingResponse(false);
    setEmergencyTriggered(false);
    sessionStartRef.current = null;
    if (responseTimerRef.current) clearTimeout(responseTimerRef.current);
    responseTimerRef.current = null;
    if (alertSoundTimerRef.current) clearInterval(alertSoundTimerRef.current);
    alertSoundTimerRef.current = null;
    navigate('/history');
  }

  function togglePause() {
    setPaused((p) => !p);
  }

  const handleMetrics = useCallback((m: LiveMetrics) => {
    if (paused) return;
    setMetrics(m);
  }, [paused]);

  useEffect(() => {
    if (alertLevel < 2 || !audioOn || paused) {
      if (alertSoundTimerRef.current) clearInterval(alertSoundTimerRef.current);
      alertSoundTimerRef.current = null;
      return;
    }

    playAlertSound(alertLevel);
    alertSoundTimerRef.current = setInterval(() => {
      playAlertSound(alertLevel);
    }, ALERT_SOUND_INTERVAL_MS);

    return () => {
      if (alertSoundTimerRef.current) clearInterval(alertSoundTimerRef.current);
      alertSoundTimerRef.current = null;
    };
  }, [alertLevel, audioOn, paused]);

  // --- Alert level state machine ---
  useEffect(() => {
    if (!metrics || paused) return;

    if (metrics.multipleFaces) return; // handled via status text, not escalated
    if (!metrics.faceDetected) return; // don't escalate drowsiness on missing face

    let nextLevel: AlertLevel = 0;
    if (metrics.drowsinessIndex > 80 || metrics.currentClosureDurationSec > 3) {
      nextLevel = 3;
    } else if (metrics.drowsinessIndex > 60 || metrics.currentClosureDurationSec > 2) {
      nextLevel = 2;
    } else if (metrics.drowsinessIndex > 30 || metrics.currentClosureDurationSec > 1) {
      nextLevel = 1;
    }

    if (nextLevel > lastLevelRef.current) {
      setAlertLevel(nextLevel);
      lastLevelRef.current = nextLevel;
      if (nextLevel >= 2) {
        setWarningCount((c) => c + 1);
        setAwaitingResponse(true);
        if (responseTimerRef.current) clearTimeout(responseTimerRef.current);
        responseTimerRef.current = setTimeout(() => {
          // No response — escalate
          setAlertLevel((prev) => {
            const escalated = (Math.min(3, prev + 1) as AlertLevel);
            lastLevelRef.current = escalated;
            if (escalated === 3 && prev === 3) {
              setEmergencyTriggered(true);
            }
            return escalated;
          });
        }, RESPONSE_TIMEOUT_MS);
      }
    } else if (nextLevel < lastLevelRef.current && nextLevel === 0) {
      // Gradual recovery to normal once signs subside
      lastLevelRef.current = 0;
      setAlertLevel(0);
      setAwaitingResponse(false);
      setEmergencyTriggered(false);
      if (responseTimerRef.current) clearTimeout(responseTimerRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics, paused]);

  function confirmAlert() {
    setAwaitingResponse(false);
    setAlertLevel(0);
    lastLevelRef.current = 0;
    setEmergencyTriggered(false);
    if (responseTimerRef.current) clearTimeout(responseTimerRef.current);
  }

  useEffect(() => {
    return () => {
      if (responseTimerRef.current) clearTimeout(responseTimerRef.current);
      if (alertSoundTimerRef.current) clearInterval(alertSoundTimerRef.current);
    };
  }, []);

  const statusLabel = !cameraActive
    ? 'Camera Off'
    : !metrics
    ? 'Initializing'
    : metrics.multipleFaces
    ? 'MULTIPLE FACES DETECTED'
    : !metrics.faceDetected
    ? 'FACE NOT DETECTED'
    : alertLevel === 0
    ? 'AWAKE'
    : alertLevel === 1
    ? 'ATTENTION'
    : alertLevel === 2
    ? 'POSSIBLE DROWSINESS'
    : 'HIGH DROWSINESS';

  const statusDotClass =
    statusLabel === 'AWAKE'
      ? 'dot-safe'
      : statusLabel === 'ATTENTION'
      ? 'dot-warning'
      : statusLabel === 'POSSIBLE DROWSINESS'
      ? 'dot-moderate'
      : statusLabel === 'HIGH DROWSINESS' || statusLabel.includes('DETECTED')
      ? 'dot-critical'
      : 'dot-warning';

  return (
    <main>
      <h1>Driver Monitoring</h1>
      <div className="disclaimer-banner">
        This is a student research prototype. It does not medically diagnose fatigue and
        cannot guarantee accident prevention. Camera processing is performed locally in
        your browser — video is not uploaded or stored.
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'var(--critical)', marginBottom: 16 }}>
          <strong style={{ color: 'var(--critical)' }}>Error:</strong> {error}
        </div>
      )}

      <div className="monitor-layout">
        <div>
          <CameraMonitor
            active={cameraActive}
            calibrating={calibrating}
            threshold={threshold}
            onCalibrationSample={handleCalibrationSample}
            onMetrics={handleMetrics}
            onError={(msg) => {
              setError(msg);
              setCameraActive(false);
              setPaused(false);
            }}
          />

          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            {!cameraActive && (
              <button className="btn btn-primary" onClick={handleStart}>Start Monitoring</button>
            )}
            {cameraActive && (
              <>
                <button className="btn btn-outline" onClick={togglePause}>
                  {paused ? 'Resume' : 'Pause'}
                </button>
                <button className="btn btn-danger" onClick={handleStop}>Stop</button>
              </>
            )}
            <button className="btn btn-outline" onClick={startCalibration} disabled={calibrating}>
              Calibrate
            </button>
            <button className="btn btn-outline" onClick={() => setAudioOn((a) => !a)}>
              Mute Alert: {audioOn ? 'ON' : 'OFF'}
            </button>
          </div>

          <div style={{ marginTop: 14 }}>
            <span className="status-pill">
              <span className={`status-dot ${statusDotClass}`} />
              {statusLabel}
            </span>
            {metrics && <span style={{ marginLeft: 14, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>FPS: {metrics.fps}</span>}
          </div>

          {metrics?.multipleFaces && (
            <div className="card" style={{ marginTop: 14, borderColor: 'var(--warning)' }}>
              Multiple faces detected — monitoring works best with a single driver in frame.
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <CalibrationPanel
              isCalibrating={calibrating}
              progress={calibrationProgress}
              result={calibrationResult}
              onStart={startCalibration}
            />
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
            <DrowsinessGauge
              index={metrics?.drowsinessIndex || 0}
              level={
                (metrics?.drowsinessIndex || 0) <= 30
                  ? 'Low'
                  : (metrics?.drowsinessIndex || 0) <= 60
                  ? 'Moderate'
                  : (metrics?.drowsinessIndex || 0) <= 80
                  ? 'High'
                  : 'Critical'
              }
            />
          </div>

          <AlertPanel
            level={alertLevel}
            awaitingResponse={awaitingResponse}
            audioOn={audioOn}
            onToggleAudio={() => setAudioOn((a) => !a)}
            onConfirmAlert={confirmAlert}
            emergencyTriggered={emergencyTriggered}
          />

          <div className="grid grid-cols-2" style={{ marginTop: 16 }}>
            <MetricCard label="EAR" value={metrics ? metrics.ear.toFixed(3) : '—'} />
            <MetricCard label="MAR" value={metrics ? metrics.mar.toFixed(3) : '—'} />
            <MetricCard label="Head Pitch" value={metrics ? metrics.headPitch.toFixed(1) : '—'} suffix="°" />
            <MetricCard label="Head State" value={metrics ? metrics.headOrientation : '—'} />
            <MetricCard label="Blink Count" value={metrics ? metrics.blinkCount : 0} />
            <MetricCard label="Yawn Count" value={metrics ? metrics.yawnCount : 0} />
          </div>
        </div>
      </div>
    </main>
  );
}

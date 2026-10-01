import { useEffect, useRef, useState, useCallback } from 'react';
import { FaceLandmarker, FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import { getFaceLandmarker } from '../services/mediapipe';
import { calculateEAR, Point3D } from '../utils/ear';
import { calculateMAR } from '../utils/mar';
import { headPoseFromMatrix, classifyHeadOrientation, HeadOrientationLabel } from '../utils/headPose';
import { BlinkDetector, YawnDetector } from '../services/faceAnalysis';
import { calculateDrowsinessIndex, classifyDrowsinessLevel, DrowsinessLevel } from '../services/drowsiness';
import { drawFaceOverlay, clearOverlay } from './FaceOverlay';

export interface LiveMetrics {
  ear: number;
  mar: number;
  headPitch: number;
  headYaw: number;
  headOrientation: HeadOrientationLabel;
  blinkCount: number;
  yawnCount: number;
  faceDetected: boolean;
  multipleFaces: boolean;
  eyeClosedNow: boolean;
  currentClosureDurationSec: number;
  longestClosureSec: number;
  fps: number;
  drowsinessIndex: number;
  drowsinessLevel: DrowsinessLevel;
  avgEARSession: number;
  lowestEARSession: number;
  avgMARSession: number;
  maxMARSession: number;
  avgHeadPitchSession: number;
  maxDownwardPitchSession: number;
}

interface Props {
  active: boolean;
  calibrating: boolean;
  threshold: number;
  onCalibrationSample?: (ear: number) => void;
  onMetrics: (metrics: LiveMetrics) => void;
  onError: (message: string) => void;
  onStreamReady?: (stream: MediaStream) => void;
}

const WINDOW_MS = 30_000; // rolling window used for rate-based drowsiness inputs

export default function CameraMonitor({
  active,
  calibrating,
  threshold,
  onCalibrationSample,
  onMetrics,
  onError,
  onStreamReady
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);

  const blinkDetectorRef = useRef(new BlinkDetector());
  const yawnDetectorRef = useRef(new YawnDetector());

  // Session-level accumulators
  const earSumRef = useRef(0);
  const earCountRef = useRef(0);
  const lowestEARRef = useRef(1);
  const marSumRef = useRef(0);
  const marCountRef = useRef(0);
  const maxMARRef = useRef(0);
  const pitchSumRef = useRef(0);
  const pitchCountRef = useRef(0);
  const maxDownwardPitchRef = useRef(0);
  const longestClosureRef = useRef(0);

  // Rolling window buffers for rate-based drowsiness inputs
  const eventWindowRef = useRef<
    { t: number; eyeClosed: boolean; headDown: boolean; blink: boolean; yawn: boolean }[]
  >([]);

  const fpsRef = useRef({ frames: 0, lastTime: performance.now(), fps: 0 });

  const [status, setStatus] = useState('Initializing camera…');

  const calibratingRef = useRef(calibrating);
  const thresholdRef = useRef(threshold);
  const onCalibrationSampleRef = useRef(onCalibrationSample);
  const onMetricsRef = useRef(onMetrics);
  const onErrorRef = useRef(onError);
  const onStreamReadyRef = useRef(onStreamReady);
  calibratingRef.current = calibrating;
  thresholdRef.current = threshold;
  onCalibrationSampleRef.current = onCalibrationSample;
  onMetricsRef.current = onMetrics;
  onErrorRef.current = onError;
  onStreamReadyRef.current = onStreamReady;

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!active) {
      stopStream();
      return;
    }

    let cancelled = false;

    async function start() {
      try {
        if (!window.isSecureContext && window.location.hostname !== 'localhost') {
          throw new Error('Camera access requires HTTPS or localhost.');
        }
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('This browser does not support camera access. Please use a current Chrome, Edge, or Firefox browser.');
        }
        setStatus('Requesting camera permission…');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        onStreamReadyRef.current?.(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setStatus('Loading face detection model…');
        landmarkerRef.current = await getFaceLandmarker();
        if (cancelled) return;

        setStatus('Ready');
        loop();
      } catch (err: any) {
        if (cancelled) return;
        stopStream();
        if (err?.name === 'NotAllowedError') {
          onErrorRef.current('Camera permission denied. Please allow camera access to use Driver Monitoring.');
        } else if (err?.name === 'NotFoundError') {
          onErrorRef.current('No camera was found on this device.');
        } else {
          onErrorRef.current('Failed to start camera or load the face detection model. ' + (err?.message || ''));
        }
      }
    }

    function loop() {
      if (cancelled) return;
      const now = performance.now();
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const landmarker = landmarkerRef.current;

      if (video && canvas && landmarker && video.readyState >= 2) {
        if (canvas.width !== video.videoWidth && video.videoWidth > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        const result = landmarker.detectForVideo(video, now);
        processResult(result, now, canvas);
        // FPS accounting
        fpsRef.current.frames += 1;
        if (now - fpsRef.current.lastTime >= 1000) {
          fpsRef.current.fps = fpsRef.current.frames;
          fpsRef.current.frames = 0;
          fpsRef.current.lastTime = now;
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    start();

    return () => {
      cancelled = true;
      stopStream();
      if (videoRef.current) videoRef.current.srcObject = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function pruneWindow(now: number) {
    const cutoff = now - WINDOW_MS;
    while (eventWindowRef.current.length && eventWindowRef.current[0].t < cutoff) {
      eventWindowRef.current.shift();
    }
  }

  function processResult(result: FaceLandmarkerResult, now: number, canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const faces = result.faceLandmarks;
    const faceDetected = faces.length >= 1;
    const multipleFaces = faces.length > 1;

    if (!faceDetected) {
      clearOverlay(ctx, canvas.width, canvas.height);
      pruneWindow(now);
      emit(now, {
        ear: 0,
        mar: 0,
        headPitch: 0,
        headYaw: 0,
        headOrientation: 'Normal',
        faceDetected: false,
        multipleFaces: false,
        eyeClosedNow: false,
      });
      return;
    }

    const landmarks = faces[0] as unknown as Point3D[];
    drawFaceOverlay(ctx, landmarks, canvas.width, canvas.height);

    const { avgEAR } = calculateEAR(landmarks);
    const mar = calculateMAR(landmarks);

    let headPitch = 0;
    let headYaw = 0;
    let headOrientation: HeadOrientationLabel = 'Normal';
    const matrixData = result.facialTransformationMatrixes?.[0]?.data;
    if (matrixData) {
      const pose = headPoseFromMatrix(matrixData);
      headPitch = pose.pitch;
      headYaw = pose.yaw;
      headOrientation = classifyHeadOrientation(pose);
    }
    if (calibratingRef.current) {
      onCalibrationSampleRef.current?.(avgEAR);
    }

    // Blink / eye closure tracking
    const { blinked } = blinkDetectorRef.current.update(avgEAR, thresholdRef.current, now);
    const eyeClosedNow = blinkDetectorRef.current.isEyeClosed();
    const currentClosureDurationSec = blinkDetectorRef.current.getCurrentClosureDurationMs(now) / 1000;
    if (currentClosureDurationSec > longestClosureRef.current) {
      longestClosureRef.current = currentClosureDurationSec;
    }

    // Yawn tracking
    const { yawned } = yawnDetectorRef.current.update(mar, now);

    // Session accumulators
    earSumRef.current += avgEAR;
    earCountRef.current += 1;
    if (avgEAR < lowestEARRef.current) lowestEARRef.current = avgEAR;

    marSumRef.current += mar;
    marCountRef.current += 1;
    if (mar > maxMARRef.current) maxMARRef.current = mar;

    pitchSumRef.current += headPitch;
    pitchCountRef.current += 1;
    const downwardPitch = headPitch < 0 ? -headPitch : 0;
    if (downwardPitch > maxDownwardPitchRef.current) maxDownwardPitchRef.current = downwardPitch;

    // Rolling window
    pruneWindow(now);
    eventWindowRef.current.push({
      t: now,
      eyeClosed: eyeClosedNow,
      headDown: headOrientation === 'Looking Down',
      blink: blinked,
      yawn: yawned
    });

    emit(now, {
      ear: avgEAR,
      mar,
      headPitch,
      headYaw,
      headOrientation,
      faceDetected: true,
      multipleFaces,
      eyeClosedNow,
      currentClosureDurationSec
    });
  }

  function emit(
    now: number,
    partial: {
      ear: number;
      mar: number;
      headPitch: number;
      headYaw: number;
      headOrientation: HeadOrientationLabel;
      faceDetected: boolean;
      multipleFaces: boolean;
      eyeClosedNow: boolean;
      currentClosureDurationSec?: number;
    }
  ) {
    const windowEvents = eventWindowRef.current;
    const windowSeconds = windowEvents.length
      ? Math.max(1, (now - windowEvents[0].t) / 1000)
      : 1;

    const closedFrames = windowEvents.filter((e) => e.eyeClosed).length;
    const percentEyesClosed = windowEvents.length ? closedFrames / windowEvents.length : 0;

    const headDownFrames = windowEvents.filter((e) => e.headDown).length;
    const headDownPercent = windowEvents.length ? headDownFrames / windowEvents.length : 0;

    const blinkEventsInWindow = windowEvents.filter((e) => e.blink).length;
    const yawnEventsInWindow = windowEvents.filter((e) => e.yawn).length;
    const blinkRatePerMin = (blinkEventsInWindow / windowSeconds) * 60;
    const yawnRatePerMin = (yawnEventsInWindow / windowSeconds) * 60;

    const drowsinessIndex = partial.faceDetected
      ? calculateDrowsinessIndex({
          percentEyesClosed,
          longestClosureSec: longestClosureRef.current,
          blinkRatePerMin,
          yawnRatePerMin,
          headDownPercent
        })
      : 0;

    const metrics: LiveMetrics = {
      ear: partial.ear,
      mar: partial.mar,
      headPitch: partial.headPitch,
      headYaw: partial.headYaw,
      headOrientation: partial.headOrientation,
      blinkCount: blinkDetectorRef.current.count,
      yawnCount: yawnDetectorRef.current.count,
      faceDetected: partial.faceDetected,
      multipleFaces: partial.multipleFaces,
      eyeClosedNow: partial.eyeClosedNow,
      currentClosureDurationSec: partial.currentClosureDurationSec || 0,
      longestClosureSec: longestClosureRef.current,
      fps: fpsRef.current.fps,
      drowsinessIndex,
      drowsinessLevel: classifyDrowsinessLevel(drowsinessIndex),
      avgEARSession: earCountRef.current ? earSumRef.current / earCountRef.current : 0,
      lowestEARSession: earCountRef.current ? lowestEARRef.current : 0,
      avgMARSession: marCountRef.current ? marSumRef.current / marCountRef.current : 0,
      maxMARSession: maxMARRef.current,
      avgHeadPitchSession: pitchCountRef.current ? pitchSumRef.current / pitchCountRef.current : 0,
      maxDownwardPitchSession: maxDownwardPitchRef.current
    };

    onMetricsRef.current(metrics);
  }

  // Reset session accumulators whenever monitoring (re)starts
  useEffect(() => {
    if (active) {
      blinkDetectorRef.current.reset();
      yawnDetectorRef.current.reset();
      earSumRef.current = 0;
      earCountRef.current = 0;
      lowestEARRef.current = 1;
      marSumRef.current = 0;
      marCountRef.current = 0;
      maxMARRef.current = 0;
      pitchSumRef.current = 0;
      pitchCountRef.current = 0;
      maxDownwardPitchRef.current = 0;
      longestClosureRef.current = 0;
      eventWindowRef.current = [];
    }
  }, [active]);

  return (
    <div className="video-wrap">
      <video ref={videoRef} muted playsInline />
      <canvas ref={canvasRef} />
      {!active && <div className="overlay-message">Camera is off</div>}
      {active && status !== 'Ready' && <div className="overlay-message">{status}</div>}
    </div>
  );
}

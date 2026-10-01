export default function About() {
  return (
    <main>
      <h1>About This Project</h1>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Problem</h3>
        <p style={{ color: 'var(--text-secondary)' }}>
          Driver fatigue and drowsiness can contribute to road accidents, and drivers
          often fail to notice their own declining alertness in time.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Solution</h3>
        <p style={{ color: 'var(--text-secondary)' }}>
          A camera-based Driver Monitoring System that analyzes facial behavior in real
          time — eye closure, blinking, yawning, and head pose — entirely inside the
          browser, and surfaces a "Possible Drowsiness Detected" style warning.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Technologies</h3>
        <ul style={{ color: 'var(--text-secondary)' }}>
          <li>React + TypeScript + Vite</li>
          <li>MediaPipe Face Landmarker (Tasks Vision)</li>
          <li>Browser Webcam API (getUserMedia)</li>
          <li>Local or Firebase authentication</li>
        </ul>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Features</h3>
        <ul style={{ color: 'var(--text-secondary)' }}>
          <li>Real-time eye and mouth landmark detection</li>
          <li>Personalized Eye Aspect Ratio (EAR) calibration</li>
          <li>Blink detection with minimum/maximum duration filtering</li>
          <li>Mouth Aspect Ratio (MAR) based yawn detection</li>
          <li>Head pose (pitch/yaw/roll) estimation</li>
          <li>Prototype Drowsiness Index (0-100, multi-signal, temporal)</li>
          <li>Progressive alert levels with driver response check</li>
          <li>Software-only emergency event logging</li>
          <li>Local session history, never uploaded</li>
        </ul>
      </div>

      <div className="disclaimer-banner">
        This is a student research prototype and not a certified automotive safety
        system. It cannot medically diagnose fatigue and cannot guarantee accident
        prevention. Do not rely on it as a sole safety measure while driving.
      </div>
    </main>
  );
}

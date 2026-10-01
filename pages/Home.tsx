import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user } = useAuth();

  return (
    <main>
      <div className="hero">
        <h1>Driver Monitoring System</h1>
        <p>
          A browser-based prototype that watches for signs of possible drowsiness using
          your webcam — entirely processed on your device. This is a student research
          prototype, not a certified automotive safety system, and does not diagnose
          fatigue or guarantee accident prevention.
        </p>
        <Link to={user ? '/dashboard' : '/register'} className="btn btn-primary">
          {user ? 'Go to Dashboard' : 'Get Started'}
        </Link>
      </div>

      <div className="grid grid-cols-3">
        <div className="card">
          <h3>Real-Time Analysis</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            MediaPipe facial landmarks detect eye closure, yawning, and head pose live in
            your browser, at roughly 20-30 FPS.
          </p>
        </div>
        <div className="card">
          <h3>Personalized Calibration</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            A short calibration step learns your own baseline eye openness instead of
            assuming one threshold fits everyone.
          </p>
        </div>
        <div className="card">
          <h3>Private by Design</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            Camera video, face images, and landmarks never leave your device. Only
            summary session statistics are stored, locally.
          </p>
        </div>
      </div>
    </main>
  );
}

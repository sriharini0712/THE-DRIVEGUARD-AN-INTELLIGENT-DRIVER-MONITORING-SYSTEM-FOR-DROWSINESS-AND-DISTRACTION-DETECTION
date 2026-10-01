import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_CALIBRATION } from '../utils/calibration';

export default function Profile() {
  const { user, logout } = useAuth();
  const [audioDefault, setAudioDefault] = useState(true);

  // The most recent calibration is currently session-scoped (in Monitoring.tsx).
  // A persisted-per-user calibration could be added by writing/reading it here
  // via localStorage keyed by user.uid, following the same pattern as storage.ts.
  if (!user) return null;

  return (
    <main>
      <h1>Profile & Settings</h1>

      <div className="card" style={{ maxWidth: 520 }}>
        <h3 style={{ marginTop: 0 }}>Account</h3>
        <p><strong>Name:</strong> {user.name}</p>
        <p><strong>Email:</strong> {user.email}</p>
        <button className="btn btn-outline" onClick={logout}>Logout</button>
      </div>

      <div className="card" style={{ maxWidth: 520, marginTop: 20 }}>
        <h3 style={{ marginTop: 0 }}>Calibration</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          {`No saved calibration yet — you'll be prompted on the Monitoring page. Default fallback threshold: ${DEFAULT_CALIBRATION.closureThreshold}.`}
        </p>
      </div>

      <div className="card" style={{ maxWidth: 520, marginTop: 20 }}>
        <h3 style={{ marginTop: 0 }}>Alert Preferences</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.9rem' }}>
          <input
            type="checkbox"
            checked={audioDefault}
            onChange={(e) => setAudioDefault(e.target.checked)}
            style={{ width: 'auto' }}
          />
          Enable audio alerts by default when starting a monitoring session
        </label>
      </div>

      <div className="card" style={{ maxWidth: 520, marginTop: 20 }}>
        <h3 style={{ marginTop: 0 }}>Privacy</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 0 }}>
          Camera processing is performed locally in your browser. Video is not uploaded
          or stored. Only aggregate session statistics are saved, on this device.
        </p>
      </div>
    </main>
  );
}

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSessions, SessionSummary } from '../utils/storage';

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function badgeClass(status: SessionSummary['status']) {
  switch (status) {
    case 'Low': return 'badge badge-low';
    case 'Moderate': return 'badge badge-moderate';
    case 'High': return 'badge badge-high';
    case 'Critical': return 'badge badge-critical';
  }
}

export default function History() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<SessionSummary | null>(null);

  if (!user) return null;
  const sessions = getSessions(user.uid);

  return (
    <main>
      <h1>Session History</h1>

      {sessions.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
            No monitoring sessions recorded yet.
          </p>
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Duration</th>
                <th>Blinks</th>
                <th>Yawns</th>
                <th>Warnings</th>
                <th>Max Index</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(s)}>
                  <td>{new Date(s.date).toLocaleString()}</td>
                  <td>{formatDuration(s.durationSeconds)}</td>
                  <td>{s.blinkCount}</td>
                  <td>{s.yawnCount}</td>
                  <td>{s.warningCount}</td>
                  <td>{s.maxDrowsinessIndex}</td>
                  <td><span className={badgeClass(s.status)}>{s.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="card" style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Session Detail — {new Date(selected.date).toLocaleString()}</h3>
            <button className="btn btn-outline" onClick={() => setSelected(null)}>Close</button>
          </div>
          <div className="grid grid-cols-3" style={{ marginTop: 16 }}>
            <div><div className="metric-label">Duration</div><div className="metric-value" style={{ fontSize: '1.3rem' }}>{formatDuration(selected.durationSeconds)}</div></div>
            <div><div className="metric-label">Average EAR</div><div className="metric-value" style={{ fontSize: '1.3rem' }}>{selected.averageEAR}</div></div>
            <div><div className="metric-label">Lowest EAR</div><div className="metric-value" style={{ fontSize: '1.3rem' }}>{selected.lowestEAR}</div></div>
            <div><div className="metric-label">Longest Eye Closure</div><div className="metric-value" style={{ fontSize: '1.3rem' }}>{selected.longestEyeClosureSec}s</div></div>
            <div><div className="metric-label">Blinks</div><div className="metric-value" style={{ fontSize: '1.3rem' }}>{selected.blinkCount}</div></div>
            <div><div className="metric-label">Yawns</div><div className="metric-value" style={{ fontSize: '1.3rem' }}>{selected.yawnCount}</div></div>
            <div><div className="metric-label">Average MAR</div><div className="metric-value" style={{ fontSize: '1.3rem' }}>{selected.averageMAR}</div></div>
            <div><div className="metric-label">Maximum MAR</div><div className="metric-value" style={{ fontSize: '1.3rem' }}>{selected.maxMAR}</div></div>
            <div><div className="metric-label">Average Head Pitch</div><div className="metric-value" style={{ fontSize: '1.3rem' }}>{selected.averageHeadPitch}°</div></div>
            <div><div className="metric-label">Max Downward Pitch</div><div className="metric-value" style={{ fontSize: '1.3rem' }}>{selected.maxDownwardPitch}°</div></div>
            <div><div className="metric-label">Warnings</div><div className="metric-value" style={{ fontSize: '1.3rem' }}>{selected.warningCount}</div></div>
            <div><div className="metric-label">Max Drowsiness Index</div><div className="metric-value" style={{ fontSize: '1.3rem' }}>{selected.maxDrowsinessIndex}</div></div>
          </div>
          <div style={{ marginTop: 16 }}>
            <span className={badgeClass(selected.status)}>{selected.status}</span>
          </div>
        </div>
      )}
    </main>
  );
}

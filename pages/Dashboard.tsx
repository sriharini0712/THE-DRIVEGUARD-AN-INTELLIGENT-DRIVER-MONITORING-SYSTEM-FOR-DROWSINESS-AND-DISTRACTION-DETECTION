import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { computeAggregateStats, getSessions } from '../utils/storage';
import MetricCard from '../components/MetricCard';

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function Dashboard() {
  const { user } = useAuth();
  if (!user) return null;

  const stats = computeAggregateStats(user.uid);
  const sessions = getSessions(user.uid);

  return (
    <main>
      <h1>Welcome, {user.name}</h1>
      <p style={{ color: 'var(--text-secondary)', marginTop: -8 }}>
        Here's a summary of your monitoring activity.
      </p>

      <div className="grid grid-cols-3" style={{ marginTop: 24 }}>
        <MetricCard label="Monitoring Sessions" value={stats.totalSessions} />
        <MetricCard label="Total Monitoring Time" value={formatDuration(stats.totalTimeSeconds)} />
        <MetricCard label="Drowsiness Alerts" value={stats.totalAlerts} />
        <MetricCard label="Yawns Detected" value={stats.totalYawns} />
        <MetricCard label="Blink Count" value={stats.totalBlinks} />
        <MetricCard label="Average EAR" value={stats.avgEAR ? stats.avgEAR.toFixed(3) : '—'} />
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 28, flexWrap: 'wrap' }}>
        <Link to="/monitoring" className="btn btn-primary" style={{ fontSize: '1.05rem', padding: '16px 30px' }}>
          Start Driver Monitoring
        </Link>
        <Link to="/history" className="btn btn-outline" style={{ fontSize: '1.05rem', padding: '16px 30px' }}>
          View Session History
        </Link>
      </div>

      {sessions.length === 0 && (
        <div className="card" style={{ marginTop: 28 }}>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
            No monitoring sessions yet. Start your first session to see your stats here.
          </p>
        </div>
      )}
    </main>
  );
}

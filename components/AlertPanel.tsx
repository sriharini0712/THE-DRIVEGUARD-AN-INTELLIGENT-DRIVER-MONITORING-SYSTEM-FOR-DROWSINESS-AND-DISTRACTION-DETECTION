export type AlertLevel = 0 | 1 | 2 | 3;

interface Props {
  level: AlertLevel;
  awaitingResponse: boolean;
  audioOn: boolean;
  onToggleAudio: () => void;
  onConfirmAlert: () => void;
  emergencyTriggered: boolean;
}

const LEVEL_INFO: Record<AlertLevel, { label: string; color: string; message: string }> = {
  0: { label: 'Normal', color: 'var(--safe)', message: 'Driver appears alert.' },
  1: { label: 'Attention Warning', color: 'var(--warning)', message: 'Slight signs of reduced alertness detected.' },
  2: { label: 'Possible Drowsiness', color: 'var(--moderate)', message: 'Possible Drowsiness Detected — please stay alert.' },
  3: { label: 'High Drowsiness', color: 'var(--critical)', message: 'High Drowsiness Detected — consider stopping to rest.' }
};

export default function AlertPanel({
  level,
  awaitingResponse,
  audioOn,
  onToggleAudio,
  onConfirmAlert,
  emergencyTriggered
}: Props) {
  const info = LEVEL_INFO[level];

  return (
    <div className="card alert-box" style={{ borderColor: info.color }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="status-pill" style={{ color: info.color }}>
          <span className="status-dot" style={{ background: info.color, boxShadow: `0 0 6px ${info.color}` }} />
          Level {level}: {info.label}
        </span>
        <button className="btn btn-outline" onClick={onToggleAudio}>
          Audio Alert: {audioOn ? 'ON' : 'OFF'}
        </button>
      </div>
      <p style={{ marginBottom: 0, color: 'var(--text-secondary)' }}>{info.message}</p>

      {awaitingResponse && (
        <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={onConfirmAlert}>I am Alert</button>
          <button className="btn btn-outline" onClick={onConfirmAlert}>Continue Monitoring</button>
        </div>
      )}

      {emergencyTriggered && (
        <div style={{ marginTop: 14, padding: 12, background: 'rgba(239,68,68,0.12)', borderRadius: 8 }}>
          <strong style={{ color: 'var(--critical)' }}>Emergency Condition (Prototype)</strong>
          <p style={{ marginBottom: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            The driver has remained unresponsive after repeated warnings. In a real
            deployment this would notify a configured contact — this student prototype
            only logs the event locally and does not contact emergency services or
            control any vehicle.
          </p>
        </div>
      )}
    </div>
  );
}

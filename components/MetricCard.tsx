interface Props {
  label: string;
  value: string | number;
  suffix?: string;
}

export default function MetricCard({ label, value, suffix }: Props) {
  return (
    <div className="card metric-card">
      <span className="metric-label">{label}</span>
      <span className="metric-value">
        {value}
        {suffix && <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginLeft: 4 }}>{suffix}</span>}
      </span>
    </div>
  );
}

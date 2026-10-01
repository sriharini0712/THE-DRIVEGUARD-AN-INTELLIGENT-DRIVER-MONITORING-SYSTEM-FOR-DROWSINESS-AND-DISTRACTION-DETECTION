import { DrowsinessLevel } from '../services/drowsiness';

interface Props {
  index: number;
  level: DrowsinessLevel;
}

const levelColor: Record<DrowsinessLevel, string> = {
  Low: 'var(--safe)',
  Moderate: 'var(--warning)',
  High: 'var(--moderate)',
  Critical: 'var(--critical)'
};

export default function DrowsinessGauge({ index, level }: Props) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(index, 100) / 100) * circumference;
  const color = levelColor[level];

  return (
    <div className="gauge-wrap">
      <svg width="180" height="180" viewBox="0 0 180 180">
        <circle cx="90" cy="90" r={radius} fill="none" stroke="#232f45" strokeWidth="14" />
        <circle
          cx="90"
          cy="90"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 90 90)"
          style={{ transition: 'stroke-dashoffset 0.3s ease' }}
        />
        <text x="90" y="84" textAnchor="middle" fontSize="34" fontWeight="700" fill="var(--text-primary)">
          {index}
        </text>
        <text x="90" y="108" textAnchor="middle" fontSize="13" fill="var(--text-secondary)">
          / 100
        </text>
      </svg>
      <span className="status-pill" style={{ color }}>
        <span className="status-dot" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
        {level} — Prototype Drowsiness Index
      </span>
    </div>
  );
}

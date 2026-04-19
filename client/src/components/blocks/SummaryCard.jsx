import React from 'react';

const STATUS_COLORS = {
  good: 'var(--accent)',
  warning: 'var(--amber)',
  critical: 'var(--red)',
};

const STATUS_LABELS = {
  good: 'Correcto',
  warning: 'Advertencia',
  critical: 'Critico',
};

export default function SummaryCard({ block }) {
  const { title, status = 'good', statusText, highlights = [], stats = [] } = block;
  const color = STATUS_COLORS[status] || STATUS_COLORS.good;

  return (
    <div className="sb-summary">
      <div className="sb-summary-header">
        <span className="sb-summary-title">{title || 'Resumen'}</span>
        <div className="sb-summary-status">
          <span className="sb-summary-dot" style={{ backgroundColor: color }} />
          <span style={{ color }}>{statusText || STATUS_LABELS[status] || status}</span>
        </div>
      </div>

      {highlights.length > 0 && (
        <ul className="sb-summary-highlights">
          {highlights.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}

      {stats.length > 0 && (
        <div className="sb-summary-stats">
          {stats.map((stat, i) => (
            <span key={i} className="sb-summary-chip">
              <span className="sb-summary-chip-label">{stat.label}:</span>{' '}
              <span className="sb-summary-chip-value">{stat.value}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

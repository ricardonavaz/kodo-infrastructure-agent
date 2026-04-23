import React from 'react';

const STATUS_LABELS = {
  good: 'Correcto',
  warning: 'Advertencia',
  critical: 'Critico',
};

export default function SummaryCard({ block }) {
  const { title, status = 'good', statusText, highlights = [], stats = [] } = block;

  return (
    <div className="sb-summary">
      <div className="sb-summary-header">
        <span className="sb-summary-title">{title || 'Resumen'}</span>
        <span className="sb-status-badge" data-status={status}>
          {statusText || STATUS_LABELS[status] || status}
        </span>
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

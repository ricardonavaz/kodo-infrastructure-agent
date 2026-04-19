import React from 'react';

const STATUS_COLORS = {
  good: 'var(--accent)',
  warning: 'var(--amber)',
  critical: 'var(--red)',
  normal: 'var(--text-secondary)',
};

export default function MetricBlock({ block }) {
  const { metrics = [] } = block;

  return (
    <div className="sb-metric-grid">
      {metrics.map((metric, i) => {
        const color = STATUS_COLORS[metric.status] || STATUS_COLORS.normal;
        const isPercentage = metric.unit === '%' || metric.unit === 'percent';
        const numericValue = parseFloat(metric.value);

        return (
          <div key={i} className="sb-metric-card" style={{ borderTopColor: color }}>
            <span className="sb-metric-label">{metric.label}</span>
            <span className="sb-metric-value" style={{ color }}>
              {metric.value}
              {metric.unit && <span className="sb-metric-unit">{metric.unit}</span>}
            </span>
            {isPercentage && !isNaN(numericValue) && (
              <div className="sb-metric-bar">
                <div
                  className="sb-metric-bar-fill"
                  style={{
                    width: `${Math.min(100, Math.max(0, numericValue))}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

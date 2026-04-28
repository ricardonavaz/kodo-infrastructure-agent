import React from 'react';
import { formatMessage, inlineFormat } from '../../utils/formatMessage.jsx';

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
        <span
          className="sb-summary-title"
          dangerouslySetInnerHTML={{ __html: inlineFormat(title || 'Resumen') }}
        />
        <span className="sb-status-badge" data-status={status}>
          <span dangerouslySetInnerHTML={{ __html: inlineFormat(statusText || STATUS_LABELS[status] || status) }} />
        </span>
      </div>

      {highlights.length > 0 && (
        <ul className="sb-summary-highlights">
          {highlights.map((item, i) => (
            <li
              key={i}
              dangerouslySetInnerHTML={{ __html: formatMessage(item) }}
            />
          ))}
        </ul>
      )}

      {stats.length > 0 && (
        <div className="sb-summary-stats">
          {stats.map((stat, i) => (
            <span key={i} className="sb-summary-chip">
              <span
                className="sb-summary-chip-label"
                dangerouslySetInnerHTML={{ __html: inlineFormat(`${stat.label}:`) }}
              />{' '}
              <span
                className="sb-summary-chip-value"
                dangerouslySetInnerHTML={{ __html: inlineFormat(String(stat.value)) }}
              />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

import React from 'react';

const PRIORITY_COLORS = {
  high: 'var(--red)',
  medium: 'var(--amber)',
  low: 'var(--accent)',
};

const PRIORITY_LABELS = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

export default function Recommendation({ block, onAction }) {
  const { description, priority = 'medium', risk, command } = block;
  const color = PRIORITY_COLORS[priority] || PRIORITY_COLORS.medium;

  const handleExecute = () => {
    if (onAction && command) onAction('execute', command);
  };

  return (
    <div className="sb-recommendation">
      <div className="sb-recommendation-header">
        <span className="sb-priority-badge" style={{ backgroundColor: color }}>
          {PRIORITY_LABELS[priority] || priority}
        </span>
      </div>

      <p className="sb-recommendation-desc">{description}</p>

      {risk && (
        <div className="sb-recommendation-risk">
          <span className="sb-recommendation-risk-label">Riesgo:</span> {risk}
        </div>
      )}

      {command && (
        <div className="sb-recommendation-action">
          <code className="sb-recommendation-cmd">{command}</code>
          <button className="sb-code-btn sb-code-exec" onClick={handleExecute}>
            Ejecutar
          </button>
        </div>
      )}
    </div>
  );
}

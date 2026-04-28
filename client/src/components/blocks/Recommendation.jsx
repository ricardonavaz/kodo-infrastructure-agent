import React from 'react';
import { formatMessage, inlineFormat } from '../../utils/formatMessage.jsx';

const PRIORITY_LABELS = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

export default function Recommendation({ block, onAction }) {
  const { description, priority = 'medium', risk, command } = block;

  const handleExecute = () => {
    if (onAction && command) onAction('execute', command);
  };

  return (
    <div className="sb-recommendation">
      <div className="sb-recommendation-header">
        <span className="sb-priority-badge" data-priority={priority}>
          {PRIORITY_LABELS[priority] || priority}
        </span>
      </div>

      <div
        className="sb-recommendation-desc"
        dangerouslySetInnerHTML={{ __html: formatMessage(description) }}
      />

      {risk && (
        <div className="sb-recommendation-risk">
          <span className="sb-recommendation-risk-label">Riesgo:</span>{' '}
          <span dangerouslySetInnerHTML={{ __html: inlineFormat(risk) }} />
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

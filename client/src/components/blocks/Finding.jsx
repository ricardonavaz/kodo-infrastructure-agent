import React, { useState } from 'react';
import { formatMessage, inlineFormat } from '../../utils/formatMessage.jsx';

const SEVERITY_CLASSES = {
  critical: 'sb-finding-critical',
  high: 'sb-finding-high',
  medium: 'sb-finding-medium',
  low: 'sb-finding-low',
};

const SEVERITY_LABELS = {
  critical: 'Critico',
  high: 'Alto',
  medium: 'Medio',
  low: 'Bajo',
};

export default function Finding({ block }) {
  const { title, severity = 'medium', description, impact, evidence, remediation } = block;
  const [showImpact, setShowImpact] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);

  const severityClass = SEVERITY_CLASSES[severity] || SEVERITY_CLASSES.medium;

  return (
    <div className={`sb-finding ${severityClass}`}>
      <div className="sb-finding-header">
        <span className="sb-severity-badge" data-severity={severity}>
          {SEVERITY_LABELS[severity] || severity}
        </span>
        <span
          className="sb-finding-title"
          dangerouslySetInnerHTML={{ __html: inlineFormat(title || '') }}
        />
      </div>

      {description && (
        <div
          className="sb-finding-desc"
          dangerouslySetInnerHTML={{ __html: formatMessage(description) }}
        />
      )}

      {impact && (
        <div className="sb-finding-section">
          <button
            className="sb-finding-toggle"
            onClick={() => setShowImpact(!showImpact)}
          >
            {showImpact ? '▾' : '▸'} Impacto
          </button>
          {showImpact && (
            <div
              className="sb-finding-content"
              dangerouslySetInnerHTML={{ __html: formatMessage(impact) }}
            />
          )}
        </div>
      )}

      {evidence && (
        <div className="sb-finding-section">
          <button
            className="sb-finding-toggle"
            onClick={() => setShowEvidence(!showEvidence)}
          >
            {showEvidence ? '▾' : '▸'} Evidencia
          </button>
          {showEvidence && (
            <pre className="sb-finding-evidence">{evidence}</pre>
          )}
        </div>
      )}

      {remediation && (
        <div className="sb-finding-remediation">
          <strong>Remediacion:</strong>
          <div dangerouslySetInnerHTML={{ __html: formatMessage(remediation) }} />
        </div>
      )}
    </div>
  );
}

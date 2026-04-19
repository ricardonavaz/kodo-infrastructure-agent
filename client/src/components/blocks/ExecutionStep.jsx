import React, { useState } from 'react';

export default function ExecutionStep({ block }) {
  const { command, exitCode, duration, stdout, stderr } = block;
  const stdoutLines = stdout ? stdout.split('\n') : [];
  const isLong = stdoutLines.length > 10;
  const [expanded, setExpanded] = useState(!isLong);

  const exitOk = exitCode === 0;

  return (
    <div className="sb-exec-step">
      <div className="sb-exec-header">
        <span className="sb-exec-command">$ {command}</span>
        <div className="sb-exec-meta">
          {duration !== undefined && duration !== null && (
            <span className="sb-exec-duration">{duration}</span>
          )}
          {exitCode !== undefined && exitCode !== null && (
            <span className={`sb-exit-code ${exitOk ? 'sb-exit-ok' : 'sb-exit-err'}`}>
              {exitOk ? 'OK' : `Exit ${exitCode}`}
            </span>
          )}
        </div>
      </div>

      {stdout && (
        <div className="sb-exec-output">
          {isLong && (
            <button
              className="sb-exec-toggle"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? '▾ Ocultar salida' : `▸ Mostrar salida (${stdoutLines.length} lineas)`}
            </button>
          )}
          {expanded && <pre className="sb-exec-stdout">{stdout}</pre>}
        </div>
      )}

      {stderr && (
        <pre className="sb-exec-stderr">{stderr}</pre>
      )}
    </div>
  );
}

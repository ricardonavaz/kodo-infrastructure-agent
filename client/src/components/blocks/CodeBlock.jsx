import React, { useState } from 'react';

export default function CodeBlock({ block, onAction }) {
  const [copied, setCopied] = useState(false);
  const { code, language, executable } = block;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available */
    }
  };

  const handleExecute = () => {
    if (onAction) onAction('execute', code);
  };

  return (
    <div className="sb-code-block">
      <div className="sb-code-toolbar">
        <span className="sb-code-lang">{language || 'texto'}</span>
        <div className="sb-code-actions">
          <button className="sb-code-btn" onClick={handleCopy}>
            {copied ? '✓ Copiado' : 'Copiar'}
          </button>
          {executable && (
            <button className="sb-code-btn sb-code-exec" onClick={handleExecute}>
              Ejecutar
            </button>
          )}
        </div>
      </div>
      <pre className="sb-code-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}

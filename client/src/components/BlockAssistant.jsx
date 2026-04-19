import React, { useState, useEffect } from 'react';
import { api } from '../hooks/useApi.js';

export default function BlockAssistant({ connectionId, block, action, context, onClose }) {
  const [loading, setLoading] = useState(true);
  const [explanation, setExplanation] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchExplanation() {
      try {
        setLoading(true);
        setError(null);
        const result = await api.explainBlock(connectionId, {
          blockType: block.type,
          blockData: block,
          action,
          context,
        });
        if (!cancelled) {
          setExplanation(result.explanation || result.text || JSON.stringify(result));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Error al obtener la explicacion');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchExplanation();
    return () => { cancelled = true; };
  }, [connectionId, block, action, context]);

  return (
    <div className="sb-assistant">
      <div className="sb-assistant-header">
        <span className="sb-assistant-title">Explicacion</span>
        <button className="sb-assistant-close" onClick={onClose}>
          &times;
        </button>
      </div>

      {loading && (
        <div className="sb-assistant-loading">
          <span className="sb-assistant-spinner" />
          Analizando...
        </div>
      )}

      {error && (
        <div className="sb-assistant-error">{error}</div>
      )}

      {!loading && !error && (
        <div className="sb-assistant-content">{explanation}</div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { api } from '../hooks/useApi.js';

export default function InitialActions({ connectionId, onAction, disabled }) {
  const [actions, setActions] = useState([]);
  const [reprofiling, setReprofiling] = useState(false);

  useEffect(() => {
    if (connectionId) {
      api.getInitialActions(connectionId).then(setActions).catch(() => setActions([]));
    }
  }, [connectionId]);

  const handleReprofile = async () => {
    setReprofiling(true);
    try {
      await api.refreshProfile(connectionId);
      onAction('[SYSTEM] Profile actualizado exitosamente. Puedes verlo en el boton de info del servidor.');
    } catch (e) {
      onAction(`[SYSTEM] Error al re-escanear: ${e.message}`);
    }
    setReprofiling(false);
  };

  if (actions.length === 0) return null;

  return (
    <div className="initial-actions">
      <p className="initial-actions-title">Acciones rapidas</p>
      <div className="initial-actions-grid">
        {actions.map((action) => (
          <button
            key={action.id}
            className="initial-action-btn"
            onClick={() => onAction(action.prompt)}
            disabled={disabled}
            title={action.prompt}
          >
            <span className="ia-icon">{action.icon}</span>
            <span className="ia-label">{action.label}</span>
          </button>
        ))}
        <button
          className="initial-action-btn"
          onClick={handleReprofile}
          disabled={disabled || reprofiling}
          title="Ejecutar escaneo completo del servidor (reset de profile)"
        >
          <span className="ia-icon">{reprofiling ? '...' : '🔍'}</span>
          <span className="ia-label">{reprofiling ? 'Escaneando...' : 'Re-escanear Profile'}</span>
        </button>
      </div>
    </div>
  );
}

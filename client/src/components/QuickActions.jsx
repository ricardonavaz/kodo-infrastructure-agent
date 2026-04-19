import React, { useState, useEffect } from 'react';
import { api } from '../hooks/useApi.js';

export default function QuickActions({ connectionId, onAction, disabled }) {
  const [open, setOpen] = useState(false);
  const [actions, setActions] = useState([]);

  useEffect(() => {
    if (connectionId) {
      api.getInitialActions(connectionId).then(setActions).catch(() => setActions([]));
    }
  }, [connectionId]);

  if (!connectionId || actions.length === 0) return null;

  const handleAction = (prompt) => {
    setOpen(false);
    onAction(prompt);
  };

  return (
    <div className="quick-actions-container">
      {open && (
        <div className="quick-actions-menu">
          {actions.map((a) => (
            <button
              key={a.id}
              className="quick-action-item"
              onClick={() => handleAction(a.prompt)}
              disabled={disabled}
            >
              <span className="qa-icon">{a.icon}</span>
              <span className="qa-label">{a.label}</span>
            </button>
          ))}
        </div>
      )}
      <button
        className={`quick-actions-fab ${open ? 'open' : ''}`}
        onClick={() => setOpen(!open)}
        title="Acciones rapidas"
      >
        {open ? '✕' : '⚡'}
      </button>
    </div>
  );
}

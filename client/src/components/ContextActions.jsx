import React, { useState } from 'react';

export default function ContextActions({ actions = [], onAction }) {
  const [open, setOpen] = useState(false);

  const handleAction = (action) => {
    setOpen(false);
    if (onAction) onAction(action);
  };

  return (
    <div className="sb-context-menu-container">
      <button
        className="sb-context-trigger"
        onClick={() => setOpen(!open)}
        title="Mas opciones"
      >
        &#8230;
      </button>

      {open && (
        <>
          <div className="sb-context-overlay" onClick={() => setOpen(false)} />
          <div className="sb-context-menu">
            {actions.map((item, i) => (
              <button
                key={i}
                className="sb-context-item"
                onClick={() => handleAction(item.action)}
              >
                {item.icon && <span className="sb-context-icon">{item.icon}</span>}
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

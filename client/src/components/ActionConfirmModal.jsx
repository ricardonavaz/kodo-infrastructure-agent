import React, { useEffect } from 'react';

export default function ActionConfirmModal({
  open,
  actionText,
  serverName,
  onCancel,
  onEdit,
  onSend,
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="action-modal-overlay" onClick={onCancel}>
      <div
        className="action-modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="action-modal-header">
          ⚡ Confirmar accion
        </div>

        <div className="action-modal-body">
          <div className="action-modal-label">Enviar al agente:</div>
          <div className="action-modal-text">"{actionText}"</div>
          {serverName && (
            <div className="action-modal-server">
              En servidor: <strong>{serverName}</strong>
            </div>
          )}
        </div>

        <div className="action-modal-actions">
          <button
            type="button"
            className="action-modal-btn action-modal-btn-cancel"
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="action-modal-btn action-modal-btn-edit"
            onClick={onEdit}
          >
            Editar
          </button>
          <button
            type="button"
            className="action-modal-btn action-modal-btn-send"
            onClick={onSend}
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}

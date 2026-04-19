import React from 'react';

// Runtime statuses (SSH connection state) override persistent statuses
// Runtime: connected, connecting, disconnected, error
// Persistent: ok, warning, unreachable, invalid_credentials, pending_review
export default function ServerStatus({ runtimeStatus, persistentStatus }) {
  // Runtime takes priority when actively connected/connecting
  const status = runtimeStatus === 'connected' || runtimeStatus === 'connecting' || runtimeStatus === 'error'
    ? runtimeStatus
    : persistentStatus || 'pending_review';

  return <div className={`status-dot ${status}`} title={status} />;
}

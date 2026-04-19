import React, { useState, useEffect } from 'react';

export default function SessionBanner({ session, onEndSession }) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (!session?.started_at) return;
    const update = () => {
      const ms = Date.now() - new Date(session.started_at).getTime();
      const mins = Math.floor(ms / 60000);
      const hrs = Math.floor(mins / 60);
      setElapsed(hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`);
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [session?.started_at]);

  if (!session) return null;

  return (
    <div className="session-banner">
      <span className="session-dot" />
      <span className="session-info">
        Sesion activa: {elapsed} | {session.commands_count || 0} cmds | {session.successful_count || 0} ok
      </span>
      <button className="session-end-btn" onClick={onEndSession}>
        Finalizar sesion
      </button>
    </div>
  );
}

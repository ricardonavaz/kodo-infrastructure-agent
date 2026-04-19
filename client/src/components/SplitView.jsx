import React, { useState, useRef, useEffect, useCallback } from 'react';
import Terminal from './Terminal.jsx';
import ExecutionPanel from './ExecutionPanel.jsx';

export default function SplitView({ connection, connectionStatus, connectionLogs, sessionId, briefing, onShowProfile, userRole }) {
  const [splitRatio, setSplitRatio] = useState(() => {
    const saved = localStorage.getItem('kodo-split-ratio');
    return saved ? parseFloat(saved) : 0.55;
  });
  const [showPanel, setShowPanel] = useState(true);
  const [executions, setExecutions] = useState([]);
  const [liveEvents, setLiveEvents] = useState([]);
  const [activeTab, setActiveTab] = useState('live');
  const isDragging = useRef(false);
  const containerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('kodo-split-ratio', splitRatio.toString());
  }, [splitRatio]);

  // Reset panel state when switching servers
  useEffect(() => {
    setLiveEvents([]);
    setExecutions([]);
    setActiveTab('live');
  }, [connection?.id]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      setSplitRatio(Math.max(0.3, Math.min(0.8, ratio)));
    };
    const handleMouseUp = () => { isDragging.current = false; };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // When a new event arrives from streaming
  const handleLiveEvent = useCallback((event) => {
    setLiveEvents((prev) => [...prev, event]);

    // Auto-switch to live tab when events start arriving
    if (event.type === 'thinking') {
      setActiveTab('live');
      setShowPanel(true);
    }

    // When done, move executions to history
    if (event.type === 'done' && event.data?.executions) {
      setExecutions((prev) => [...event.data.executions, ...prev]);
    }
  }, []);

  // Clear live events when starting a new chat
  const handleNewChat = useCallback(() => {
    setLiveEvents([]);
    setActiveTab('live');
  }, []);

  const handleExecution = useCallback((exec) => {
    setExecutions((prev) => [exec, ...prev]);
  }, []);

  if (!connection) {
    return <Terminal connection={null} />;
  }

  return (
    <div className="split-view" ref={containerRef}>
      <div className="split-left" style={{ width: showPanel ? `${splitRatio * 100}%` : '100%' }}>
        <Terminal
          connection={connection}
          connectionStatus={connectionStatus}
          connectionLogs={connectionLogs}
          sessionId={sessionId}
          briefing={briefing}
          onExecution={handleExecution}
          onLiveEvent={handleLiveEvent}
          onNewChat={handleNewChat}
          onShowProfile={onShowProfile}
          userRole={userRole}
        />
      </div>

      {showPanel && (
        <>
          <div className="split-handle" onMouseDown={(e) => { isDragging.current = true; e.preventDefault(); }}>
            <div className="split-handle-line" />
          </div>
          <div className="split-right" style={{ width: `${(1 - splitRatio) * 100}%` }}>
            <ExecutionPanel
              liveEvents={liveEvents}
              executions={executions}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          </div>
        </>
      )}

      <button
        className="split-toggle"
        onClick={() => setShowPanel(!showPanel)}
        title={showPanel ? 'Ocultar panel' : 'Mostrar panel'}
      >
        {showPanel ? '»' : '«'}
      </button>
    </div>
  );
}

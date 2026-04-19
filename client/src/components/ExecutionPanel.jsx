import React, { useState, useRef, useEffect } from 'react';

const EVENT_CONFIG = {
  thinking: { icon: '◐', label: 'AI', className: 'evt-thinking' },
  ai_thinking_done: { icon: '✓', label: 'AI', className: 'evt-ai-done' },
  ai_text: { icon: '💬', label: 'Texto', className: 'evt-ai-text' },
  tool_use: { icon: '⚡', label: 'Comando', className: 'evt-tool-use' },
  executing: { icon: '▶', label: 'Ejecutando', className: 'evt-executing' },
  command_result: { icon: '●', label: 'Resultado', className: 'evt-result' },
  command_error: { icon: '✗', label: 'Error', className: 'evt-error' },
  ai_response: { icon: 'K', label: 'Respuesta', className: 'evt-response' },
  metrics: { icon: '📊', label: 'Metricas', className: 'evt-metrics' },
  done: { icon: '✓', label: 'Completado', className: 'evt-done' },
  error: { icon: '✗', label: 'Error', className: 'evt-error' },
  reconnecting: { icon: '↻', label: 'Reconectando', className: 'evt-reconnecting' },
};

function formatEventContent(event) {
  const { type, data } = event;
  switch (type) {
    case 'thinking':
      return data.message || 'Procesando...';
    case 'ai_thinking_done':
      return `Llamada #${data.apiCall} completada (${data.responseTimeMs}ms, ${data.inputTokens}↑ ${data.outputTokens}↓)`;
    case 'ai_text':
      return data.text?.substring(0, 100) + (data.text?.length > 100 ? '...' : '');
    case 'tool_use':
      return `${data.command}${data.isDestructive ? ' ⚠️ DESTRUCTIVO' : ''}`;
    case 'executing':
      return `${data.command} → ${data.server}`;
    case 'command_result':
      return `exit=${data.exitCode} (${data.executionTimeMs}ms)${data.timedOut ? ' TIMEOUT' : ''}`;
    case 'command_error':
      return data.error;
    case 'ai_response':
      return data.text?.substring(0, 150) + (data.text?.length > 150 ? '...' : '');
    case 'metrics':
      return `${data.model?.split('-').slice(1, 3).join(' ')} | ${data.inputTokens}↑ ${data.outputTokens}↓ | ${(data.totalLatencyMs / 1000).toFixed(1)}s | $${data.estimatedCost}`;
    case 'done':
      return 'Proceso completado';
    case 'error':
      return data.message || 'Error desconocido';
    case 'reconnecting':
      return 'Reconectando al job...';
    default:
      return JSON.stringify(data).substring(0, 100);
  }
}

function ExpandedContent({ event }) {
  const { type, data } = event;
  if (type === 'command_result' && (data.stdout || data.stderr)) {
    return (
      <div className="evt-expanded">
        {data.stdout && <pre className="evt-stdout">{data.stdout}</pre>}
        {data.stderr && <pre className="evt-stderr">{data.stderr}</pre>}
      </div>
    );
  }
  if (type === 'ai_response' && data.text) {
    return <div className="evt-expanded"><pre className="evt-stdout">{data.text}</pre></div>;
  }
  return null;
}

export default function ExecutionPanel({ liveEvents, executions, activeTab, onTabChange }) {
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [historyExpanded, setHistoryExpanded] = useState(null);
  const liveRef = useRef(null);

  useEffect(() => {
    if (liveRef.current && activeTab === 'live') {
      liveRef.current.scrollTop = liveRef.current.scrollHeight;
    }
  }, [liveEvents, activeTab]);

  const isProcessing = liveEvents?.length > 0 && !liveEvents.some((e) => e.type === 'done' || e.type === 'error');

  return (
    <div className="execution-panel">
      <div className="exec-header">
        <div className="exec-tabs">
          <button
            className={`exec-tab ${activeTab === 'live' ? 'active' : ''}`}
            onClick={() => onTabChange('live')}
          >
            En Vivo
            {isProcessing && <span className="tab-pulse" />}
          </button>
          <button
            className={`exec-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => onTabChange('history')}
          >
            Historial
          </button>
        </div>
      </div>

      {activeTab === 'live' ? (
        <div className="exec-list live-feed" ref={liveRef}>
          {(!liveEvents || liveEvents.length === 0) && (
            <div className="exec-empty">
              <p>Los eventos apareceran aqui en tiempo real cuando envies una instruccion.</p>
            </div>
          )}
          {liveEvents?.map((event, i) => {
            const config = EVENT_CONFIG[event.type] || { icon: '?', label: event.type, className: '' };
            const isLast = i === liveEvents.length - 1;
            const isActive = isLast && isProcessing && (event.type === 'thinking' || event.type === 'executing');
            const isExpanded = expandedIdx === i;

            return (
              <div
                key={i}
                className={`live-event ${config.className} ${isActive ? 'active' : ''} ${event.replayed ? 'replayed' : ''}`}
                onClick={() => setExpandedIdx(isExpanded ? null : i)}
              >
                <div className="live-event-header">
                  <span className="evt-icon">{config.icon}</span>
                  <span className="evt-label">{config.label}</span>
                  <span className="evt-content">{formatEventContent(event)}</span>
                  {isActive && <span className="evt-spinner" />}
                  {event.replayed && <span className="evt-replayed-badge">replay</span>}
                  <span className="evt-time">{event.data?.timestamp ? new Date(event.data.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString()}</span>
                </div>
                {isExpanded && <ExpandedContent event={event} />}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="exec-list">
          {(!executions || executions.length === 0) && (
            <div className="exec-empty">
              <p>Los comandos ejecutados apareceran aqui.</p>
            </div>
          )}
          {executions?.map((exec, i) => {
            const isExpanded = historyExpanded === i;
            const exitOk = exec.exitCode === 0 || exec.exitCode === null;

            return (
              <div key={i} className={`execution-row ${isExpanded ? 'expanded' : ''}`}>
                <div className="exec-row-header" onClick={() => setHistoryExpanded(isExpanded ? null : i)}>
                  <span className={`exit-code ${exitOk ? 'exit-code-0' : 'exit-code-error'}`}>
                    {exec.timedOut ? 'T/O' : exec.exitCode ?? '?'}
                  </span>
                  <span className="exec-command">{exec.command}</span>
                  <div className="exec-timing">
                    {exec.executionTimeMs > 0 && <span className="timing-badge">{exec.executionTimeMs}ms</span>}
                  </div>
                  <span className="exec-chevron">{isExpanded ? '▾' : '▸'}</span>
                </div>
                {isExpanded && (
                  <div className="exec-detail">
                    {exec.stdout && <div className="exec-output"><label>stdout:</label><pre>{exec.stdout}</pre></div>}
                    {exec.stderr && <div className="exec-output stderr"><label>stderr:</label><pre>{exec.stderr}</pre></div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

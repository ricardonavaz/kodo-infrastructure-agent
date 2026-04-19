import React, { useState, useRef, useEffect } from 'react';
import { api } from '../hooks/useApi.js';
import ModelSelector, { getModelLabel } from './ModelSelector.jsx';
import InitialActions from './InitialActions.jsx';
import SessionBanner from './SessionBanner.jsx';
import QuickActions from './QuickActions.jsx';
import SmartMessage from './SmartMessage.jsx';
import { DEFAULT_MODEL } from './ModelSelector.jsx';

// Inline formatting helper
function inlineFormat(str) {
  return str
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>');
}

// Rich markdown renderer with tables, clean ACTION filtering
function formatMessage(text) {
  if (!text) return '';

  // Remove [ACTION:...] lines from display (they become buttons separately)
  const cleanText = text.replace(/\[ACTION:\s*.+?\]\s*/g, '').trim();

  const parts = [];
  const lines = cleanText.split('\n');
  let inCodeBlock = false;
  let codeContent = [];
  let inList = false;
  let listItems = [];
  let listType = 'ul';
  let inTable = false;
  let tableHeaders = [];
  let tableRows = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      const Tag = listType === 'ol' ? 'ol' : 'ul';
      parts.push(
        <Tag key={key++} className="md-list">
          {listItems.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />
          ))}
        </Tag>
      );
      listItems = [];
      inList = false;
    }
  };

  const flushTable = () => {
    if (tableHeaders.length > 0 || tableRows.length > 0) {
      parts.push(
        <div key={key++} className="md-table-wrap">
          <table className="md-table">
            {tableHeaders.length > 0 && (
              <thead>
                <tr>{tableHeaders.map((h, i) => <th key={i} dangerouslySetInnerHTML={{ __html: inlineFormat(h) }} />)}</tr>
              </thead>
            )}
            <tbody>
              {tableRows.map((row, ri) => (
                <tr key={ri}>{row.map((cell, ci) => <td key={ci} dangerouslySetInnerHTML={{ __html: inlineFormat(cell) }} />)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableHeaders = [];
      tableRows = [];
      inTable = false;
    }
  };

  const parseTableRow = (line) => line.split('|').slice(1, -1).map((c) => c.trim());
  const isTableSeparator = (line) => /^\|[\s-:|]+\|$/.test(line.trim());
  const isTableRow = (line) => /^\|.+\|$/.test(line.trim());

  for (const line of lines) {
    // Code blocks
    if (line.startsWith('```')) {
      flushList(); flushTable();
      if (inCodeBlock) {
        parts.push(<pre key={key++} className="md-code"><code>{codeContent.join('\n')}</code></pre>);
        codeContent = [];
        inCodeBlock = false;
      } else { inCodeBlock = true; }
      continue;
    }
    if (inCodeBlock) { codeContent.push(line); continue; }

    const trimmed = line.trim();

    // Empty line
    if (!trimmed) { flushList(); flushTable(); parts.push(<div key={key++} className="md-spacer" />); continue; }

    // Table rows
    if (isTableRow(trimmed)) {
      flushList();
      if (isTableSeparator(trimmed)) { continue; } // skip separator row (|---|---|)
      const cells = parseTableRow(trimmed);
      if (!inTable) {
        tableHeaders = cells;
        inTable = true;
      } else {
        tableRows.push(cells);
      }
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Horizontal rule
    if (/^[-_*]{3,}$/.test(trimmed)) { flushList(); parts.push(<hr key={key++} className="md-hr" />); continue; }

    // Headers
    const headerMatch = trimmed.match(/^(#{1,4})\s+(.+)/);
    if (headerMatch) {
      flushList();
      const level = headerMatch[1].length;
      const content = headerMatch[2];
      const Tag = `h${level + 2}`;
      parts.push(<Tag key={key++} className={`md-h md-h${level}`} dangerouslySetInnerHTML={{ __html: inlineFormat(content) }} />);
      continue;
    }

    // Unordered list
    if (/^[-*+]\s+/.test(trimmed)) {
      if (!inList || listType !== 'ul') { flushList(); listType = 'ul'; }
      inList = true;
      listItems.push(trimmed.replace(/^[-*+]\s+/, ''));
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      if (!inList || listType !== 'ol') { flushList(); listType = 'ol'; }
      inList = true;
      listItems.push(trimmed.replace(/^\d+\.\s+/, ''));
      continue;
    }

    // Regular paragraph
    flushList();
    parts.push(<p key={key++} className="md-p" dangerouslySetInnerHTML={{ __html: inlineFormat(trimmed) }} />);
  }

  flushList();
  flushTable();
  if (inCodeBlock && codeContent.length) {
    parts.push(<pre key={key++} className="md-code"><code>{codeContent.join('\n')}</code></pre>);
  }

  return parts;
}

// Extract suggested actions from AI response
function extractSuggestedActions(text) {
  if (!text) return [];
  const actions = [];
  const actionPattern = /\[ACTION:\s*(.+?)\]/g;
  let match;
  while ((match = actionPattern.exec(text)) !== null) {
    actions.push(match[1].trim());
  }
  return actions.slice(0, 4);
}

// Export message as rich report
async function exportAsReport(msg, format = 'html', serverName = '') {
  try {
    const res = await fetch('/api/export/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: msg.content, metrics: msg.metrics, serverName, format }),
    });
    const text = await res.text();
    const ext = format === 'html' ? 'html' : format === 'md' ? 'md' : 'txt';
    const mime = format === 'html' ? 'text/html' : 'text/plain';
    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kodo-report-${new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-')}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  } catch { /* fallback to plain text */ }
}

const STATUS_CONFIG = {
  connected: { label: 'Conectado', className: 'status-banner connected' },
  connecting: { label: 'Conectando...', className: 'status-banner connecting' },
  disconnected: { label: 'Desconectado', className: 'status-banner disconnected' },
  error: { label: 'Error de conexion', className: 'status-banner error' },
};

export default function Terminal({ connection, connectionStatus, connectionLogs, sessionId, briefing, onExecution, onLiveEvent, onNewChat, onShowProfile, userRole }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionModel, setSessionModel] = useState(DEFAULT_MODEL);
  const [showMenu, setShowMenu] = useState(false);
  const [streamStatus, setStreamStatus] = useState(null); // null | 'thinking' | 'executing' | 'responding'
  const [reconnected, setReconnected] = useState(false);
  const [activeJobId, setActiveJobId] = useState(null);
  const terminalRef = useRef(null);

  const [activeSession, setActiveSession] = useState(null);
  const [briefingShown, setBriefingShown] = useState(false);

  const status = connectionStatus?.status || 'disconnected';
  const isConnected = status === 'connected';

  // Show briefing as first message when first connecting
  useEffect(() => {
    if (briefing && isConnected && !briefingShown) {
      setBriefingShown(true);
      setMessages((prev) => [{ role: 'assistant', content: briefing }, ...prev]);
    }
  }, [briefing, isConnected]);

  useEffect(() => {
    // Reset ALL state when switching servers
    setMessages([]);
    setInput('');
    setLoading(false);
    setStreamStatus(null);
    setActiveJobId(null);
    setActiveSession(null);
    setBriefingShown(false);

    if (connection) {
      api.getHistory(connection.id).then(setMessages).catch(() => setMessages([]));
      checkActiveJobs();
      api.getActiveSession(connection.id).then(setActiveSession).catch(() => setActiveSession(null));
    }
  }, [connection?.id]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [messages, loading, connectionLogs, streamStatus]);

  const [exporting, setExporting] = useState(false);

  const exportEnhanced = async (msg) => {
    setExporting(true);
    try {
      const res = await fetch('/api/export/enhanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: msg.content, metrics: msg.metrics,
          serverName: connection?.name, connectionId: connection?.id, format: 'html',
        }),
      });
      const text = await res.text();
      // Check if it's an error JSON
      if (res.headers.get('content-type')?.includes('application/json')) {
        const err = JSON.parse(text);
        throw new Error(err.error || 'Error generando reporte');
      }
      const blob = new Blob([text], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (e) { alert('Error al generar reporte: ' + e.message); }
    setExporting(false);
  };

  const handleCancel = async () => {
    if (!activeJobId || !connection) return;
    try {
      await api.cancelJob(connection.id, activeJobId);
    } catch { /* ignore */ }
    setLoading(false);
    setStreamStatus(null);
    setActiveJobId(null);
    setMessages((prev) => [...prev, { role: 'system', content: '⚠ Job cancelado por el usuario' }]);
  };

  const checkActiveJobs = async () => {
    if (!connection) return;
    try {
      const jobs = await api.getActiveJobs(connection.id);
      if (jobs.length > 0) {
        const job = jobs[0];
        setLoading(true);
        setActiveJobId(job.id);
        setReconnected(true);
        setStreamStatus('thinking');
        setTimeout(() => setReconnected(false), 3000);

        // Reconnect to the job stream
        await api.reconnectToJob(connection.id, job.id, (event) => {
          handleStreamEvent(event);
        });

        setLoading(false);
        setStreamStatus(null);
      }
    } catch { /* no active jobs */ }
  };

  const handleStreamEvent = (event) => {
    onLiveEvent?.(event);

    switch (event.type) {
      case 'thinking':
        setStreamStatus('thinking');
        break;
      case 'executing':
        setStreamStatus('executing');
        break;
      case 'ai_response':
        setStreamStatus('responding');
        break;
      case 'command_result':
        // Add command result inline in chat
        if (event.data) {
          setMessages((prev) => [...prev, {
            role: 'system',
            content: `$ ${event.data.command}\n${event.data.stdout || ''}${event.data.stderr ? `\n[stderr] ${event.data.stderr}` : ''}`,
          }]);
        }
        break;
      case 'done':
        if (event.data?.response) {
          setMessages((prev) => [...prev, {
            role: 'assistant',
            content: event.data.response,
            blocks: event.data.blocks || null,
            tags: event.data.tags || [],
            metrics: event.data.metrics,
          }]);
        }
        setLoading(false);
        setStreamStatus(null);
        setActiveJobId(null);
        break;
      case 'error':
      case 'cancelled':
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: event.type === 'cancelled'
            ? 'Job cancelado.'
            : `Error: ${event.data?.message || 'Error desconocido'}`,
        }]);
        setLoading(false);
        setStreamStatus(null);
        setActiveJobId(null);
        break;
    }
  };

  const handleSend = async () => {
    const msg = input.trim();
    if (!msg || loading || !isConnected) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setLoading(true);
    setStreamStatus('thinking');
    onNewChat?.();

    try {
      const { jobId } = await api.chatStream(connection.id, msg, sessionModel, handleStreamEvent, sessionId);
      setActiveJobId(jobId);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
      setLoading(false);
      setStreamStatus(null);
      setActiveJobId(null);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (suggestion) => {
    if (loading || !isConnected) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: suggestion }]);
    setLoading(true);
    setStreamStatus('thinking');
    onNewChat?.();

    api.chatStream(connection.id, suggestion, sessionModel, handleStreamEvent, sessionId)
      .then(({ jobId }) => setActiveJobId(jobId))
      .catch((err) => {
        setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
        setLoading(false);
        setStreamStatus(null);
        setActiveJobId(null);
      });
  };

  const handleInitialAction = (prompt) => {
    if (loading || !isConnected) return;
    handleSuggestionClick(prompt);
  };

  const handleEndSession = async () => {
    if (!activeSession) return;
    try {
      const result = await api.endSession(activeSession.id);
      setMessages((prev) => [...prev, {
        role: 'system',
        content: `📋 Sesion finalizada\n${result.summary || ''}`,
      }]);
      setActiveSession(null);
    } catch (err) {
      alert('Error cerrando sesion: ' + err.message);
    }
  };

  const handleClear = async () => {
    await api.clearHistory(connection.id);
    setMessages([]);
  };

  if (!connection) {
    return (
      <div className="main">
        <div className="no-server">
          <div className="logo-xl"><span className="logo-kodo">Kōdo</span></div>
          <p>Selecciona un servidor o agrega uno nuevo</p>
        </div>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.disconnected;

  const streamLabels = {
    thinking: 'Pensando...',
    executing: 'Ejecutando...',
    responding: 'Respondiendo...',
  };

  return (
    <div className="main">
      <div className="main-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>{connection.name}</h2>
          <div className={statusCfg.className}>
            {status === 'connecting' && <span className="spinner" />}
            {statusCfg.label}
          </div>
          <span className="header-meta">{connection.username}@{connection.host}:{connection.port}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
          <ModelSelector value={sessionModel} onChange={setSessionModel} compact />
          <button className="btn btn-secondary" onClick={handleClear} style={{ padding: '4px 10px', fontSize: 11 }} title="Limpiar historial de chat">Limpiar</button>
          <button className="btn btn-secondary" onClick={() => setShowMenu(!showMenu)} style={{ padding: '4px 8px', fontSize: 13 }} title="Menu de opciones">☰</button>

          {showMenu && (
            <>
              <div className="sb-context-overlay" onClick={() => setShowMenu(false)} />
              <div className="sb-context-menu" style={{ right: 0, top: '100%', marginTop: 4, minWidth: 220 }}>
                <div style={{ padding: '6px 12px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Servidor</div>
                <button className="sb-context-item" onClick={() => { setShowMenu(false); onShowProfile?.(); }}>
                  <span className="sb-context-item-icon">ℹ</span> Ver Profile
                </button>
                <button className="sb-context-item" onClick={async () => {
                  setShowMenu(false);
                  setMessages((prev) => [...prev, { role: 'system', content: '🔍 Ejecutando re-escaneo completo del profile...' }]);
                  try { await api.refreshProfile(connection.id); setMessages((prev) => [...prev, { role: 'system', content: '✓ Profile actualizado. Abre el panel de info para ver los resultados.' }]); }
                  catch (e) { setMessages((prev) => [...prev, { role: 'system', content: `✗ Error al re-escanear: ${e.message}` }]); }
                }}>
                  <span className="sb-context-item-icon">🔍</span> Re-escanear Profile
                </button>
                <button className="sb-context-item" onClick={() => { setShowMenu(false); window.open(`/api/export/profile/${connection.id}?format=html`, '_blank'); }}>
                  <span className="sb-context-item-icon">📥</span> Exportar Profile
                </button>

                <div style={{ padding: '6px 12px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderTop: '1px solid var(--border)', marginTop: 4 }}>Sesion</div>
                <button className="sb-context-item" onClick={() => { setShowMenu(false); handleClear(); }}>
                  <span className="sb-context-item-icon">🗑</span> Limpiar chat
                </button>
                {activeSession && (
                  <button className="sb-context-item" onClick={() => { setShowMenu(false); handleEndSession(); }}>
                    <span className="sb-context-item-icon">⏹</span> Finalizar sesion
                  </button>
                )}
                {messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && (
                  <>
                    <button className="sb-context-item" onClick={() => { setShowMenu(false); exportEnhanced(messages[messages.length - 1]); }}>
                      <span className="sb-context-item-icon">✨</span> Reporte IA (ultimo msg)
                    </button>
                    <button className="sb-context-item" onClick={() => { setShowMenu(false); exportAsReport(messages[messages.length - 1], 'html', connection.name); }}>
                      <span className="sb-context-item-icon">📄</span> Exportar HTML
                    </button>
                  </>
                )}

                <div style={{ padding: '6px 12px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderTop: '1px solid var(--border)', marginTop: 4 }}>Herramientas</div>
                <button className="sb-context-item" onClick={() => { setShowMenu(false); handleSuggestionClick('Hazme un health check completo del servidor'); }}>
                  <span className="sb-context-item-icon">📊</span> Health Check
                </button>
                <button className="sb-context-item" onClick={() => { setShowMenu(false); handleSuggestionClick('Revisa si hay actualizaciones pendientes y clasifícalas por prioridad'); }}>
                  <span className="sb-context-item-icon">🔄</span> Verificar Updates
                </button>
                <button className="sb-context-item" onClick={() => { setShowMenu(false); handleSuggestionClick('Ejecuta una revision de seguridad basica: usuarios, puertos, firewall, accesos recientes'); }}>
                  <span className="sb-context-item-icon">🛡️</span> Auditoria de Seguridad
                </button>
                <button className="sb-context-item" onClick={() => { setShowMenu(false); handleSuggestionClick('Muestra el uso de disco detallado y los 10 directorios mas grandes'); }}>
                  <span className="sb-context-item-icon">💾</span> Espacio en Disco
                </button>
                <button className="sb-context-item" onClick={() => { setShowMenu(false); handleSuggestionClick('Lista todos los servicios activos y verifica si hay alguno fallido'); }}>
                  <span className="sb-context-item-icon">⚙️</span> Servicios
                </button>
                <button className="sb-context-item" onClick={() => { setShowMenu(false); handleSuggestionClick('Muestra los ultimos errores y advertencias del sistema'); }}>
                  <span className="sb-context-item-icon">📋</span> Logs Recientes
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <SessionBanner session={activeSession} onEndSession={handleEndSession} />

      {reconnected && (
        <div className="reconnect-banner">
          Reconectado — mostrando progreso del job activo
        </div>
      )}

      <div className="terminal" ref={terminalRef}>
        {connectionLogs?.length > 0 && (
          <div className="connection-log">
            {connectionLogs.map((log, i) => (
              <div key={i} className={`log-entry log-${log.type}`}>
                <span className="log-time">[{log.time}]</span>
                <span className="log-text">{log.text}</span>
              </div>
            ))}
          </div>
        )}

        {!isConnected && !connectionLogs?.length && messages.length === 0 && (
          <div className="empty-state">
            <div className="logo-large">_</div>
            <p>Conecta al servidor usando el boton en la barra lateral<br />para comenzar a enviar instrucciones.</p>
          </div>
        )}

        {isConnected && messages.length === 0 && !loading && (
          <div className="empty-state">
            <InitialActions
              connectionId={connection.id}
              onAction={handleInitialAction}
              disabled={loading}
            />
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.role === 'system') {
            return (
              <div key={i} className="command-badge" style={{ display: 'block', whiteSpace: 'pre-wrap' }}>
                {msg.content}
              </div>
            );
          }
          const isLastAssistant = msg.role === 'assistant' && i === messages.length - 1;
          const suggestedActions = isLastAssistant && !loading ? extractSuggestedActions(msg.content) : [];

          return (
            <div key={i} id={`msg-${i}`} className={`message ${msg.role}`}>
              <div className="message-avatar">{msg.role === 'user' ? 'U' : 'K'}</div>
              <div className="message-content">
                <SmartMessage
                  blocks={msg.blocks}
                  content={msg.content}
                  onAction={(action, value) => handleSuggestionClick(value || action)}
                  connectionId={connection?.id}
                />
                {suggestedActions.length > 0 && !msg.blocks && (
                  <div className="suggested-actions">
                    {suggestedActions.map((action, j) => (
                      <button
                        key={j}
                        className="suggestion-btn"
                        onClick={() => handleSuggestionClick(action)}
                        disabled={loading}
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                )}
                {msg.role === 'assistant' && (
                  <div className="message-actions-bar">
                    <button
                      className="scroll-top-btn"
                      onClick={() => document.getElementById(`msg-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                      title="Ir al inicio de esta respuesta"
                    >
                      ↑ Inicio
                    </button>
                    {msg.metrics && (
                      <div className="metrics-footer">
                        <span className="metrics-chip" title="Modelo">{getModelLabel(msg.metrics.model)}</span>
                        <span className="metrics-chip" title="Tokens">{msg.metrics.inputTokens}↑ {msg.metrics.outputTokens}↓</span>
                        <span className="metrics-chip" title="Tiempo">{(msg.metrics.totalLatencyMs / 1000).toFixed(1)}s</span>
                        <span className="metrics-chip cost" title="Costo">${msg.metrics.estimatedCost}</span>
                      </div>
                    )}
                    <div className="export-group">
                      <button className="export-btn enhanced" onClick={() => exportEnhanced(msg)} disabled={exporting} title="Genera un reporte profesional enriquecido con analisis y recomendaciones de la IA">
                        {exporting ? '⏳' : '✨'} Reporte IA
                      </button>
                      <button className="export-btn" onClick={() => exportAsReport(msg, 'html', connection?.name)}>HTML</button>
                      <button className="export-btn" onClick={() => exportAsReport(msg, 'md', connection?.name)}>MD</button>
                      <button className="export-btn" onClick={() => exportAsReport(msg, 'txt', connection?.name)}>TXT</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="message assistant">
            <div className="message-avatar">K</div>
            <div className="message-content">
              <div className="stream-status">
                <span className="stream-spinner" />
                <span className="stream-label">{streamLabels[streamStatus] || 'Procesando...'}</span>
                <button className="cancel-btn" onClick={handleCancel} title="Cancelar">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {isConnected && userRole !== 'viewer' && (
        <QuickActions connectionId={connection.id} onAction={handleInitialAction} disabled={loading} />
      )}

      <div className="input-area">
        <div className="input-wrapper">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={userRole === 'viewer' ? 'Modo solo lectura — sin permisos para ejecutar' : isConnected ? `Escribe una instruccion para ${connection.name}...` : 'Conecta al servidor primero...'}
            rows={1}
            disabled={loading || !isConnected || userRole === 'viewer'}
          />
          <button className="send-btn" onClick={handleSend} disabled={loading || !input.trim() || !isConnected || userRole === 'viewer'}>
            &gt;
          </button>
        </div>
      </div>
    </div>
  );
}

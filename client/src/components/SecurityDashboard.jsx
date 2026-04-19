import React, { useState, useEffect } from 'react';
import { api } from '../hooks/useApi.js';

const SEVERITY_COLORS = { info: 'var(--blue)', warning: 'var(--amber)', error: 'var(--red)', critical: 'var(--red)' };
const SEVERITY_LABELS = { info: 'Info', warning: 'Advertencia', error: 'Error', critical: 'Critico' };
const SEVERITY_BG = { info: 'rgba(88,166,255,0.1)', warning: 'rgba(255,184,0,0.1)', error: 'rgba(255,68,68,0.1)', critical: 'rgba(255,68,68,0.15)' };

function scoreColor(score) {
  if (score > 70) return 'var(--accent)';
  if (score >= 50) return 'var(--amber)';
  return 'var(--red)';
}

export default function SecurityDashboard({ connectionId, connectionName, onClose }) {
  const [report, setReport] = useState(null);
  const [events, setEvents] = useState([]);
  const [auditing, setAuditing] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [filters, setFilters] = useState({ severity: '', event_type: '', days: 7 });
  const [eventTypes, setEventTypes] = useState([]);

  const loadReport = async () => {
    if (!connectionId) return;
    setLoadingReport(true);
    try {
      const data = await api.getSecurityReport(connectionId);
      setReport(data);
    } catch { setReport(null); }
    setLoadingReport(false);
  };

  const loadEvents = async () => {
    if (!connectionId) return;
    setLoadingEvents(true);
    try {
      const params = { limit: 100 };
      if (filters.severity) params.severity = filters.severity;
      if (filters.event_type) params.event_type = filters.event_type;
      if (filters.days) params.days = filters.days;
      const data = await api.getServerEvents(connectionId, params);
      const list = Array.isArray(data) ? data : (data.events || []);
      setEvents(list);
      // Extract unique event types for filter dropdown
      const types = [...new Set(list.map((e) => e.event_type).filter(Boolean))];
      if (types.length > eventTypes.length) setEventTypes(types);
    } catch { setEvents([]); }
    setLoadingEvents(false);
  };

  useEffect(() => {
    if (connectionId) { loadReport(); loadEvents(); }
  }, [connectionId]);

  useEffect(() => {
    if (connectionId) loadEvents();
  }, [filters.severity, filters.event_type, filters.days]);

  const handleAudit = async () => {
    setAuditing(true);
    try {
      await api.runSecurityAudit(connectionId);
      // Wait a moment for the audit to process, then refresh
      setTimeout(async () => {
        await loadReport();
        await loadEvents();
        setAuditing(false);
      }, 2000);
    } catch (e) { alert(e.message); setAuditing(false); }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '-';

  if (!connectionId) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
          <h3>// Panel de Seguridad</h3>
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 10 }}>No hay conexion activa.</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>Conectate a un servidor para ver su panel de seguridad.</p>
          </div>
          <div className="modal-actions">
            <span />
            <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    );
  }

  const score = report?.score ?? null;
  const lastScan = report?.lastScan || report?.last_scan;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 850, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>// Panel de Seguridad</h3>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{connectionName || `Conexion #${connectionId}`}</span>
        </div>

        {/* Score card */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, padding: 16, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 100 }}>
            {loadingReport ? (
              <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Cargando...</span>
            ) : score !== null ? (
              <>
                <span style={{ fontSize: 48, fontWeight: 800, color: scoreColor(score), lineHeight: 1, fontFamily: 'var(--font-mono)' }}>{score}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>de 100</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: 36, color: 'var(--text-muted)', lineHeight: 1 }}>--</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Sin datos</span>
              </>
            )}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Ultimo escaneo:</span>
              <span style={{ fontSize: 12, color: lastScan ? 'var(--text-primary)' : 'var(--text-muted)' }}>{lastScan ? formatDate(lastScan) : 'Nunca'}</span>
            </div>
            {score !== null && (
              <div style={{ width: '100%', height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${score}%`, height: '100%', background: scoreColor(score), borderRadius: 3, transition: 'width 0.5s ease' }} />
              </div>
            )}
            {report?.report?.summary && <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: 0 }}>{report.report.summary}</p>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={handleAudit} disabled={auditing} style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
              {auditing ? 'Auditando...' : 'Ejecutar auditoria'}
            </button>
          </div>
        </div>

        {/* Report details (if available) */}
        {report?.report?.findings && report.report.findings.length > 0 && (
          <div style={{ marginBottom: 12, padding: '8px 10px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Hallazgos del reporte</span>
            {report.report.findings.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 10 }}>
                <span style={{
                  padding: '1px 6px', borderRadius: 3, fontSize: 9, fontWeight: 600,
                  background: SEVERITY_BG[f.severity] || SEVERITY_BG.info,
                  color: SEVERITY_COLORS[f.severity] || 'var(--blue)',
                  whiteSpace: 'nowrap',
                }}>
                  {SEVERITY_LABELS[f.severity] || f.severity}
                </span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{f.title || f.check}</span>
                {f.detail && <span style={{ color: 'var(--text-muted)', flex: 1 }}>{f.detail}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Events filters */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Eventos del servidor</span>
          <select
            value={filters.severity}
            onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
            style={{ fontSize: 10, padding: '3px 6px' }}
          >
            <option value="">Severidad: Todas</option>
            <option value="info">Info</option>
            <option value="warning">Advertencia</option>
            <option value="error">Error</option>
            <option value="critical">Critico</option>
          </select>
          <select
            value={filters.event_type}
            onChange={(e) => setFilters({ ...filters, event_type: e.target.value })}
            style={{ fontSize: 10, padding: '3px 6px' }}
          >
            <option value="">Tipo: Todos</option>
            {eventTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={filters.days}
            onChange={(e) => setFilters({ ...filters, days: parseInt(e.target.value) })}
            style={{ fontSize: 10, padding: '3px 6px' }}
          >
            <option value={7}>7 dias</option>
            <option value={30}>30 dias</option>
            <option value={90}>90 dias</option>
          </select>
          <div style={{ flex: 1 }} />
          <button className="btn btn-secondary" onClick={loadEvents} disabled={loadingEvents} style={{ fontSize: 9, padding: '2px 8px' }}>
            {loadingEvents ? '...' : 'Actualizar'}
          </button>
        </div>

        {/* Events timeline */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingEvents && events.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20, fontSize: 11 }}>Cargando eventos...</p>
          ) : events.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20, fontSize: 11 }}>Sin eventos para los filtros seleccionados.</p>
          ) : (
            events.map((ev, i) => (
              <div key={i} className="kb-entry" style={{ borderLeft: `3px solid ${SEVERITY_COLORS[ev.severity] || 'var(--border)'}` }}>
                <div className="kb-entry-header" style={{ flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '1px 6px', borderRadius: 3, fontSize: 9, fontWeight: 600,
                    background: SEVERITY_BG[ev.severity] || SEVERITY_BG.info,
                    color: SEVERITY_COLORS[ev.severity] || 'var(--blue)',
                    whiteSpace: 'nowrap',
                  }}>
                    {SEVERITY_LABELS[ev.severity] || ev.severity}
                  </span>
                  {ev.event_type && <span className="metrics-chip">{ev.event_type}</span>}
                  <span className="kb-name" style={{ flex: 1 }}>{ev.title || ev.message || ev.event_type}</span>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDate(ev.timestamp || ev.created_at)}</span>
                </div>
                {ev.command && (
                  <code style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', margin: '4px 0 0 0', padding: '2px 6px', background: 'var(--bg-primary)', borderRadius: 3 }}>
                    {ev.command}
                  </code>
                )}
                {ev.details && <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>{typeof ev.details === 'string' ? ev.details : JSON.stringify(ev.details)}</p>}
              </div>
            ))
          )}
        </div>

        <div className="modal-actions">
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{events.length} eventos{score !== null ? ` | Puntuacion: ${score}/100` : ''}</span>
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

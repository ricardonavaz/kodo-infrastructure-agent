import React, { useState, useEffect } from 'react';
import { api } from '../hooks/useApi.js';

const STATUS_COLORS = {
  success: 'var(--accent)',
  partial_failure: 'var(--amber)',
  error: 'var(--red)',
};

export default function AuditLog({ onClose }) {
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({ limit: 50, offset: 0 });
  const [expandedId, setExpandedId] = useState(null);

  const loadData = async () => {
    try {
      const [logData, statsData] = await Promise.all([
        api.getAuditLog(filters),
        api.getAuditStats(),
      ]);
      setRecords(logData.records || []);
      setTotal(logData.total || 0);
      setStats(statsData);
    } catch (err) {
      console.error('Error loading audit:', err);
    }
  };

  useEffect(() => { loadData(); }, [filters]);

  const updateFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value, offset: 0 }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 800, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <h3>// Historial y Auditoria</h3>

        {/* Stats */}
        {stats && (
          <div className="audit-stats">
            <div className="audit-stat">
              <span className="audit-stat-value">{stats.total}</span>
              <span className="audit-stat-label">Total</span>
            </div>
            <div className="audit-stat">
              <span className="audit-stat-value" style={{ color: 'var(--accent)' }}>{stats.successRate}%</span>
              <span className="audit-stat-label">Exito</span>
            </div>
            <div className="audit-stat">
              <span className="audit-stat-value">{(stats.avgDurationMs / 1000).toFixed(1)}s</span>
              <span className="audit-stat-label">Promedio</span>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="audit-filters">
          <input
            type="text"
            placeholder="Buscar..."
            className="search-input"
            onChange={(e) => updateFilter('search', e.target.value)}
            style={{ marginBottom: 0 }}
          />
          <select className="filter-select" onChange={(e) => updateFilter('task_type', e.target.value)}>
            <option value="">Tipo: todos</option>
            <option value="maintenance">Mantenimiento</option>
            <option value="diagnostic">Diagnostico</option>
            <option value="deployment">Despliegue</option>
            <option value="configuration">Configuracion</option>
            <option value="monitoring">Monitoreo</option>
            <option value="security">Seguridad</option>
            <option value="other">Otro</option>
          </select>
          <select className="filter-select" onChange={(e) => updateFilter('status', e.target.value)}>
            <option value="">Estado: todos</option>
            <option value="success">Exito</option>
            <option value="partial_failure">Parcial</option>
            <option value="error">Error</option>
          </select>
          <a
            href={`/api/audit/export/data?format=csv&${new URLSearchParams(filters).toString()}`}
            className="btn btn-secondary"
            style={{ fontSize: 11, padding: '4px 10px', textDecoration: 'none' }}
            target="_blank"
          >
            CSV
          </a>
        </div>

        {/* Records */}
        <div style={{ flex: 1, overflowY: 'auto', marginTop: 8 }}>
          {records.map((r) => (
            <div key={r.id} className="audit-row" onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
              <div className="audit-row-header">
                <span className="audit-status-dot" style={{ background: STATUS_COLORS[r.final_status] || 'var(--text-muted)' }} />
                <span className="audit-server">{r.connection_name || '—'}</span>
                <span className="audit-prompt">{r.user_prompt?.substring(0, 60)}{r.user_prompt?.length > 60 ? '...' : ''}</span>
                <span className="audit-type">{r.task_type}</span>
                <span className="audit-time">{r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : '—'}</span>
                <span className="audit-date">{new Date(r.datetime).toLocaleString()}</span>
              </div>
              {expandedId === r.id && (
                <div className="audit-detail">
                  <p><strong>Prompt:</strong> {r.user_prompt}</p>
                  <p><strong>Modelo:</strong> {r.model_used || '—'}</p>
                  <p><strong>Comandos:</strong></p>
                  <pre>{r.commands_generated}</pre>
                  {r.errors && <p style={{ color: 'var(--red)' }}><strong>Error:</strong> {r.errors}</p>}
                </div>
              )}
            </div>
          ))}
          {records.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>Sin registros</p>
          )}
        </div>

        <div className="modal-actions">
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{total} registros</span>
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { api } from '../hooks/useApi.js';

const STATUS_COLORS = { success: 'var(--accent)', failed: 'var(--red)', running: 'var(--amber)', skipped: 'var(--text-muted)' };
const STATUS_LABELS = { success: 'Exitoso', failed: 'Fallido', running: 'Ejecutando', skipped: 'Omitido' };

export default function SchedulerManager({ connections, onClose }) {
  const [tasks, setTasks] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [runs, setRuns] = useState({});
  const [showNew, setShowNew] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [loading, setLoading] = useState(false);
  const [runningId, setRunningId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [newForm, setNewForm] = useState({
    name: '', cron_expression: '', description: '', connection_id: '',
    group_id: '', playbook_id: '', command: '', task_type: 'command',
    retry_count: 0, retry_delay_ms: 5000, timeout_ms: 30000,
  });

  const load = async () => {
    try { setTasks(await api.getScheduledTasks()); } catch { /* ignore */ }
  };

  useEffect(() => { load(); }, []);

  const loadRuns = async (id) => {
    try {
      const data = await api.getScheduledTaskRuns(id);
      setRuns((prev) => ({ ...prev, [id]: data }));
    } catch { /* ignore */ }
  };

  const handleExpand = (id) => {
    const next = expandedId === id ? null : id;
    setExpandedId(next);
    if (next && !runs[id]) loadRuns(id);
  };

  const handleToggle = async (id) => {
    try { await api.toggleScheduledTask(id); load(); } catch (e) { alert(e.message); }
  };

  const handleRunNow = async (id) => {
    setRunningId(id);
    try {
      await api.runScheduledTaskNow(id);
      setTimeout(() => { load(); loadRuns(id); setRunningId(null); }, 1500);
    } catch (e) { alert(e.message); setRunningId(null); }
  };

  const handleDelete = async (id) => {
    try { await api.deleteScheduledTask(id); setDeleteConfirm(null); load(); } catch (e) { alert(e.message); }
  };

  const handleCreate = async () => {
    if (!newForm.name || !newForm.cron_expression) return alert('Nombre y expresion cron son requeridos');
    try {
      const data = { ...newForm };
      if (data.connection_id) data.connection_id = parseInt(data.connection_id);
      if (data.group_id) data.group_id = parseInt(data.group_id);
      if (data.playbook_id) data.playbook_id = parseInt(data.playbook_id);
      if (!data.connection_id) delete data.connection_id;
      if (!data.group_id) delete data.group_id;
      if (!data.playbook_id) delete data.playbook_id;
      if (data.task_type === 'command') delete data.playbook_id;
      if (data.task_type === 'playbook') delete data.command;
      await api.createScheduledTask(data);
      setShowNew(false);
      setNewForm({ name: '', cron_expression: '', description: '', connection_id: '', group_id: '', playbook_id: '', command: '', task_type: 'command', retry_count: 0, retry_delay_ms: 5000, timeout_ms: 30000 });
      load();
    } catch (e) { alert(e.message); }
  };

  const handleLoadTemplates = async () => {
    setShowTemplates(!showTemplates);
    if (!showTemplates && templates.length === 0) {
      setLoading(true);
      try { setTemplates(await api.getSchedulerTemplates()); } catch (e) { alert(e.message); }
      setLoading(false);
    }
  };

  const handleUseTemplate = (tpl) => {
    setNewForm({
      name: tpl.name || '', cron_expression: tpl.cron_expression || '',
      description: tpl.description || '', connection_id: '', group_id: '',
      playbook_id: tpl.playbook_id || '', command: tpl.command || '',
      task_type: tpl.task_type || 'command', retry_count: tpl.retry_count || 0,
      retry_delay_ms: tpl.retry_delay_ms || 5000, timeout_ms: tpl.timeout_ms || 30000,
    });
    setShowNew(true);
    setShowTemplates(false);
  };

  const formatDate = (d) => d ? new Date(d).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : 'Nunca';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 850, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>// Tareas Programadas</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-secondary" onClick={handleLoadTemplates} style={{ fontSize: 11 }}>
              {showTemplates ? 'Cerrar plantillas' : 'Plantillas'}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowNew(!showNew)} style={{ fontSize: 11 }}>
              {showNew ? 'Cancelar' : '+ Nueva tarea'}
            </button>
          </div>
        </div>

        {/* Templates */}
        {showTemplates && (
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: 10, marginBottom: 10, maxHeight: 200, overflowY: 'auto' }}>
            <p style={{ fontSize: 11, color: 'var(--purple)', marginBottom: 6 }}>Plantillas predefinidas:</p>
            {loading ? <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cargando...</p> :
              templates.length === 0 ? <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sin plantillas disponibles.</p> :
              templates.map((tpl, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{tpl.name}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 8 }}>{tpl.cron_expression}</span>
                    {tpl.description && <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: '2px 0 0' }}>{tpl.description}</p>}
                  </div>
                  <button className="btn btn-primary" onClick={() => handleUseTemplate(tpl)} style={{ fontSize: 10, padding: '3px 8px', whiteSpace: 'nowrap' }}>Usar</button>
                </div>
              ))
            }
          </div>
        )}

        {/* Create form */}
        {showNew && (
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: 10, marginBottom: 10 }}>
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label>Nombre</label>
                <input value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} placeholder="Backup diario..." />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Expresion Cron</label>
                <input value={newForm.cron_expression} onChange={(e) => setNewForm({ ...newForm, cron_expression: e.target.value })} placeholder="*/5 * * * *" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }} />
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>min hora dia mes diasem</span>
              </div>
            </div>
            <div className="form-group">
              <label>Descripcion</label>
              <input value={newForm.description} onChange={(e) => setNewForm({ ...newForm, description: e.target.value })} placeholder="Descripcion opcional..." />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Conexion</label>
                <select value={newForm.connection_id} onChange={(e) => setNewForm({ ...newForm, connection_id: e.target.value })}>
                  <option value="">Seleccionar...</option>
                  {connections?.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.host})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Tipo de tarea</label>
                <select value={newForm.task_type} onChange={(e) => setNewForm({ ...newForm, task_type: e.target.value })}>
                  <option value="command">Comando</option>
                  <option value="playbook">Playbook</option>
                </select>
              </div>
            </div>
            {newForm.task_type === 'command' ? (
              <div className="form-group">
                <label>Comando</label>
                <textarea rows={2} value={newForm.command} onChange={(e) => setNewForm({ ...newForm, command: e.target.value })} placeholder="df -h && free -m" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }} />
              </div>
            ) : (
              <div className="form-group">
                <label>ID del Playbook</label>
                <input type="number" value={newForm.playbook_id} onChange={(e) => setNewForm({ ...newForm, playbook_id: e.target.value })} placeholder="ID del playbook..." />
              </div>
            )}
            <div className="form-row">
              <div className="form-group">
                <label>Reintentos</label>
                <input type="number" min={0} max={10} value={newForm.retry_count} onChange={(e) => setNewForm({ ...newForm, retry_count: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="form-group">
                <label>Delay reintento (ms)</label>
                <input type="number" min={0} value={newForm.retry_delay_ms} onChange={(e) => setNewForm({ ...newForm, retry_delay_ms: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="form-group">
                <label>Timeout (ms)</label>
                <input type="number" min={0} value={newForm.timeout_ms} onChange={(e) => setNewForm({ ...newForm, timeout_ms: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <button className="btn btn-primary" onClick={handleCreate} style={{ fontSize: 11 }}>Crear tarea</button>
          </div>
        )}

        {/* Tasks list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {tasks.length === 0 ? <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>Sin tareas programadas.</p> :
          tasks.map((t) => {
            const isExpanded = expandedId === t.id;
            const conn = connections?.find((c) => c.id === t.connection_id);
            return (
              <div key={t.id} className="kb-entry" style={{ opacity: t.enabled ? 1 : 0.5 }}>
                <div className="kb-entry-header" onClick={() => handleExpand(t.id)}>
                  <span className="kb-name">{t.name}</span>
                  <code style={{ fontSize: 10, color: 'var(--blue)', background: 'var(--bg-primary)', padding: '1px 6px', borderRadius: 3 }}>{t.cron_expression}</code>
                  {conn && <span className="metrics-chip">{conn.name}</span>}
                  {t.group_id && <span className="metrics-chip" style={{ color: 'var(--purple)' }}>grupo #{t.group_id}</span>}
                  <span className="metrics-chip">{t.task_type === 'playbook' ? 'playbook' : 'cmd'}</span>
                  {t.last_run_status && (
                    <span className="metrics-chip" style={{ color: STATUS_COLORS[t.last_run_status] || 'var(--text-muted)' }}>
                      {STATUS_LABELS[t.last_run_status] || t.last_run_status}
                    </span>
                  )}
                  <button
                    className={`conn-btn ${t.enabled ? 'connect' : ''}`}
                    onClick={(e) => { e.stopPropagation(); handleToggle(t.id); }}
                    title={t.enabled ? 'Desactivar' : 'Activar'}
                    style={{ width: 22, height: 22, fontSize: 10 }}
                  >
                    {t.enabled ? 'ON' : 'OFF'}
                  </button>
                  <button
                    className="conn-btn connect"
                    onClick={(e) => { e.stopPropagation(); handleRunNow(t.id); }}
                    disabled={runningId === t.id}
                    title="Ejecutar ahora"
                    style={{ width: 22, height: 22, fontSize: 10 }}
                  >
                    {runningId === t.id ? '...' : '\u25B6'}
                  </button>
                  {deleteConfirm === t.id ? (
                    <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                      <button className="btn btn-primary" onClick={() => handleDelete(t.id)} style={{ fontSize: 9, padding: '2px 6px', background: 'var(--red)', borderColor: 'var(--red)' }}>Si</button>
                      <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)} style={{ fontSize: 9, padding: '2px 6px' }}>No</button>
                    </div>
                  ) : (
                    <button className="delete-btn" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(t.id); }}>✗</button>
                  )}
                </div>
                {isExpanded && (
                  <div className="kb-detail">
                    {t.description && <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>{t.description}</p>}
                    {t.command && <div style={{ marginBottom: 6 }}><strong style={{ fontSize: 10 }}>Comando:</strong><pre style={{ fontSize: 10, margin: '2px 0' }}>{t.command}</pre></div>}
                    {t.playbook_id && <p style={{ fontSize: 11, color: 'var(--blue)' }}>Playbook #{t.playbook_id}</p>}
                    <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>
                      <span>Reintentos: {t.retry_count || 0}</span>
                      <span>Timeout: {t.timeout_ms ? (t.timeout_ms / 1000) + 's' : 'sin limite'}</span>
                      <span>Ultima ejecucion: {formatDate(t.last_run_at)}</span>
                    </div>

                    {/* Run history */}
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Historial de ejecuciones</span>
                        <button className="btn btn-secondary" onClick={() => loadRuns(t.id)} style={{ fontSize: 9, padding: '2px 8px' }}>Actualizar</button>
                      </div>
                      {!runs[t.id] ? <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>Cargando...</p> :
                        runs[t.id].length === 0 ? <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>Sin ejecuciones registradas.</p> :
                        runs[t.id].slice(0, 10).map((r, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '3px 0', borderBottom: '1px solid var(--border)', fontSize: 10 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLORS[r.status] || 'var(--text-muted)', flexShrink: 0 }} />
                            <span style={{ color: 'var(--text-muted)', minWidth: 110 }}>{formatDate(r.started_at || r.created_at)}</span>
                            <span style={{ color: STATUS_COLORS[r.status], fontWeight: 600 }}>{STATUS_LABELS[r.status] || r.status}</span>
                            {r.duration_ms && <span style={{ color: 'var(--text-muted)' }}>{(r.duration_ms / 1000).toFixed(1)}s</span>}
                            {r.error && <span style={{ color: 'var(--red)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.error}</span>}
                          </div>
                        ))
                      }
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="modal-actions">
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tasks.length} tareas ({tasks.filter((t) => t.enabled).length} activas)</span>
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

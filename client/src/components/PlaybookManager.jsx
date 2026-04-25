import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../hooks/useApi.js';
import PlaybookEditor from './PlaybookEditor.jsx';

const CAT_LABELS = {
  monitoring: { label: 'Monitoreo', color: 'var(--blue)' },
  maintenance: { label: 'Mantenimiento', color: 'var(--amber)' },
  diagnostic: { label: 'Diagnostico', color: 'var(--purple)' },
  security: { label: 'Seguridad', color: 'var(--red)' },
  deployment: { label: 'Despliegue', color: 'var(--accent)' },
  configuration: { label: 'Configuracion', color: 'var(--text-secondary)' },
  custom: { label: 'Personalizado', color: 'var(--text-muted)' },
};

const STEP_ICONS = { command: '>', invoke_playbook: '\u27F3', message: '\u2709', prompt: '?', approval_gate: '\u2298' };
const STEP_LABELS = { command: 'Comando', invoke_playbook: 'Sub-Playbook', message: 'Mensaje', prompt: 'Input', approval_gate: 'Gate' };
const AUDITOR_LABELS = { none: 'Ninguno', audit_log: 'Solo registro', supervised: 'Supervisado' };
const EXEC_MODE_LABELS = { sequential: 'Secuencial', non_stop: 'Non-stop' };

export default function PlaybookManager({ connections, onClose }) {
  const [playbooks, setPlaybooks] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingPlaybook, setEditingPlaybook] = useState(null);

  // Generator state
  const [showGenerator, setShowGenerator] = useState(false);
  const [genObjective, setGenObjective] = useState('');
  const [genConnectionId, setGenConnectionId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState(null);

  // Execution state
  const [execConnId, setExecConnId] = useState('');
  const [executing, setExecuting] = useState(false);
  const [execEvents, setExecEvents] = useState([]);
  const [execDone, setExecDone] = useState(false);
  const [execInteraction, setExecInteraction] = useState(null);
  const [interactionResponse, setInteractionResponse] = useState('');

  // Run history
  const [runs, setRuns] = useState([]);
  const [activeTab, setActiveTab] = useState('detail'); // detail | runs | execute

  const load = useCallback(async () => {
    try { setPlaybooks(await api.getPlaybooks()); } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Load runs when selecting a playbook
  useEffect(() => {
    if (!selectedId) return;
    api.getPlaybookRuns(selectedId).then(setRuns).catch(() => setRuns([]));
  }, [selectedId]);

  const selected = playbooks.find((p) => p.id === selectedId);

  // Filtering
  const filtered = playbooks.filter((pb) => {
    if (filter !== 'all' && pb.category !== filter) return false;
    if (search && !pb.name.toLowerCase().includes(search.toLowerCase()) && !pb.description?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const categories = ['all', ...new Set(playbooks.map((p) => p.category))];

  // Actions
  const handleDelete = async (id) => {
    if (!confirm('Eliminar playbook?')) return;
    await api.deletePlaybook(id);
    if (selectedId === id) setSelectedId(null);
    load();
  };

  const handleEdit = (pb) => { setEditingPlaybook(pb); setShowEditor(true); };
  const handleNew = () => { setEditingPlaybook(null); setShowEditor(true); };

  const handleGenerate = async () => {
    if (!genObjective) return;
    setGenerating(true);
    setGenResult(null);
    try {
      const result = await api.generatePlaybook({ objective: genObjective, connectionId: genConnectionId || undefined });
      if (result.error) throw new Error(result.error);
      setGenResult(result);
      load();
      if (result.playbook?.id) setSelectedId(result.playbook.id);
    } catch (e) { alert('Error: ' + e.message); }
    setGenerating(false);
  };

  const handleExecute = async (pb) => {
    if (!execConnId) return;
    setExecuting(true);
    setExecEvents([]);
    setExecDone(false);
    setExecInteraction(null);
    setActiveTab('execute');

    try {
      await api.executePlaybookStream(
        pb.id,
        {
          connectionId: parseInt(execConnId),
          executionMode: pb.execution_mode || 'sequential',
          auditorMode: pb.auditor_mode || 'none',
        },
        (ev) => setExecEvents((prev) => [...prev, ev]),
      );
      setExecDone(true);
      // Reload runs
      api.getPlaybookRuns(pb.id).then(setRuns).catch(() => {});
    } catch (e) {
      setExecEvents((prev) => [...prev, { type: 'error', data: { message: e.message } }]);
      setExecDone(true);
    }
    setExecuting(false);
  };

  const handleRespondInteraction = async () => {
    if (!execInteraction) return;
    try {
      await api.respondToInteraction(execInteraction.runId, execInteraction.interactionId, { response: interactionResponse });
      setExecInteraction(null);
      setInteractionResponse('');
    } catch (e) { alert('Error: ' + e.message); }
  };

  const renderSteps = (pb) => {
    const steps = JSON.parse(pb.command_sequence || '[]');
    return steps.map((s, i) => {
      const type = s.type || 'command';
      return (
        <div key={i} className="pb-step">
          <div className="pb-step-num">{i + 1}</div>
          <div className="pb-step-body">
            <div className="pb-step-header">
              <span className={`pb-step-type pb-step-type--${type}`}>{STEP_ICONS[type]} {STEP_LABELS[type]}</span>
              <span className="pb-step-name">{s.name}</span>
            </div>
            {type === 'command' && <code className="pb-step-code">{s.command}</code>}
            {type === 'invoke_playbook' && <span className="pb-step-meta">Playbook #{s.playbook_id}</span>}
            {type === 'message' && <span className="pb-step-meta">{s.text?.substring(0, 80)}</span>}
            {type === 'prompt' && <span className="pb-step-meta">Variable: {s.variable_name}</span>}
            {type === 'approval_gate' && <span className="pb-step-meta">{s.text?.substring(0, 80)}</span>}
          </div>
        </div>
      );
    });
  };

  const renderDetail = () => {
    if (!selected) return (
      <div className="pb-empty-state">
        <div className="pb-empty-icon">📋</div>
        <p>Selecciona un playbook para ver los detalles</p>
        <p className="pb-empty-sub">O crea uno nuevo con el boton "Nuevo" o genera uno con IA</p>
      </div>
    );

    const steps = JSON.parse(selected.command_sequence || '[]');
    const preconditions = JSON.parse(selected.preconditions || '[]');
    const variables = JSON.parse(selected.required_variables || '[]');
    const rollback = JSON.parse(selected.rollback_commands || '[]');
    const successCriteria = JSON.parse(selected.success_criteria || '[]');
    const systems = JSON.parse(selected.compatible_systems || '[]');
    const cat = CAT_LABELS[selected.category] || CAT_LABELS.custom;

    return (
      <div className="pb-detail">
        {/* Header */}
        <div className="pb-detail-header">
          <div className="pb-detail-title-row">
            <h2 className="pb-detail-title">{selected.name}</h2>
            <div className="pb-detail-actions">
              {!selected.is_builtin && (
                <button className="pb-btn pb-btn--secondary" onClick={() => handleEdit(selected)}>Editar</button>
              )}
              {!selected.is_builtin && (
                <button className="pb-btn pb-btn--danger" onClick={() => handleDelete(selected.id)}>Eliminar</button>
              )}
            </div>
          </div>
          {selected.description && <p className="pb-detail-desc">{selected.description}</p>}
          <div className="pb-detail-badges">
            <span className="pb-badge" style={{ borderColor: cat.color, color: cat.color }}>{cat.label}</span>
            {selected.is_builtin && <span className="pb-badge pb-badge--dim">Integrado</span>}
            <span className="pb-badge pb-badge--dim">{EXEC_MODE_LABELS[selected.execution_mode] || 'Secuencial'}</span>
            <span className="pb-badge pb-badge--dim">Auditor: {AUDITOR_LABELS[selected.auditor_mode] || 'Ninguno'}</span>
            {systems.map((s) => <span key={s} className="pb-badge pb-badge--dim">{s}</span>)}
          </div>
        </div>

        {/* Tabs */}
        <div className="pb-tabs">
          <button className={`pb-tab ${activeTab === 'detail' ? 'active' : ''}`} onClick={() => setActiveTab('detail')}>
            Pasos ({steps.length})
          </button>
          <button className={`pb-tab ${activeTab === 'execute' ? 'active' : ''}`} onClick={() => setActiveTab('execute')}>
            Ejecutar
          </button>
          <button className={`pb-tab ${activeTab === 'runs' ? 'active' : ''}`} onClick={() => setActiveTab('runs')}>
            Historial ({runs.length})
          </button>
        </div>

        {/* Tab content */}
        <div className="pb-tab-content">
          {activeTab === 'detail' && (
            <>
              {selected.objective && (
                <div className="pb-section">
                  <h4 className="pb-section-title">Objetivo</h4>
                  <p className="pb-section-text">{selected.objective}</p>
                </div>
              )}

              {preconditions.length > 0 && (
                <div className="pb-section">
                  <h4 className="pb-section-title">Precondiciones</h4>
                  <ul className="pb-list">{preconditions.map((p, i) => <li key={i}>{p}</li>)}</ul>
                </div>
              )}

              <div className="pb-section">
                <h4 className="pb-section-title">Secuencia de pasos</h4>
                <div className="pb-steps">{renderSteps(selected)}</div>
              </div>

              {variables.length > 0 && (
                <div className="pb-section">
                  <h4 className="pb-section-title">Variables requeridas</h4>
                  <div className="pb-var-grid">
                    {variables.map((v, i) => (
                      <div key={i} className="pb-var">
                        <code className="pb-var-name">{v.name || v}</code>
                        {v.description && <span className="pb-var-desc">{v.description}</span>}
                        {v.default && <span className="pb-var-default">Default: {v.default}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {rollback.length > 0 && (
                <div className="pb-section">
                  <h4 className="pb-section-title">Rollback</h4>
                  <div className="pb-steps">
                    {rollback.map((r, i) => (
                      <div key={i} className="pb-step">
                        <div className="pb-step-num" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{i + 1}</div>
                        <div className="pb-step-body">
                          <span className="pb-step-name">{r.name || 'Revertir'}</span>
                          <code className="pb-step-code">{r.command}</code>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {successCriteria.length > 0 && (
                <div className="pb-section">
                  <h4 className="pb-section-title">Criterios de exito</h4>
                  <ul className="pb-list pb-list--check">{successCriteria.map((c, i) => <li key={i}>{c}</li>)}</ul>
                </div>
              )}
            </>
          )}

          {activeTab === 'execute' && (
            <div className="pb-exec-panel">
              <div className="pb-exec-controls">
                <div className="pb-exec-field">
                  <label>Servidor destino</label>
                  <select value={execConnId} onChange={(e) => setExecConnId(e.target.value)}>
                    <option value="">Seleccionar servidor...</option>
                    {connections?.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.host})</option>)}
                  </select>
                </div>
                <button
                  className="pb-btn pb-btn--primary pb-btn--exec"
                  onClick={() => handleExecute(selected)}
                  disabled={!execConnId || executing}
                >
                  {executing ? 'Ejecutando...' : 'Ejecutar'}
                </button>
              </div>

              {execEvents.length > 0 && (
                <div className="pb-exec-log">
                  <div className="pb-exec-log-header">
                    <span>Log de ejecucion</span>
                    {execDone && <span className="pb-exec-status">{execEvents.some((e) => e.type === 'error') ? 'Error' : 'Completado'}</span>}
                  </div>
                  <div className="pb-exec-events">
                    {execEvents.map((ev, i) => (
                      <div key={i} className={`pb-exec-event pb-exec-event--${ev.type}`}>
                        <span className="pb-exec-event-type">[{ev.type}]</span>
                        <span className="pb-exec-event-text">
                          {ev.data?.name || ev.data?.command || ev.data?.message || ev.data?.reason || ev.data?.playbook || JSON.stringify(ev.data).substring(0, 120)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {execInteraction && (
                    <div className="pb-exec-interaction">
                      <p className="pb-exec-interaction-title">
                        {execInteraction.interaction_type === 'approval_gate' ? 'Aprobacion requerida' : 'Input requerido'}
                      </p>
                      <p className="pb-exec-interaction-text">{execInteraction.text}</p>
                      {execInteraction.interaction_type === 'approval_gate' ? (
                        <div className="pb-exec-interaction-btns">
                          <button className="pb-btn pb-btn--primary" onClick={() => { setInteractionResponse('approve'); handleRespondInteraction(); }}>Aprobar</button>
                          <button className="pb-btn pb-btn--danger" onClick={() => { setInteractionResponse('reject'); handleRespondInteraction(); }}>Rechazar</button>
                        </div>
                      ) : (
                        <div className="pb-exec-interaction-input">
                          <input value={interactionResponse} onChange={(e) => setInteractionResponse(e.target.value)} placeholder="Tu respuesta..." />
                          <button className="pb-btn pb-btn--primary" onClick={handleRespondInteraction}>Enviar</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'runs' && (
            <div className="pb-runs">
              {runs.length === 0 ? (
                <p className="pb-runs-empty">Sin ejecuciones previas</p>
              ) : runs.map((run) => (
                <div key={run.id} className={`pb-run pb-run--${run.status}`}>
                  <div className="pb-run-status">{run.status === 'completed' ? 'OK' : run.status === 'failed' ? 'ERR' : run.status}</div>
                  <div className="pb-run-info">
                    <span className="pb-run-date">{new Date(run.started_at).toLocaleString()}</span>
                    <span className="pb-run-meta">
                      {run.steps_completed}/{run.steps_total} pasos
                      {run.duration_ms ? ` | ${(run.duration_ms / 1000).toFixed(1)}s` : ''}
                    </span>
                  </div>
                  {run.error && <span className="pb-run-error">{run.error}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="pb-overlay" onClick={onClose}>
      <div className="pb-panel" onClick={(e) => e.stopPropagation()}>
        {/* Sidebar */}
        <div className="pb-sidebar">
          <div className="pb-sidebar-header">
            <h3 className="pb-sidebar-title">Playbooks</h3>
            <div className="pb-sidebar-actions">
              <button className="pb-btn pb-btn--primary pb-btn--sm" onClick={handleNew}>+ Nuevo</button>
              <button className="pb-btn pb-btn--secondary pb-btn--sm" onClick={() => setShowGenerator(!showGenerator)}>
                {showGenerator ? 'Cerrar IA' : 'Generar IA'}
              </button>
            </div>
          </div>

          {/* AI Generator */}
          {showGenerator && (
            <div className="pb-generator">
              <textarea
                rows={2}
                value={genObjective}
                onChange={(e) => setGenObjective(e.target.value)}
                placeholder="Describe el objetivo del playbook..."
                className="pb-gen-input"
              />
              <select value={genConnectionId} onChange={(e) => setGenConnectionId(e.target.value)} className="pb-gen-select">
                <option value="">Sin contexto de servidor</option>
                {connections?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button className="pb-btn pb-btn--primary pb-btn--full" onClick={handleGenerate} disabled={generating || !genObjective}>
                {generating ? 'Generando con Opus...' : 'Generar Playbook'}
              </button>
              {genResult && (
                <div className="pb-gen-result">"{genResult.playbook?.name}" creado</div>
              )}
            </div>
          )}

          {/* Search */}
          <div className="pb-search">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar playbook..."
              className="pb-search-input"
            />
          </div>

          {/* Category filters */}
          <div className="pb-categories">
            {categories.map((cat) => {
              const info = CAT_LABELS[cat] || { label: cat, color: 'var(--text-muted)' };
              const count = cat === 'all' ? playbooks.length : playbooks.filter((p) => p.category === cat).length;
              return (
                <button
                  key={cat}
                  className={`pb-cat-btn ${filter === cat ? 'active' : ''}`}
                  onClick={() => setFilter(cat)}
                  style={filter === cat ? { borderColor: cat === 'all' ? 'var(--accent)' : info.color } : undefined}
                >
                  <span className="pb-cat-label">{cat === 'all' ? 'Todos' : info.label}</span>
                  <span className="pb-cat-count">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Playbook list */}
          <div className="pb-list-scroll">
            {filtered.length === 0 && <p className="pb-list-empty">Sin resultados</p>}
            {filtered.map((pb) => {
              const steps = JSON.parse(pb.command_sequence || '[]');
              const cat = CAT_LABELS[pb.category] || CAT_LABELS.custom;
              const isSelected = selectedId === pb.id;
              return (
                <div key={pb.id} className={`pb-list-item ${isSelected ? 'active' : ''}`} onClick={() => { setSelectedId(pb.id); setActiveTab('detail'); }}>
                  <div className="pb-list-item-top">
                    <span className="pb-list-item-name">{pb.name}</span>
                    {pb.is_builtin && <span className="pb-list-item-badge">builtin</span>}
                  </div>
                  <div className="pb-list-item-meta">
                    <span className="pb-list-item-cat" style={{ color: cat.color }}>{cat.label}</span>
                    <span className="pb-list-item-steps">{steps.length} pasos</span>
                    {pb.auditor_mode !== 'none' && <span className="pb-list-item-auditor">auditor</span>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pb-sidebar-footer">
            <span>{playbooks.length} playbooks</span>
            <button className="pb-btn pb-btn--secondary pb-btn--sm" onClick={onClose}>Cerrar</button>
          </div>
        </div>

        {/* Main content */}
        <div className="pb-main">
          {renderDetail()}
        </div>
      </div>

      {showEditor && (
        <PlaybookEditor
          playbook={editingPlaybook}
          onSave={() => { load(); }}
          onClose={() => { setShowEditor(false); setEditingPlaybook(null); }}
        />
      )}
    </div>
  );
}

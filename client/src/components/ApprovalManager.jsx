import React, { useState, useEffect } from 'react';
import { api } from '../hooks/useApi.js';

const DECISION_COLORS = { approved: 'var(--accent)', denied: 'var(--red)', manual: 'var(--amber)' };
const DECISION_LABELS = { approved: 'Aprobado', denied: 'Denegado', manual: 'Manual' };
const RISK_COLORS = { low: 'var(--accent)', medium: 'var(--amber)', high: 'var(--red)', critical: 'var(--red)' };
const RISK_LABELS = { low: 'Bajo', medium: 'Medio', high: 'Alto', critical: 'Critico' };

export default function ApprovalManager({ onClose }) {
  const [tab, setTab] = useState('profiles');
  const [profiles, setProfiles] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [log, setLog] = useState([]);
  const [testCmd, setTestCmd] = useState('');
  const [testConnId, setTestConnId] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [editingRules, setEditingRules] = useState({});
  const [newForm, setNewForm] = useState({ name: '', description: '' });

  const load = async () => {
    try { setProfiles(await api.getApprovalProfiles()); } catch { /* ignore */ }
  };

  const loadLog = async () => {
    try { setLog(await api.getApprovalLog({ limit: 50 })); } catch { /* ignore */ }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (tab === 'log') loadLog(); }, [tab]);

  const handleToggle = async (id) => {
    try { await api.toggleApprovalProfile(id); load(); } catch (e) { alert(e.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Eliminar este perfil de aprobacion?')) return;
    try { await api.deleteApprovalProfile(id); load(); } catch (e) { alert(e.message); }
  };

  const handleCreate = async () => {
    if (!newForm.name) return alert('Nombre requerido');
    try {
      await api.createApprovalProfile({ ...newForm, rules: [] });
      setShowNew(false);
      setNewForm({ name: '', description: '' });
      load();
    } catch (e) { alert(e.message); }
  };

  const handleTest = async () => {
    if (!testCmd) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.checkApproval({ command: testCmd, connectionId: testConnId ? parseInt(testConnId) : undefined });
      setTestResult(result);
    } catch (e) { setTestResult({ decision: 'error', error: e.message }); }
    setTesting(false);
  };

  // Rules editing
  const startEditRules = (profile) => {
    const rules = typeof profile.rules === 'string' ? JSON.parse(profile.rules || '[]') : (profile.rules || []);
    setEditingRules({ ...editingRules, [profile.id]: [...rules] });
  };

  const getRules = (profile) => {
    if (editingRules[profile.id]) return editingRules[profile.id];
    return typeof profile.rules === 'string' ? JSON.parse(profile.rules || '[]') : (profile.rules || []);
  };

  const isEditingRules = (id) => !!editingRules[id];

  const addRule = (id) => {
    const rules = editingRules[id] || [];
    setEditingRules({ ...editingRules, [id]: [...rules, { pattern: '', decision: 'denied', risk_level: 'medium' }] });
  };

  const updateRule = (profileId, index, field, value) => {
    const rules = [...(editingRules[profileId] || [])];
    rules[index] = { ...rules[index], [field]: value };
    setEditingRules({ ...editingRules, [profileId]: rules });
  };

  const removeRule = (profileId, index) => {
    const rules = [...(editingRules[profileId] || [])];
    rules.splice(index, 1);
    setEditingRules({ ...editingRules, [profileId]: rules });
  };

  const saveRules = async (profileId) => {
    const rules = editingRules[profileId];
    if (!rules) return;
    try {
      await api.updateApprovalProfile(profileId, { rules });
      const updated = { ...editingRules };
      delete updated[profileId];
      setEditingRules(updated);
      load();
    } catch (e) { alert(e.message); }
  };

  const cancelEditRules = (profileId) => {
    const updated = { ...editingRules };
    delete updated[profileId];
    setEditingRules(updated);
  };

  const formatDate = (d) => d ? new Date(d).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '-';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 850, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>// Perfiles de Aprobacion</h3>
          {tab === 'profiles' && (
            <button className="btn btn-secondary" onClick={() => setShowNew(!showNew)} style={{ fontSize: 11 }}>
              {showNew ? 'Cancelar' : '+ Nuevo perfil'}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="exec-tabs" style={{ marginBottom: 10 }}>
          <button className={`exec-tab ${tab === 'profiles' ? 'active' : ''}`} onClick={() => setTab('profiles')}>Perfiles ({profiles.length})</button>
          <button className={`exec-tab ${tab === 'test' ? 'active' : ''}`} onClick={() => setTab('test')}>Probar</button>
          <button className={`exec-tab ${tab === 'log' ? 'active' : ''}`} onClick={() => setTab('log')}>Registro</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Profiles tab */}
          {tab === 'profiles' && (
            <>
              {showNew && (
                <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: 10, marginBottom: 10 }}>
                  <div className="form-group">
                    <label>Nombre</label>
                    <input value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} placeholder="Perfil de produccion..." />
                  </div>
                  <div className="form-group">
                    <label>Descripcion</label>
                    <textarea rows={2} value={newForm.description} onChange={(e) => setNewForm({ ...newForm, description: e.target.value })} placeholder="Reglas de aprobacion para..." />
                  </div>
                  <button className="btn btn-primary" onClick={handleCreate} style={{ fontSize: 11 }}>Crear perfil</button>
                </div>
              )}

              {profiles.length === 0 ? <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>Sin perfiles de aprobacion.</p> :
              profiles.map((p) => {
                const isExpanded = expandedId === p.id;
                const rules = getRules(p);
                const editing = isEditingRules(p.id);
                return (
                  <div key={p.id} className="kb-entry" style={{ opacity: p.enabled ? 1 : 0.5 }}>
                    <div className="kb-entry-header" onClick={() => setExpandedId(isExpanded ? null : p.id)}>
                      <span className="kb-name">{p.name}</span>
                      {p.is_builtin && <span className="metrics-chip" style={{ color: 'var(--purple)' }}>builtin</span>}
                      <span className="metrics-chip">{rules.length} reglas</span>
                      <button
                        className={`conn-btn ${p.enabled ? 'connect' : ''}`}
                        onClick={(e) => { e.stopPropagation(); handleToggle(p.id); }}
                        title={p.enabled ? 'Desactivar' : 'Activar'}
                        style={{ width: 22, height: 22, fontSize: 10 }}
                      >
                        {p.enabled ? 'ON' : 'OFF'}
                      </button>
                      {!p.is_builtin && <button className="delete-btn" onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}>✗</button>}
                    </div>
                    {isExpanded && (
                      <div className="kb-detail">
                        {p.description && <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>{p.description}</p>}

                        {/* Rules editor */}
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Reglas</span>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {!editing && (
                                <button className="btn btn-secondary" onClick={() => startEditRules(p)} style={{ fontSize: 9, padding: '2px 8px' }}>Editar</button>
                              )}
                              {editing && (
                                <>
                                  <button className="btn btn-secondary" onClick={() => addRule(p.id)} style={{ fontSize: 9, padding: '2px 8px' }}>+ Regla</button>
                                  <button className="btn btn-primary" onClick={() => saveRules(p.id)} style={{ fontSize: 9, padding: '2px 8px' }}>Guardar</button>
                                  <button className="btn btn-secondary" onClick={() => cancelEditRules(p.id)} style={{ fontSize: 9, padding: '2px 8px' }}>Cancelar</button>
                                </>
                              )}
                            </div>
                          </div>
                          {rules.length === 0 ? <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>Sin reglas definidas.</p> :
                            rules.map((rule, i) => (
                              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 10 }}>
                                {editing ? (
                                  <>
                                    <input
                                      value={rule.pattern}
                                      onChange={(e) => updateRule(p.id, i, 'pattern', e.target.value)}
                                      placeholder="regex patron..."
                                      style={{ flex: 2, fontFamily: 'var(--font-mono)', fontSize: 10, padding: '3px 6px' }}
                                    />
                                    <select value={rule.decision} onChange={(e) => updateRule(p.id, i, 'decision', e.target.value)} style={{ fontSize: 10, padding: '3px 4px' }}>
                                      <option value="approved">Aprobado</option>
                                      <option value="denied">Denegado</option>
                                      <option value="manual">Manual</option>
                                    </select>
                                    <select value={rule.risk_level} onChange={(e) => updateRule(p.id, i, 'risk_level', e.target.value)} style={{ fontSize: 10, padding: '3px 4px' }}>
                                      <option value="low">Bajo</option>
                                      <option value="medium">Medio</option>
                                      <option value="high">Alto</option>
                                      <option value="critical">Critico</option>
                                    </select>
                                    <button className="delete-btn" onClick={() => removeRule(p.id, i)} style={{ fontSize: 10 }}>✗</button>
                                  </>
                                ) : (
                                  <>
                                    <code style={{ flex: 2, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{rule.pattern}</code>
                                    <span style={{ color: DECISION_COLORS[rule.decision], fontWeight: 600 }}>{DECISION_LABELS[rule.decision] || rule.decision}</span>
                                    <span className="metrics-chip" style={{ color: RISK_COLORS[rule.risk_level] }}>{RISK_LABELS[rule.risk_level] || rule.risk_level}</span>
                                  </>
                                )}
                              </div>
                            ))
                          }
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {/* Test tab */}
          {tab === 'test' && (
            <div style={{ padding: '10px 0' }}>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10 }}>Probar un comando contra los perfiles de aprobacion activos.</p>
              <div className="form-group">
                <label>Comando a probar</label>
                <input value={testCmd} onChange={(e) => setTestCmd(e.target.value)} placeholder="rm -rf /var/log/*" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }} />
              </div>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>ID de conexion (opcional)</label>
                  <input type="number" value={testConnId} onChange={(e) => setTestConnId(e.target.value)} placeholder="ID..." />
                </div>
                <button className="btn btn-primary" onClick={handleTest} disabled={testing || !testCmd} style={{ fontSize: 11, alignSelf: 'flex-end', marginBottom: 14 }}>
                  {testing ? 'Probando...' : 'Probar'}
                </button>
              </div>

              {testResult && (
                <div style={{
                  background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: 12, marginTop: 10,
                  borderLeft: `3px solid ${testResult.error ? 'var(--red)' : DECISION_COLORS[testResult.decision] || 'var(--text-muted)'}`,
                }}>
                  {testResult.error ? (
                    <p style={{ color: 'var(--red)', fontSize: 12 }}>Error: {testResult.error}</p>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: 18, fontWeight: 700, color: DECISION_COLORS[testResult.decision] }}>
                          {DECISION_LABELS[testResult.decision] || testResult.decision}
                        </span>
                        {testResult.risk_level && (
                          <span className="metrics-chip" style={{ color: RISK_COLORS[testResult.risk_level] }}>
                            Riesgo: {RISK_LABELS[testResult.risk_level] || testResult.risk_level}
                          </span>
                        )}
                      </div>
                      {testResult.profile && <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Perfil: {testResult.profile}</p>}
                      {testResult.reason && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Razon: {testResult.reason}</p>}
                      {testResult.matched_rule && <code style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>Patron: {testResult.matched_rule}</code>}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Log tab */}
          {tab === 'log' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Ultimas decisiones de aprobacion</span>
                <button className="btn btn-secondary" onClick={loadLog} style={{ fontSize: 9, padding: '2px 8px' }}>Actualizar</button>
              </div>
              {log.length === 0 ? <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20, fontSize: 11 }}>Sin registros.</p> :
              log.map((entry, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: DECISION_COLORS[entry.decision] || 'var(--text-muted)', flexShrink: 0 }} />
                  <span style={{ color: 'var(--text-muted)', minWidth: 110 }}>{formatDate(entry.created_at || entry.timestamp)}</span>
                  <span style={{ color: DECISION_COLORS[entry.decision], fontWeight: 600, minWidth: 70 }}>{DECISION_LABELS[entry.decision] || entry.decision}</span>
                  <code style={{ flex: 1, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.command}</code>
                  {entry.risk_level && <span className="metrics-chip" style={{ color: RISK_COLORS[entry.risk_level] }}>{RISK_LABELS[entry.risk_level]}</span>}
                  {entry.profile_name && <span className="metrics-chip">{entry.profile_name}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-actions">
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{profiles.length} perfiles ({profiles.filter((p) => p.enabled).length} activos)</span>
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

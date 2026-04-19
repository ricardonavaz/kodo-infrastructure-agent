import React, { useState, useEffect } from 'react';
import { api } from '../hooks/useApi.js';

const SEVERITY_COLORS = { critical: 'var(--red)', high: 'var(--amber)', medium: 'var(--blue)', low: 'var(--accent)' };
const SEVERITY_LABELS = { critical: 'Critico', high: 'Alto', medium: 'Medio', low: 'Bajo' };
const RULE_LABELS = { block_command: 'Bloquear', warn_before: 'Advertir' };
const OS_LABELS = { all: 'Todos', linux: 'Linux', windows: 'Windows' };

export default function DirectivesManager({ connections, onClose }) {
  const [directives, setDirectives] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestConnId, setSuggestConnId] = useState('');
  const [newForm, setNewForm] = useState({
    title: '', description: '', rule_type: 'warn_before',
    os_scope: 'all', detection_pattern: '', severity: 'high',
  });

  const load = async () => {
    try { setDirectives(await api.getDirectives()); } catch { /* ignore */ }
  };

  useEffect(() => { load(); }, []);

  const handleToggle = async (id) => {
    await api.toggleDirective(id);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Eliminar esta directriz?')) return;
    try { await api.deleteDirective(id); load(); } catch (e) { alert(e.message); }
  };

  const handleCreate = async () => {
    if (!newForm.title) return alert('Titulo requerido');
    try {
      await api.createDirective(newForm);
      setShowNew(false);
      setNewForm({ title: '', description: '', rule_type: 'warn_before', os_scope: 'all', detection_pattern: '', severity: 'high' });
      load();
    } catch (e) { alert(e.message); }
  };

  const handleSuggest = async () => {
    setSuggesting(true);
    setSuggestions([]);
    try {
      const result = await api.suggestDirectives({ connectionId: suggestConnId || undefined });
      setSuggestions(result.suggestions || []);
    } catch (e) { alert('Error: ' + e.message); }
    setSuggesting(false);
  };

  const handleAcceptSuggestion = async (suggestion) => {
    try {
      await api.createDirective(suggestion);
      setSuggestions((prev) => prev.filter((s) => s.title !== suggestion.title));
      load();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 750, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>// Directrices de Seguridad</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-secondary" onClick={() => setShowNew(!showNew)} style={{ fontSize: 11 }}>
              {showNew ? 'Cancelar' : '+ Nueva'}
            </button>
          </div>
        </div>

        {/* New directive form */}
        {showNew && (
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: 10, marginBottom: 10 }}>
            <div className="form-group"><label>Titulo</label><input value={newForm.title} onChange={(e) => setNewForm({ ...newForm, title: e.target.value })} placeholder="No cerrar puerto X en..." /></div>
            <div className="form-group"><label>Descripcion</label><textarea rows={2} value={newForm.description} onChange={(e) => setNewForm({ ...newForm, description: e.target.value })} placeholder="Explicacion del riesgo..." /></div>
            <div className="form-row">
              <div className="form-group">
                <label>Tipo de regla</label>
                <select value={newForm.rule_type} onChange={(e) => setNewForm({ ...newForm, rule_type: e.target.value })}>
                  <option value="block_command">Bloquear comando</option>
                  <option value="warn_before">Advertir antes</option>
                </select>
              </div>
              <div className="form-group">
                <label>OS</label>
                <select value={newForm.os_scope} onChange={(e) => setNewForm({ ...newForm, os_scope: e.target.value })}>
                  <option value="all">Todos</option>
                  <option value="linux">Linux</option>
                  <option value="windows">Windows</option>
                </select>
              </div>
              <div className="form-group">
                <label>Severidad</label>
                <select value={newForm.severity} onChange={(e) => setNewForm({ ...newForm, severity: e.target.value })}>
                  <option value="critical">Critico</option>
                  <option value="high">Alto</option>
                  <option value="medium">Medio</option>
                </select>
              </div>
            </div>
            <div className="form-group"><label>Patron de deteccion (regex)</label><input value={newForm.detection_pattern} onChange={(e) => setNewForm({ ...newForm, detection_pattern: e.target.value })} placeholder="ufw\s+deny.*\b22\b|..." style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }} /></div>
            <button className="btn btn-primary" onClick={handleCreate} style={{ fontSize: 11 }}>Guardar directriz</button>
          </div>
        )}

        {/* AI Suggestions */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <select value={suggestConnId} onChange={(e) => setSuggestConnId(e.target.value)} style={{ flex: 1, fontSize: 11 }}>
            <option value="">Contexto global (sin servidor)</option>
            {connections?.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.host})</option>)}
          </select>
          <button className="btn btn-primary" onClick={handleSuggest} disabled={suggesting} style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
            {suggesting ? 'Analizando...' : 'Sugerir con IA'}
          </button>
        </div>

        {suggestions.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <p style={{ fontSize: 11, color: 'var(--purple)', marginBottom: 6 }}>Sugerencias de la IA ({suggestions.length}):</p>
            {suggestions.map((s, i) => (
              <div key={i} style={{ background: 'rgba(210,168,255,0.05)', border: '1px solid rgba(210,168,255,0.2)', borderRadius: 6, padding: 8, marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{s.title}</span>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '4px 0' }}>{s.description}</p>
                    {s.ai_reasoning && <p style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>IA: {s.ai_reasoning}</p>}
                  </div>
                  <button className="btn btn-primary" onClick={() => handleAcceptSuggestion(s)} style={{ fontSize: 10, padding: '4px 10px', whiteSpace: 'nowrap' }}>Aceptar</button>
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  <span className="metrics-chip" style={{ color: SEVERITY_COLORS[s.severity] }}>{SEVERITY_LABELS[s.severity]}</span>
                  <span className="metrics-chip">{OS_LABELS[s.os_scope]}</span>
                  <span className="metrics-chip">{RULE_LABELS[s.rule_type]}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Directives list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {directives.length === 0 ? <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>Sin directrices.</p> :
          directives.map((d) => (
            <div key={d.id} className="kb-entry" style={{ borderLeft: `3px solid ${SEVERITY_COLORS[d.severity]}`, opacity: d.enabled ? 1 : 0.5 }}>
              <div className="kb-entry-header">
                <span className="kb-name">{d.title}</span>
                <span className="metrics-chip" style={{ color: SEVERITY_COLORS[d.severity] }}>{SEVERITY_LABELS[d.severity]}</span>
                <span className="metrics-chip">{RULE_LABELS[d.rule_type]}</span>
                <span className="metrics-chip">{OS_LABELS[d.os_scope]}</span>
                {d.is_builtin ? <span className="metrics-chip">builtin</span> : null}
                {d.suggested_by_ai ? <span className="metrics-chip" style={{ color: 'var(--purple)' }}>IA</span> : null}
                <button
                  className={`conn-btn ${d.enabled ? 'connect' : ''}`}
                  onClick={() => handleToggle(d.id)}
                  title={d.enabled ? 'Desactivar' : 'Activar'}
                  style={{ width: 22, height: 22, fontSize: 10 }}
                >
                  {d.enabled ? 'ON' : 'OFF'}
                </button>
                {!d.is_builtin && <button className="delete-btn" onClick={() => handleDelete(d.id)}>✗</button>}
              </div>
              {d.description && <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '4px 0 0 0', lineHeight: 1.4 }}>{d.description}</p>}
              {d.detection_pattern && <code style={{ fontSize: 9, color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>{d.detection_pattern}</code>}
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{directives.length} directrices ({directives.filter((d) => d.enabled).length} activas)</span>
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

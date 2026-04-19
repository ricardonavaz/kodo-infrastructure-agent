import React, { useState, useEffect, useRef } from 'react';
import { api } from '../hooks/useApi.js';

const STEP_TYPES = [
  { value: 'command', label: 'Comando SSH', icon: '>' },
  { value: 'invoke_playbook', label: 'Sub-Playbook', icon: '\u27F3' },
  { value: 'message', label: 'Mensaje', icon: '\u2709' },
  { value: 'prompt', label: 'Solicitar Info', icon: '?' },
  { value: 'approval_gate', label: 'Gate de Aprobacion', icon: '\u2298' },
];

const STEP_COLORS = {
  command: 'var(--accent)',
  invoke_playbook: 'var(--blue)',
  message: 'var(--purple)',
  prompt: 'var(--amber)',
  approval_gate: 'var(--red)',
};

const MESSAGE_STYLES = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'success', label: 'Success' },
];

const emptyStep = (type = 'command') => {
  const base = { type, name: '' };
  switch (type) {
    case 'command': return { ...base, command: '' };
    case 'invoke_playbook': return { ...base, playbook_id: '', variables: {} };
    case 'message': return { ...base, title: '', text: '', style: 'info' };
    case 'prompt': return { ...base, text: '', variable_name: '', input_type: 'text', options: [] };
    case 'approval_gate': return { ...base, text: '' };
    default: return base;
  }
};

export default function PlaybookEditor({ playbook, onSave, onClose }) {
  const [form, setForm] = useState(() => {
    if (playbook) {
      return {
        name: playbook.name || '',
        description: playbook.description || '',
        objective: playbook.objective || '',
        category: playbook.category || 'custom',
        compatible_systems: JSON.parse(playbook.compatible_systems || '["linux"]'),
        command_sequence: JSON.parse(playbook.command_sequence || '[]').map((s) => ({ ...s, type: s.type || 'command' })),
        required_variables: JSON.parse(playbook.required_variables || '[]'),
        rollback_commands: JSON.parse(playbook.rollback_commands || '[]'),
        auditor_mode: playbook.auditor_mode || 'none',
        execution_mode: playbook.execution_mode || 'sequential',
      };
    }
    return {
      name: '', description: '', objective: '', category: 'custom',
      compatible_systems: ['linux'], command_sequence: [],
      required_variables: [], rollback_commands: [],
      auditor_mode: 'none', execution_mode: 'sequential',
    };
  });

  const [allPlaybooks, setAllPlaybooks] = useState([]);
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const dragOverIndex = useRef(null);

  useEffect(() => {
    api.getPlaybooks().then(setAllPlaybooks).catch(() => {});
  }, []);

  const updateStep = (index, field, value) => {
    const updated = [...form.command_sequence];
    updated[index] = { ...updated[index], [field]: value };
    setForm({ ...form, command_sequence: updated });
  };

  const addStep = (type) => {
    setForm({ ...form, command_sequence: [...form.command_sequence, emptyStep(type)] });
  };

  const removeStep = (index) => {
    setForm({ ...form, command_sequence: form.command_sequence.filter((_, i) => i !== index) });
  };

  const moveStep = (from, to) => {
    const updated = [...form.command_sequence];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    setForm({ ...form, command_sequence: updated });
  };

  const handleDragStart = (index) => { setDragIndex(index); };
  const handleDragOver = (e, index) => { e.preventDefault(); dragOverIndex.current = index; };
  const handleDrop = () => {
    if (dragIndex !== null && dragOverIndex.current !== null && dragIndex !== dragOverIndex.current) {
      moveStep(dragIndex, dragOverIndex.current);
    }
    setDragIndex(null);
    dragOverIndex.current = null;
  };

  const handleSave = async () => {
    if (!form.name) return alert('Nombre requerido');
    setSaving(true);
    try {
      const data = {
        ...form,
        compatible_systems: form.compatible_systems,
        command_sequence: form.command_sequence,
        required_variables: form.required_variables,
        rollback_commands: form.rollback_commands,
      };
      if (playbook?.id) {
        await api.updatePlaybook(playbook.id, data);
      } else {
        await api.createPlaybook(data);
      }
      onSave?.();
      onClose();
    } catch (e) { alert('Error: ' + e.message); }
    setSaving(false);
  };

  const renderStepConfig = (step, index) => {
    switch (step.type) {
      case 'command':
        return (
          <>
            <div className="pbe-field">
              <input value={step.name} onChange={(e) => updateStep(index, 'name', e.target.value)} placeholder="Nombre del paso" className="pbe-input" />
            </div>
            <div className="pbe-field">
              <textarea rows={2} value={step.command} onChange={(e) => updateStep(index, 'command', e.target.value)} placeholder="Comando SSH..." className="pbe-input pbe-input--mono" />
            </div>
          </>
        );

      case 'invoke_playbook':
        return (
          <>
            <div className="pbe-field">
              <input value={step.name} onChange={(e) => updateStep(index, 'name', e.target.value)} placeholder="Nombre del paso" className="pbe-input" />
            </div>
            <div className="pbe-field">
              <select value={step.playbook_id || ''} onChange={(e) => updateStep(index, 'playbook_id', parseInt(e.target.value) || '')} className="pbe-input">
                <option value="">Seleccionar playbook...</option>
                {allPlaybooks.filter((p) => p.id !== playbook?.id).map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.category})</option>
                ))}
              </select>
            </div>
          </>
        );

      case 'message':
        return (
          <>
            <div className="pbe-field">
              <input value={step.name} onChange={(e) => updateStep(index, 'name', e.target.value)} placeholder="Nombre del paso" className="pbe-input" />
            </div>
            <div className="pbe-field-row">
              <input value={step.title || ''} onChange={(e) => updateStep(index, 'title', e.target.value)} placeholder="Titulo del mensaje" className="pbe-input" style={{ flex: 1 }} />
              <select value={step.style || 'info'} onChange={(e) => updateStep(index, 'style', e.target.value)} className="pbe-input" style={{ width: 100 }}>
                {MESSAGE_STYLES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="pbe-field">
              <textarea rows={3} value={step.text || ''} onChange={(e) => updateStep(index, 'text', e.target.value)} placeholder="Contenido del mensaje..." className="pbe-input" />
            </div>
          </>
        );

      case 'prompt':
        return (
          <>
            <div className="pbe-field">
              <input value={step.name} onChange={(e) => updateStep(index, 'name', e.target.value)} placeholder="Nombre del paso" className="pbe-input" />
            </div>
            <div className="pbe-field">
              <textarea rows={2} value={step.text || ''} onChange={(e) => updateStep(index, 'text', e.target.value)} placeholder="Texto de la pregunta..." className="pbe-input" />
            </div>
            <div className="pbe-field-row">
              <input value={step.variable_name || ''} onChange={(e) => updateStep(index, 'variable_name', e.target.value)} placeholder="Nombre de variable (ej: service_name)" className="pbe-input" style={{ flex: 1 }} />
              <select value={step.input_type || 'text'} onChange={(e) => updateStep(index, 'input_type', e.target.value)} className="pbe-input" style={{ width: 110 }}>
                <option value="text">Texto</option>
                <option value="select">Seleccion</option>
                <option value="confirm">Confirmar</option>
              </select>
            </div>
          </>
        );

      case 'approval_gate':
        return (
          <>
            <div className="pbe-field">
              <input value={step.name} onChange={(e) => updateStep(index, 'name', e.target.value)} placeholder="Nombre del gate" className="pbe-input" />
            </div>
            <div className="pbe-field">
              <textarea rows={2} value={step.text || ''} onChange={(e) => updateStep(index, 'text', e.target.value)} placeholder="Descripcion de lo que se requiere aprobar..." className="pbe-input" />
            </div>
          </>
        );

      default:
        return <p className="pbe-unknown">Tipo desconocido: {step.type}</p>;
    }
  };

  return (
    <div className="pb-overlay" onClick={onClose} style={{ zIndex: 110 }}>
      <div className="pbe-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pbe-header">
          <h3>{playbook ? 'Editar Playbook' : 'Nuevo Playbook'}</h3>
          <button className="pbe-close" onClick={onClose}>&times;</button>
        </div>

        <div className="pbe-body">
          {/* Basic info */}
          <div className="pbe-section">
            <div className="pbe-field">
              <label className="pbe-label">Nombre</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre del playbook" className="pbe-input" />
            </div>
            <div className="pbe-field">
              <label className="pbe-label">Descripcion</label>
              <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripcion..." className="pbe-input" />
            </div>
            <div className="pbe-field">
              <label className="pbe-label">Objetivo</label>
              <input value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} placeholder="Objetivo del playbook" className="pbe-input" />
            </div>

            <div className="pbe-field-row">
              <div className="pbe-field" style={{ flex: 1 }}>
                <label className="pbe-label">Categoria</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="pbe-input">
                  <option value="custom">Custom</option>
                  <option value="monitoring">Monitoring</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="diagnostic">Diagnostic</option>
                  <option value="security">Security</option>
                  <option value="deployment">Deployment</option>
                  <option value="configuration">Configuration</option>
                </select>
              </div>
              <div className="pbe-field" style={{ flex: 1 }}>
                <label className="pbe-label">Auditor</label>
                <select value={form.auditor_mode} onChange={(e) => setForm({ ...form, auditor_mode: e.target.value })} className="pbe-input">
                  <option value="none">Sin auditor</option>
                  <option value="audit_log">Solo registro</option>
                  <option value="supervised">Supervisado</option>
                </select>
              </div>
              <div className="pbe-field" style={{ flex: 1 }}>
                <label className="pbe-label">Ejecucion</label>
                <select value={form.execution_mode} onChange={(e) => setForm({ ...form, execution_mode: e.target.value })} className="pbe-input">
                  <option value="sequential">Secuencial</option>
                  <option value="non_stop">Non-stop</option>
                </select>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="pbe-section">
            <h4 className="pbe-section-title">Pasos ({form.command_sequence.length})</h4>

            {form.command_sequence.map((step, i) => (
              <div
                key={i}
                className={`pbe-step ${dragIndex === i ? 'dragging' : ''}`}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={handleDrop}
              >
                <div className="pbe-step-header">
                  <span className="pbe-step-drag" title="Arrastrar para reordenar">::</span>
                  <span className="pbe-step-num">{i + 1}</span>
                  <span className="pbe-step-type" style={{ color: STEP_COLORS[step.type] }}>
                    {STEP_TYPES.find((t) => t.value === step.type)?.icon} {STEP_TYPES.find((t) => t.value === step.type)?.label}
                  </span>
                  <span style={{ flex: 1 }} />
                  <select
                    value={step.type}
                    onChange={(e) => {
                      const newStep = emptyStep(e.target.value);
                      newStep.name = step.name;
                      const updated = [...form.command_sequence];
                      updated[i] = newStep;
                      setForm({ ...form, command_sequence: updated });
                    }}
                    className="pbe-input pbe-input--sm"
                    style={{ width: 130 }}
                  >
                    {STEP_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <button className="pbe-step-remove" onClick={() => removeStep(i)} title="Eliminar paso">&times;</button>
                </div>
                <div className="pbe-step-body">
                  {renderStepConfig(step, i)}
                </div>
              </div>
            ))}

            <div className="pbe-add-steps">
              {STEP_TYPES.map((t) => (
                <button key={t.value} className="pbe-add-btn" onClick={() => addStep(t.value)} style={{ color: STEP_COLORS[t.value] }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pbe-footer">
          <button className="pb-btn pb-btn--secondary" onClick={onClose}>Cancelar</button>
          <button className="pb-btn pb-btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar Playbook'}
          </button>
        </div>
      </div>
    </div>
  );
}

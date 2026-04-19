import React from 'react';

const MODELS = [
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', desc: 'Rapido y economico', tier: 'default' },
  { id: 'claude-sonnet-4-20250514', label: 'Sonnet 4', desc: 'Tareas complejas', tier: 'superior' },
  { id: 'claude-opus-4-20250514', label: 'Opus 4', desc: 'Maximo razonamiento', tier: 'superior' },
];

export const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

export function getModelLabel(modelId) {
  const m = MODELS.find((m) => m.id === modelId);
  return m ? m.label : modelId?.split('-').slice(1, 3).join(' ') || 'Haiku';
}

export default function ModelSelector({ value, onChange, compact = false }) {
  if (compact) {
    return (
      <select
        className="model-selector compact"
        value={value || DEFAULT_MODEL}
        onChange={(e) => onChange(e.target.value)}
        title="Modelo IA — Haiku por defecto, selecciona Sonnet/Opus para tareas superiores"
      >
        {MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.tier === 'superior' ? '★ ' : ''}{m.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="form-group">
      <label>Modelo AI</label>
      <select
        className="model-selector"
        value={value || DEFAULT_MODEL}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%' }}
      >
        {MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.tier === 'superior' ? '★ ' : ''}{m.label} - {m.desc}
          </option>
        ))}
      </select>
    </div>
  );
}

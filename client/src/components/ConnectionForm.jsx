import React, { useState } from 'react';

const defaultForm = {
  name: '',
  host: '',
  port: 22,
  username: '',
  auth_type: 'password',
  credentials: '',
  os_type: 'linux',
  environment: 'production',
  tags: [],
  description: '',
  is_favorite: false,
};

const ENVIRONMENTS = [
  { value: 'production', label: 'Produccion', color: 'var(--accent)' },
  { value: 'staging', label: 'Staging', color: 'var(--amber)' },
  { value: 'test', label: 'Test', color: '#d2a8ff' },
  { value: 'dev', label: 'Dev', color: 'var(--blue)' },
];

export default function ConnectionForm({ connection, onSave, onClose }) {
  const [form, setForm] = useState(() => {
    if (connection) {
      return {
        ...connection,
        tags: typeof connection.tags === 'string' ? JSON.parse(connection.tags || '[]') : (connection.tags || []),
        credentials: '',
      };
    }
    return defaultForm;
  });
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [duplicate, setDuplicate] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setDuplicate(null);
    try {
      // Trim SSH key whitespace - critical for proper authentication
      const formToSave = { ...form };
      if (formToSave.auth_type === 'key' && formToSave.credentials) {
        formToSave.credentials = formToSave.credentials.trim();
      }
      await onSave(formToSave);
      onClose();
    } catch (err) {
      if (err.message.includes('Ya existe')) {
        setDuplicate(err.message);
      } else {
        alert(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !form.tags.includes(tag)) {
      update('tags', [...form.tags, tag]);
    }
    setTagInput('');
  };

  const removeTag = (tag) => {
    update('tags', form.tags.filter((t) => t !== tag));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{connection ? '// Editar servidor' : '// Nuevo servidor'}</h3>

        {duplicate && (
          <div className="duplicate-warning">{duplicate}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label>Nombre</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="prod-web-01"
                required
              />
            </div>
            <div className="form-group" style={{ flex: 0 }}>
              <label>Favorito</label>
              <button
                type="button"
                className={`fav-toggle ${form.is_favorite ? 'active' : ''}`}
                onClick={() => update('is_favorite', !form.is_favorite)}
              >
                <svg width="16" height="16" viewBox="0 0 12 12" fill={form.is_favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1">
                  <path d="M6 1l1.5 3.1L11 4.5 8.5 7l.6 3.5L6 8.8 2.9 10.5l.6-3.5L1 4.5l3.5-.4z" />
                </svg>
              </button>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Host</label>
              <input
                type="text"
                value={form.host}
                onChange={(e) => update('host', e.target.value)}
                placeholder="192.168.1.100"
                required
              />
            </div>
            <div className="form-group" style={{ maxWidth: 100 }}>
              <label>Puerto</label>
              <input
                type="number"
                value={form.port}
                onChange={(e) => update('port', parseInt(e.target.value) || 22)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Usuario</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => update('username', e.target.value)}
              placeholder="root"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Autenticacion</label>
              <select
                value={form.auth_type}
                onChange={(e) => update('auth_type', e.target.value)}
              >
                <option value="password">Password</option>
                <option value="key">SSH Key</option>
              </select>
            </div>
            <div className="form-group">
              <label>Sistema Operativo</label>
              <select
                value={form.os_type}
                onChange={(e) => update('os_type', e.target.value)}
              >
                <option value="linux">Linux</option>
                <option value="windows">Windows</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>{form.auth_type === 'key' ? 'Clave privada' : 'Password'}</label>
            {form.auth_type === 'key' ? (
              <textarea
                rows={4}
                value={form.credentials}
                onChange={(e) => update('credentials', e.target.value)}
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}
              />
            ) : (
              <input
                type="password"
                value={form.credentials}
                onChange={(e) => update('credentials', e.target.value)}
                placeholder={connection ? '(sin cambios)' : '********'}
              />
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Entorno</label>
              <select
                value={form.environment}
                onChange={(e) => update('environment', e.target.value)}
              >
                {ENVIRONMENTS.map((e) => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Etiquetas</label>
            <div className="tags-input-wrapper">
              <div className="tags-list">
                {form.tags.map((tag) => (
                  <span key={tag} className="tag-pill">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)}>&times;</button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                onBlur={addTag}
                placeholder="Agregar etiqueta..."
                className="tag-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Descripcion</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="Servidor web principal, nginx + node..."
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

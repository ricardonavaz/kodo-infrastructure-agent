import React, { useState, useEffect } from 'react';
import { api } from '../hooks/useApi.js';

const GROUP_TYPES = [
  { value: 'client', label: 'Cliente' },
  { value: 'project', label: 'Proyecto' },
  { value: 'function', label: 'Funcion' },
  { value: 'custom', label: 'Personalizado' },
];

const COLORS = ['#00ff41', '#58a6ff', '#d2a8ff', '#ffb800', '#ff4444', '#ff7b72', '#79c0ff', '#7ee787'];

export default function GroupManager({ connections, onClose, onUpdate }) {
  const [groups, setGroups] = useState([]);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('custom');
  const [newColor, setNewColor] = useState('#00ff41');
  const [editingId, setEditingId] = useState(null);
  const [assigningId, setAssigningId] = useState(null);

  const loadGroups = async () => {
    const data = await api.getGroups();
    setGroups(data);
  };

  useEffect(() => { loadGroups(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await api.createGroup({ name: newName.trim(), type: newType, color: newColor });
    setNewName('');
    loadGroups();
    onUpdate?.();
  };

  const handleDelete = async (id) => {
    if (!confirm('Eliminar grupo?')) return;
    await api.deleteGroup(id);
    loadGroups();
    onUpdate?.();
  };

  const handleToggleMember = async (groupId, connectionId, isMember) => {
    if (isMember) {
      await api.removeFromGroup(groupId, connectionId);
    } else {
      await api.addToGroup(groupId, connectionId);
    }
    loadGroups();
    onUpdate?.();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <h3>// Grupos de servidores</h3>

        {/* Create group */}
        <div className="form-row" style={{ marginBottom: 16 }}>
          <div className="form-group" style={{ flex: 2 }}>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre del grupo..."
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <select value={newType} onChange={(e) => setNewType(e.target.value)}>
              {GROUP_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', paddingBottom: 14 }}>
            {COLORS.slice(0, 4).map((c) => (
              <button
                key={c}
                className={`color-dot ${newColor === c ? 'selected' : ''}`}
                style={{ background: c }}
                onClick={() => setNewColor(c)}
              />
            ))}
          </div>
          <button className="btn btn-primary" onClick={handleCreate} style={{ alignSelf: 'flex-end', marginBottom: 14 }}>
            +
          </button>
        </div>

        {/* Groups list */}
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {groups.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>
              Sin grupos. Crea uno arriba.
            </p>
          )}
          {groups.map((group) => (
            <div key={group.id} className="group-item">
              <div className="group-item-header">
                <div className="group-color-dot" style={{ background: group.color }} />
                <span className="group-item-name">{group.name}</span>
                <span className="group-item-type">{group.type}</span>
                <span className="group-item-count">{group.member_count} servers</span>
                <button
                  className="icon-btn"
                  onClick={() => setAssigningId(assigningId === group.id ? null : group.id)}
                  title="Asignar servidores"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M6 1v10M1 6h10" />
                  </svg>
                </button>
                <button className="icon-btn" onClick={() => handleDelete(group.id)} title="Eliminar">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2 2l6 6M8 2l-6 6" />
                  </svg>
                </button>
              </div>

              {assigningId === group.id && (
                <div className="group-members-list">
                  {connections.map((conn) => {
                    const isMember = group.members?.some((m) => m.id === conn.id);
                    return (
                      <label key={conn.id} className="member-checkbox">
                        <input
                          type="checkbox"
                          checked={!!isMember}
                          onChange={() => handleToggleMember(group.id, conn.id, isMember)}
                        />
                        <span>{conn.name}</span>
                        <span className="member-host">{conn.host}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

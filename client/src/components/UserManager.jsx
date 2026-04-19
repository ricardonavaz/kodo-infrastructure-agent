import React, { useState, useEffect } from 'react';
import { api } from '../hooks/useApi.js';

const ROLE_LABELS = { admin: 'Admin', operator: 'Operador', viewer: 'Viewer' };
const ROLE_COLORS = { admin: 'var(--red)', operator: 'var(--accent)', viewer: 'var(--blue)' };

export default function UserManager({ onClose }) {
  const [users, setUsers] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', display_name: '', role: 'operator' });

  const load = async () => {
    try { setUsers(await api.getUsers()); } catch { /* ignore */ }
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.username || !form.password) return alert('Usuario y password requeridos');
    try {
      await api.createUser(form);
      setShowNew(false);
      setForm({ username: '', password: '', display_name: '', role: 'operator' });
      load();
    } catch (e) { alert(e.message); }
  };

  const handleToggle = async (user) => {
    try {
      await api.updateUser(user.id, { enabled: !user.enabled });
      load();
    } catch (e) { alert(e.message); }
  };

  const handleResetPassword = async (user) => {
    const newPw = prompt(`Nueva password para ${user.username} (min 6 chars):`);
    if (!newPw || newPw.length < 6) return;
    try {
      await api.updateUser(user.id, { password: newPw });
      alert('Password reseteada. El usuario debera cambiarla al ingresar.');
      load();
    } catch (e) { alert(e.message); }
  };

  const handleDelete = async (user) => {
    if (!confirm(`Eliminar usuario ${user.username}?`)) return;
    try { await api.deleteUser(user.id); load(); } catch (e) { alert(e.message); }
  };

  const handleRoleChange = async (user, newRole) => {
    try { await api.updateUser(user.id, { role: newRole }); load(); } catch (e) { alert(e.message); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 650, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>// Usuarios</h3>
          <button className="btn btn-primary" onClick={() => setShowNew(!showNew)} style={{ fontSize: 11 }}>
            {showNew ? 'Cancelar' : '+ Nuevo usuario'}
          </button>
        </div>

        {showNew && (
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: 10, marginBottom: 10 }}>
            <div className="form-row">
              <div className="form-group"><label>Usuario</label><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="nombre.usuario" /></div>
              <div className="form-group"><label>Nombre</label><input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="Nombre completo" /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Password</label><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 6 caracteres" /></div>
              <div className="form-group">
                <label>Rol</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="admin">Admin — Acceso total</option>
                  <option value="operator">Operador — Ejecutar, no config</option>
                  <option value="viewer">Viewer — Solo lectura</option>
                </select>
              </div>
            </div>
            <button className="btn btn-primary" onClick={handleCreate} style={{ fontSize: 11 }}>Crear usuario</button>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {users.map((u) => (
            <div key={u.id} className="kb-entry" style={{ opacity: u.enabled ? 1 : 0.5 }}>
              <div className="kb-entry-header">
                <span className="kb-name">{u.display_name || u.username}</span>
                <span className="metrics-chip" style={{ fontFamily: 'var(--font-mono)' }}>@{u.username}</span>
                <select value={u.role} onChange={(e) => handleRoleChange(u, e.target.value)} style={{ fontSize: 10, padding: '2px 4px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: ROLE_COLORS[u.role], borderRadius: 3 }}>
                  <option value="admin">Admin</option>
                  <option value="operator">Operador</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button className={`conn-btn ${u.enabled ? 'connect' : ''}`} onClick={() => handleToggle(u)} style={{ width: 22, height: 22, fontSize: 10 }}>{u.enabled ? 'ON' : 'OFF'}</button>
                <button className="btn btn-secondary" onClick={() => handleResetPassword(u)} style={{ padding: '2px 6px', fontSize: 9 }}>Reset PW</button>
                <button className="delete-btn" onClick={() => handleDelete(u)}>✗</button>
              </div>
              <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                <span>Creado: {u.created_at?.slice(0, 10)}</span>
                <span>Ultimo login: {u.last_login_at?.slice(0, 16) || 'nunca'}</span>
                {u.must_change_password ? <span style={{ color: 'var(--amber)' }}>Debe cambiar password</span> : null}
              </div>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{users.length} usuarios</span>
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

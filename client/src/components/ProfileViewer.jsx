import React, { useState, useEffect } from 'react';
import { api } from '../hooks/useApi.js';

export default function ProfileViewer({ connectionId, connectionName, onClose }) {
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const p = await api.getProfile(connectionId);
      setProfile(p);
      if (p) setForm({ role: p.role || '', responsible: p.responsible || '', sla_level: p.sla_level || '', custom_notes: p.custom_notes || '', maintenance_window: p.maintenance_window || '', os_family: p.os_family || '', os_version: p.os_version || '', distro: p.distro || '', shell_version: p.shell_version || '' });
    } catch { /* no profile */ }
  };

  useEffect(() => { load(); }, [connectionId]);

  const handleSave = async () => {
    await api.updateProfile(connectionId, form);
    setEditing(false);
    load();
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await api.refreshProfile(connectionId); load(); } catch (e) { alert(e.message); }
    setRefreshing(false);
  };

  const handleExport = () => {
    window.open(`/api/export/profile/${connectionId}?format=html`, '_blank');
  };

  if (!profile) return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>// Profile: {connectionName}</h3>
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>Sin profile. Conecta al servidor para generar uno automaticamente.</p>
        <div className="modal-actions"><button className="btn btn-secondary" onClick={onClose}>Cerrar</button></div>
      </div>
    </div>
  );

  const services = JSON.parse(profile.installed_services || '[]');
  const ports = JSON.parse(profile.open_ports || '[]');
  const pkgs = JSON.parse(profile.installed_packages || '[]');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 650, maxHeight: '85vh', overflowY: 'auto' }}>
        <h3>// Profile: {connectionName}</h3>

        <div className="profile-section">
          <h4 className="settings-section-title">Sistema (auto-detectado)</h4>
          <div className="profile-grid">
            <div className="profile-field"><label>OS</label><span>{profile.os_version || profile.distro || profile.os_family}</span></div>
            <div className="profile-field"><label>Kernel</label><span>{profile.kernel_version || 'N/A'}</span></div>
            <div className="profile-field"><label>Arch</label><span>{profile.arch || 'N/A'}</span></div>
            <div className="profile-field"><label>CPU</label><span>{profile.cpu_info || 'N/A'}</span></div>
            <div className="profile-field"><label>RAM</label><span>{profile.total_memory_mb ? profile.total_memory_mb + ' MB' : 'N/A'}</span></div>
            <div className="profile-field"><label>Disco</label><span>{profile.total_disk_mb ? Math.round(profile.total_disk_mb / 1024) + ' GB' : 'N/A'}</span></div>
            <div className="profile-field"><label>Pkg Manager</label><span>{profile.package_manager || 'N/A'}</span></div>
            <div className="profile-field"><label>Shell</label><span>{profile.shell_version ? (profile.os_family === 'windows' ? `PowerShell ${profile.shell_version}` : `Bash ${profile.shell_version}`) : 'N/A'}</span></div>
            <div className="profile-field"><label>Init</label><span>{profile.init_system || 'N/A'}</span></div>
          </div>
          {services.length > 0 && <p className="profile-list-label">Servicios ({services.length}): <span className="profile-list-val">{services.slice(0, 10).join(', ')}{services.length > 10 ? '...' : ''}</span></p>}
          {ports.length > 0 && <p className="profile-list-label">Puertos ({ports.length}): <span className="profile-list-val">{ports.slice(0, 8).join(', ')}{ports.length > 8 ? '...' : ''}</span></p>}
          {pkgs.length > 0 && <p className="profile-list-label">Paquetes: <span className="profile-list-val">{pkgs.length} detectados</span></p>}
          <p className="meta" style={{ marginTop: 8 }}>Ultimo escaneo: {profile.last_profiled_at || 'nunca'}</p>
        </div>

        <div className="profile-section" style={{ marginTop: 12 }}>
          <h4 className="settings-section-title">Datos manuales {!editing && <button className="btn btn-secondary" onClick={() => setEditing(true)} style={{ padding: '2px 8px', fontSize: 10, marginLeft: 8 }}>Editar</button>}</h4>
          {editing ? (
            <>
              <h4 className="settings-section-title" style={{ fontSize: 11, marginTop: 0, marginBottom: 8 }}>Sobreescrituras de OS</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>OS Family</label>
                  <select value={form.os_family} onChange={(e) => setForm({ ...form, os_family: e.target.value })}>
                    <option value="">—</option>
                    <option value="debian">Debian</option>
                    <option value="rhel">RHEL</option>
                    <option value="fedora">Fedora</option>
                    <option value="suse">SUSE</option>
                    <option value="arch">Arch</option>
                    <option value="alpine">Alpine</option>
                    <option value="windows">Windows</option>
                    <option value="unknown">Otro</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Shell Version</label>
                  <input value={form.shell_version} onChange={(e) => setForm({ ...form, shell_version: e.target.value })} placeholder="5.1, 7.4, 5.2.21..." />
                </div>
              </div>
              <div className="form-group"><label>OS Version</label><input value={form.os_version} onChange={(e) => setForm({ ...form, os_version: e.target.value })} placeholder="Microsoft Windows Server 2016 Standard, Ubuntu 22.04.3 LTS..." /></div>
              <div className="form-group"><label>Distro</label><input value={form.distro} onChange={(e) => setForm({ ...form, distro: e.target.value })} placeholder="windows-server-2016, ubuntu, rocky..." /></div>

              <h4 className="settings-section-title" style={{ fontSize: 11, marginTop: 12, marginBottom: 8 }}>Datos operativos</h4>
              <div className="form-group"><label>Rol</label><input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Web server, DB, Load balancer..." /></div>
              <div className="form-group"><label>Responsable</label><input value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} placeholder="Equipo o persona" /></div>
              <div className="form-row">
                <div className="form-group"><label>SLA</label><input value={form.sla_level} onChange={(e) => setForm({ ...form, sla_level: e.target.value })} placeholder="24x7, business hours" /></div>
                <div className="form-group"><label>Ventana Mto.</label><input value={form.maintenance_window} onChange={(e) => setForm({ ...form, maintenance_window: e.target.value })} placeholder="Sun 02:00-06:00" /></div>
              </div>
              <div className="form-group"><label>Notas</label><textarea rows={3} value={form.custom_notes} onChange={(e) => setForm({ ...form, custom_notes: e.target.value })} placeholder="Notas operativas..." /></div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={handleSave}>Guardar</button>
                <button className="btn btn-secondary" onClick={() => setEditing(false)}>Cancelar</button>
              </div>
            </>
          ) : (
            <div className="profile-grid">
              <div className="profile-field"><label>Rol</label><span>{profile.role || '—'}</span></div>
              <div className="profile-field"><label>Responsable</label><span>{profile.responsible || '—'}</span></div>
              <div className="profile-field"><label>SLA</label><span>{profile.sla_level || '—'}</span></div>
              <div className="profile-field"><label>Ventana Mto.</label><span>{profile.maintenance_window || '—'}</span></div>
              {profile.custom_notes && <div className="profile-field" style={{ gridColumn: '1 / -1' }}><label>Notas</label><span>{profile.custom_notes}</span></div>}
            </div>
          )}
        </div>

        <div className="modal-actions">
          <p className="meta" style={{ flex: 1 }}>El profile se actualiza automaticamente al conectar</p>
          <button className="btn btn-secondary" onClick={handleExport}>Exportar</button>
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

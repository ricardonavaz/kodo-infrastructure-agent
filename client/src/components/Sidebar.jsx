import React, { useState } from 'react';
import ServerStatus from './ServerStatus.jsx';
import SearchFilter from './SearchFilter.jsx';

const ENV_LABELS = {
  production: { label: 'PROD', className: 'env-badge prod' },
  staging: { label: 'STG', className: 'env-badge staging' },
  test: { label: 'TEST', className: 'env-badge test' },
  dev: { label: 'DEV', className: 'env-badge dev' },
};

const ROLE_LABELS = { admin: 'Admin', operator: 'Operador', viewer: 'Viewer' };

export default function Sidebar({
  connections, activeId, statuses, groups, filters, onFiltersChange,
  onSelect, onAdd, onDelete, onSettings, onConnect, onDisconnect,
  onToggleFavorite, onManageGroups, onShowAudit, onShowKB, onShowPlaybooks, onShowProfile,
  onShowDirectives, onShowScheduler, onShowApproval, onShowSecurity, onShowUserManager,
  onLogout, currentUser,
}) {
  const [navOpen, setNavOpen] = useState(() => {
    const saved = localStorage.getItem('kodo-nav-open');
    return saved !== null ? saved === 'true' : true;
  });
  const toggleNav = () => {
    setNavOpen((prev) => { localStorage.setItem('kodo-nav-open', String(!prev)); return !prev; });
  };
  const renderServer = (conn) => {
    const connStatus = statuses[conn.id]?.status || 'disconnected';
    const isActive = activeId === conn.id;
    const isConnected = connStatus === 'connected';
    const isConnecting = connStatus === 'connecting';
    const env = ENV_LABELS[conn.environment] || ENV_LABELS.production;

    return (
      <div key={conn.id} className={`server-item ${isActive ? 'active' : ''}`} onClick={() => onSelect(conn.id)}>
        <ServerStatus runtimeStatus={connStatus} persistentStatus={conn.status} />
        <div className="server-info">
          <div className="server-name-row">
            <span className="server-name">{conn.name}</span>
            {conn.is_favorite ? (
              <button className="fav-star active" onClick={(e) => { e.stopPropagation(); onToggleFavorite(conn.id); }}>
                <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor" stroke="currentColor" strokeWidth="0.5"><path d="M6 1l1.5 3.1L11 4.5 8.5 7l.6 3.5L6 8.8 2.9 10.5l.6-3.5L1 4.5l3.5-.4z" /></svg>
              </button>
            ) : null}
          </div>
          <div className="server-meta">
            <span className="server-host">{conn.username}@{conn.host}</span>
            <span className={env.className}>{env.label}</span>
          </div>
        </div>
        {currentUser?.role !== 'viewer' && (
          <div className="server-actions" style={{ display: isActive ? 'flex' : undefined }}>
            {isConnected ? (
              <button className="conn-btn disconnect" onClick={(e) => { e.stopPropagation(); onDisconnect(conn.id); }} title="Desconectar">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 2l8 8M10 2l-8 8" /></svg>
              </button>
            ) : (
              <button className={`conn-btn connect ${isConnecting ? 'loading' : ''}`} onClick={(e) => { e.stopPropagation(); if (!isConnecting) onConnect(conn.id); }} disabled={isConnecting} title="Conectar">
                {isConnecting ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="spin"><path d="M6 1a5 5 0 0 1 5 5" /></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 1l8 5-8 5V1z" /></svg>
                )}
              </button>
            )}
            <button className="delete-btn" onClick={(e) => { e.stopPropagation(); onDelete(conn.id); }} title="Eliminar">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 3h8M3.5 3V2a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M4 5v3M6 5v3M2 3l.5 6a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1L8 3" /></svg>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <span className="logo-kodo">Kodo</span>
          <span>Infrastructure Agent</span>
        </div>
        <div className="sidebar-actions">
          {currentUser?.role === 'admin' && (
            <button className="icon-btn" onClick={onSettings} title="Configuracion">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="2.5" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.93 2.93l1.41 1.41M11.66 11.66l1.41 1.41M2.93 13.07l1.41-1.41M11.66 4.34l1.41-1.41" /></svg>
            </button>
          )}
          {currentUser?.role !== 'viewer' && (
            <button className="icon-btn" onClick={onAdd} title="Agregar servidor">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v10M3 8h10" /></svg>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Menu - Collapsible */}
      <nav className={`sidebar-nav ${navOpen ? '' : 'collapsed'}`}>
        <button className="nav-toggle" onClick={toggleNav}>
          <span className="nav-toggle-label">Menu</span>
          <svg className={`nav-toggle-icon ${navOpen ? 'open' : ''}`} width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2.5 3.5L5 6l2.5-2.5" /></svg>
        </button>
        {navOpen && (
          <div className="nav-items">
            <div className="nav-section-label">Operaciones</div>
            <button className="nav-item" onClick={onShowPlaybooks}>
              <span className="nav-icon">📋</span>
              <span className="nav-label">Playbooks</span>
            </button>
            <button className="nav-item" onClick={onShowScheduler}>
              <span className="nav-icon">⏰</span>
              <span className="nav-label">Programador</span>
            </button>

            <div className="nav-section-label">Seguridad</div>
            <button className="nav-item" onClick={onShowDirectives}>
              <span className="nav-icon">🛡️</span>
              <span className="nav-label">Directrices</span>
            </button>
            <button className="nav-item" onClick={onShowApproval}>
              <span className="nav-icon">✓</span>
              <span className="nav-label">Aprobaciones</span>
            </button>
            <button className="nav-item" onClick={onShowSecurity}>
              <span className="nav-icon">🔒</span>
              <span className="nav-label">Auditoria</span>
            </button>

            <div className="nav-section-label">Datos</div>
            <button className="nav-item" onClick={onShowKB}>
              <span className="nav-icon">📚</span>
              <span className="nav-label">Conocimiento</span>
            </button>
            <button className="nav-item" onClick={onShowAudit}>
              <span className="nav-icon">📊</span>
              <span className="nav-label">Historial</span>
            </button>
            <button className="nav-item" onClick={onManageGroups}>
              <span className="nav-icon">🗂️</span>
              <span className="nav-label">Grupos</span>
            </button>

            {currentUser?.role === 'admin' && (
              <>
                <div className="nav-section-label">Admin</div>
                <button className="nav-item" onClick={onShowUserManager}>
                  <span className="nav-icon">👥</span>
                  <span className="nav-label">Usuarios</span>
                </button>
              </>
            )}
          </div>
        )}
      </nav>

      <SearchFilter filters={filters} onChange={onFiltersChange} />

      <div className="server-list">
        {connections.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: 12, padding: '12px', textAlign: 'center' }}>
            {Object.values(filters || {}).some(Boolean) ? 'Sin resultados.' : 'Sin servidores. Agrega uno.'}
          </p>
        )}
        {connections.map(renderServer)}
      </div>

      {/* User bar at bottom */}
      <div className="sidebar-user-bar">
        <span className="sidebar-user-name">{currentUser?.display_name || currentUser?.username}</span>
        <span className="sidebar-user-role">{ROLE_LABELS[currentUser?.role] || currentUser?.role}</span>
        <button className="icon-btn" onClick={onLogout} title="Cerrar sesion" style={{ marginLeft: 'auto' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 1H3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2M9 10l3-3-3-3M12 7H5" /></svg>
        </button>
      </div>
    </div>
  );
}

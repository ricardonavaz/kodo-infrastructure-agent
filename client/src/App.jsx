import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar.jsx';
import SplitView from './components/SplitView.jsx';
import ConnectionForm from './components/ConnectionForm.jsx';
import Settings from './components/Settings.jsx';
import GroupManager from './components/GroupManager.jsx';
import AuditLog from './components/AuditLog.jsx';
import KnowledgeManager from './components/KnowledgeManager.jsx';
import PlaybookManager from './components/PlaybookManager.jsx';
import ProfileViewer from './components/ProfileViewer.jsx';
import DirectivesManager from './components/DirectivesManager.jsx';
import LoginPage from './components/LoginPage.jsx';
import UserManager from './components/UserManager.jsx';
import SchedulerManager from './components/SchedulerManager.jsx';
import ApprovalManager from './components/ApprovalManager.jsx';
import SecurityDashboard from './components/SecurityDashboard.jsx';
import { api } from './hooks/useApi.js';

export default function App() {
  const [connections, setConnections] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [showKB, setShowKB] = useState(false);
  const [showPlaybooks, setShowPlaybooks] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showDirectives, setShowDirectives] = useState(false);
  const [showUserManager, setShowUserManager] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);

  // Auth state
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('kodo_user')); } catch { return null; }
  });
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('kodo_token'));

  // All hooks must be declared before any conditional return
  const [statuses, setStatuses] = useState({});
  const [connectionLogs, setConnectionLogs] = useState({});
  const [sessionIds, setSessionIds] = useState({});
  const [briefings, setBriefings] = useState({});
  const [groups, setGroups] = useState([]);
  const [filters, setFilters] = useState({});
  const pollRef = useRef(null);

  const isLoggedIn = !!authToken && !!currentUser;

  const handleLogin = (user, token) => { setCurrentUser(user); setAuthToken(token); };
  const handleLogout = () => {
    localStorage.removeItem('kodo_token');
    localStorage.removeItem('kodo_user');
    setCurrentUser(null);
    setAuthToken(null);
  };

  const loadConnections = useCallback(async () => {
    if (!isLoggedIn) return;
    try {
      const data = await api.getConnections(filters);
      setConnections(data);
    } catch (err) {
      console.error('Error loading connections:', err);
    }
  }, [filters, isLoggedIn]);

  const loadGroups = async () => {
    if (!isLoggedIn) return;
    try {
      const data = await api.getGroups();
      setGroups(data);
    } catch (err) {
      console.error('Error loading groups:', err);
    }
  };

  const pollStatuses = useCallback(async () => {
    if (!isLoggedIn) return;
    try {
      const data = await api.getAllStatuses();
      setStatuses((prev) => {
        const next = { ...prev };
        for (const [id, status] of Object.entries(data)) {
          if (next[id]?.status !== 'connecting') {
            next[id] = { ...next[id], status };
          }
        }
        return next;
      });
    } catch {
      // ignore polling errors
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    loadConnections();
    loadGroups();
    pollStatuses();
    pollRef.current = setInterval(pollStatuses, 15000);
    return () => clearInterval(pollRef.current);
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    loadConnections();
  }, [loadConnections]);

  // If not logged in, show login page
  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const activeConnection = connections.find((c) => c.id === activeId) || null;

  const addLog = (id, entry) => {
    setConnectionLogs((prev) => ({
      ...prev,
      [id]: [...(prev[id] || []), { ...entry, time: new Date().toLocaleTimeString() }],
    }));
  };

  const handleConnect = async (id) => {
    const conn = connections.find((c) => c.id === id);
    if (!conn) return;

    setStatuses((prev) => ({ ...prev, [id]: { status: 'connecting' } }));
    addLog(id, { type: 'info', text: `Iniciando conexion SSH a ${conn.host}:${conn.port}...` });
    addLog(id, { type: 'info', text: `Usuario: ${conn.username} | Auth: ${conn.auth_type} | OS: ${conn.os_type}` });

    try {
      const result = await api.connectServer(id);
      if (result.success) {
        setStatuses((prev) => ({ ...prev, [id]: { status: 'connected' } }));
        addLog(id, { type: 'success', text: 'Conexion establecida exitosamente' });
        if (result.output) addLog(id, { type: 'output', text: result.output });
        if (result.sessionId) setSessionIds((prev) => ({ ...prev, [id]: result.sessionId }));
        if (result.briefing) setBriefings((prev) => ({ ...prev, [id]: result.briefing }));
        if (result.profile) addLog(id, { type: 'info', text: `Perfil: ${result.profile.os_version || result.profile.distro} | ${result.profile.package_manager}` });
        loadConnections();
      } else {
        setStatuses((prev) => ({ ...prev, [id]: { status: 'error', error: result.error } }));
        addLog(id, { type: 'error', text: `Error: ${result.error}` });
      }
    } catch (err) {
      setStatuses((prev) => ({ ...prev, [id]: { status: 'error', error: err.message } }));
      addLog(id, { type: 'error', text: `Error: ${err.message}` });
    }
  };

  const handleDisconnect = async (id) => {
    try {
      await api.disconnectServer(id);
      setStatuses((prev) => ({ ...prev, [id]: { status: 'disconnected' } }));
      addLog(id, { type: 'info', text: 'Sesion SSH cerrada' });
    } catch (err) {
      addLog(id, { type: 'error', text: `Error al desconectar: ${err.message}` });
    }
  };

  const handleSave = async (data) => {
    if (data.id) {
      await api.updateConnection(data.id, data);
    } else {
      const created = await api.createConnection(data);
      setActiveId(created.id);
    }
    await loadConnections();
  };

  const handleDelete = async (id) => {
    if (!confirm('Eliminar este servidor?')) return;
    await api.deleteConnection(id);
    if (activeId === id) setActiveId(null);
    setStatuses((prev) => { const n = { ...prev }; delete n[id]; return n; });
    setConnectionLogs((prev) => { const n = { ...prev }; delete n[id]; return n; });
    await loadConnections();
  };

  const handleToggleFavorite = async (id) => {
    await api.toggleFavorite(id);
    await loadConnections();
  };

  return (
    <div className="app">
      <Sidebar
        connections={connections}
        activeId={activeId}
        statuses={statuses}
        groups={groups}
        filters={filters}
        onFiltersChange={setFilters}
        onSelect={setActiveId}
        onAdd={() => setShowForm(true)}
        onDelete={handleDelete}
        onSettings={() => setShowSettings(true)}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onToggleFavorite={handleToggleFavorite}
        onManageGroups={() => setShowGroups(true)}
        onShowAudit={() => setShowAudit(true)}
        onShowKB={() => setShowKB(true)}
        onShowPlaybooks={() => setShowPlaybooks(true)}
        onShowProfile={() => setShowProfile(true)}
        onShowDirectives={() => setShowDirectives(true)}
        onShowScheduler={() => setShowScheduler(true)}
        onShowApproval={() => setShowApproval(true)}
        onShowSecurity={() => setShowSecurity(true)}
        onShowUserManager={() => setShowUserManager(true)}
        onLogout={handleLogout}
        currentUser={currentUser}
      />

      <SplitView
        connection={activeConnection}
        connectionStatus={activeId ? statuses[activeId] : null}
        connectionLogs={activeId ? connectionLogs[activeId] : null}
        sessionId={activeId ? sessionIds[activeId] : null}
        briefing={activeId ? briefings[activeId] : null}
        onShowProfile={() => setShowProfile(true)}
        userRole={currentUser?.role}
      />

      {showForm && (
        <ConnectionForm
          onSave={handleSave}
          onClose={() => setShowForm(false)}
        />
      )}

      {showSettings && currentUser?.role === 'admin' && (
        <Settings onClose={() => setShowSettings(false)} />
      )}

      {showAudit && <AuditLog onClose={() => setShowAudit(false)} />}
      {showKB && <KnowledgeManager onClose={() => setShowKB(false)} />}
      {showPlaybooks && <PlaybookManager connections={connections} onClose={() => setShowPlaybooks(false)} />}
      {showDirectives && <DirectivesManager connections={connections} onClose={() => setShowDirectives(false)} />}
      {showUserManager && <UserManager onClose={() => setShowUserManager(false)} />}
      {showScheduler && <SchedulerManager connections={connections} onClose={() => setShowScheduler(false)} />}
      {showApproval && <ApprovalManager onClose={() => setShowApproval(false)} />}
      {showSecurity && activeConnection && <SecurityDashboard connectionId={activeConnection.id} connectionName={activeConnection.name} onClose={() => setShowSecurity(false)} />}
      {showProfile && activeConnection && (
        <ProfileViewer connectionId={activeConnection.id} connectionName={activeConnection.name} onClose={() => setShowProfile(false)} />
      )}

      {showGroups && (
        <GroupManager
          connections={connections}
          onClose={() => setShowGroups(false)}
          onUpdate={() => { loadGroups(); loadConnections(); }}
        />
      )}
    </div>
  );
}

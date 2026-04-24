import React, { useState, useEffect } from 'react';
import { api, authorizedFetch } from '../hooks/useApi.js';

export default function Settings({ onClose }) {
  const [apiKey, setApiKey] = useState('');
  const [currentKey, setCurrentKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [mkStatus, setMkStatus] = useState(null);
  const [mkPassword, setMkPassword] = useState('');
  const [mkConfirm, setMkConfirm] = useState('');
  const [mkUseKeychain, setMkUseKeychain] = useState(false);
  const [mkError, setMkError] = useState('');
  const [mkSaving, setMkSaving] = useState(false);

  useEffect(() => {
    api.getSettings().then((s) => setCurrentKey(s.anthropic_api_key || ''));
    loadMkStatus();
  }, []);

  const loadMkStatus = async () => {
    try {
      const data = await authorizedFetch('/api/settings/master-key/status').then((r) => r.json());
      setMkStatus(data);
    } catch { /* ignore */ }
  };

  const handleSave = async () => {
    if (!apiKey) return;
    setSaving(true);
    try {
      await api.updateSettings({ anthropic_api_key: apiKey });
      setCurrentKey('••••••••' + apiKey.slice(-8));
      setApiKey('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSetupMasterKey = async () => {
    setMkError('');
    if (mkPassword.length < 8) { setMkError('Minimo 8 caracteres'); return; }
    if (mkPassword !== mkConfirm) { setMkError('Las claves no coinciden'); return; }

    setMkSaving(true);
    try {
      const res = await authorizedFetch('/api/settings/master-key/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: mkPassword, useKeychain: mkUseKeychain }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMkPassword('');
      setMkConfirm('');
      loadMkStatus();
    } catch (err) {
      setMkError(err.message);
    } finally {
      setMkSaving(false);
    }
  };

  const handleUnlock = async () => {
    setMkError('');
    setMkSaving(true);
    try {
      const res = await authorizedFetch('/api/settings/master-key/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: mkPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMkPassword('');
      loadMkStatus();
    } catch (err) {
      setMkError(err.message);
    } finally {
      setMkSaving(false);
    }
  };

  const handleLock = async () => {
    await authorizedFetch('/api/settings/master-key/lock', { method: 'POST' });
    loadMkStatus();
  };

  const handleEncryptAll = async () => {
    if (!confirm('Cifrar todas las credenciales existentes?')) return;
    try {
      const res = await authorizedFetch('/api/settings/connections/encrypt-all', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(`${data.encrypted} credenciales cifradas`);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <h3>// Configuracion</h3>

        {/* API Key */}
        <div className="settings-section">
          <h4 className="settings-section-title">Anthropic API Key</h4>
          {currentKey && (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>
              Actual: {currentKey}
            </p>
          )}
          <div className="form-group">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !apiKey}
            style={{ width: '100%' }}
          >
            {saved ? 'Guardado!' : saving ? 'Guardando...' : 'Guardar clave'}
          </button>
        </div>

        {/* Master Key / Security */}
        {mkStatus && (
          <div className="settings-section" style={{ marginTop: 20 }}>
            <h4 className="settings-section-title">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ verticalAlign: -2 }}>
                <rect x="3" y="6" width="8" height="7" rx="1" />
                <path d="M5 6V4a2 2 0 0 1 4 0v2" />
              </svg>
              {' '}Seguridad - Clave Maestra
            </h4>

            {!mkStatus.isSetup ? (
              <>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
                  Configura una clave maestra para cifrar las credenciales de tus servidores con AES-256-GCM.
                </p>
                <div className="form-group">
                  <label>Clave maestra</label>
                  <input type="password" value={mkPassword} onChange={(e) => setMkPassword(e.target.value)} placeholder="Minimo 8 caracteres" />
                </div>
                <div className="form-group">
                  <label>Confirmar clave</label>
                  <input type="password" value={mkConfirm} onChange={(e) => setMkConfirm(e.target.value)} placeholder="Repite la clave" />
                </div>
                {mkStatus.keychainAvailable && (
                  <label className="member-checkbox" style={{ marginBottom: 12 }}>
                    <input type="checkbox" checked={mkUseKeychain} onChange={(e) => setMkUseKeychain(e.target.checked)} />
                    <span>Guardar en macOS Keychain (auto-desbloqueo)</span>
                  </label>
                )}
                {mkError && <p style={{ color: 'var(--red)', fontSize: 12, marginBottom: 8 }}>{mkError}</p>}
                <button className="btn btn-primary" onClick={handleSetupMasterKey} disabled={mkSaving} style={{ width: '100%' }}>
                  {mkSaving ? 'Configurando...' : 'Configurar clave maestra'}
                </button>
              </>
            ) : mkStatus.isUnlocked ? (
              <>
                <div className="security-status unlocked">
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="6" width="8" height="7" rx="1" />
                    <path d="M5 6V4a2 2 0 0 1 4 0" />
                  </svg>
                  Desbloqueada - credenciales cifradas accesibles
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button className="btn btn-secondary" onClick={handleLock} style={{ flex: 1 }}>
                    Bloquear
                  </button>
                  <button className="btn btn-primary" onClick={handleEncryptAll} style={{ flex: 1 }}>
                    Cifrar todas
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="security-status locked">
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="6" width="8" height="7" rx="1" />
                    <path d="M5 6V4a2 2 0 0 1 4 0v2" />
                  </svg>
                  Bloqueada - ingresa tu clave para acceder
                </div>
                <div className="form-group" style={{ marginTop: 8 }}>
                  <input type="password" value={mkPassword} onChange={(e) => setMkPassword(e.target.value)} placeholder="Clave maestra"
                    onKeyDown={(e) => e.key === 'Enter' && handleUnlock()} />
                </div>
                {mkError && <p style={{ color: 'var(--red)', fontSize: 12, marginBottom: 8 }}>{mkError}</p>}
                <button className="btn btn-primary" onClick={handleUnlock} disabled={mkSaving} style={{ width: '100%' }}>
                  {mkSaving ? 'Desbloqueando...' : 'Desbloquear'}
                </button>
              </>
            )}
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

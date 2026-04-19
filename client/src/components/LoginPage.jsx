import React, { useState } from 'react';

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Change password form
  const [mustChange, setMustChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [token, setToken] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.user.must_change_password) {
        setToken(data.token);
        setMustChange(true);
      } else {
        localStorage.setItem('kodo_token', data.token);
        localStorage.setItem('kodo_user', JSON.stringify(data.user));
        onLogin(data.user, data.token);
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) return setError('Minimo 6 caracteres');
    if (newPassword !== confirmPassword) return setError('Las passwords no coinciden');
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const user = JSON.parse(localStorage.getItem('kodo_user') || '{}');
      user.must_change_password = false;
      localStorage.setItem('kodo_token', token);
      localStorage.setItem('kodo_user', JSON.stringify(user));
      onLogin(user, token);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <span className="logo-kodo" style={{ fontSize: 28 }}>Kodo</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Infrastructure Agent</span>
        </div>

        {error && <div className="login-error">{error}</div>}

        {mustChange ? (
          <form onSubmit={handleChangePassword}>
            <p style={{ color: 'var(--amber)', fontSize: 12, marginBottom: 12 }}>Debes cambiar tu password antes de continuar</p>
            <div className="form-group">
              <label>Nueva password</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimo 6 caracteres" autoFocus />
            </div>
            <div className="form-group">
              <label>Confirmar password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repetir password" />
            </div>
            <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
              {loading ? 'Guardando...' : 'Cambiar password'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Usuario</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" autoFocus autoComplete="username" />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" autoComplete="current-password" />
            </div>
            <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

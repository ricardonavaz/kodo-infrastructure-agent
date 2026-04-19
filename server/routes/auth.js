import { Router } from 'express';
import db from '../db.js';
import { hashPassword, verifyPassword, createToken, requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Apply auth to all routes except login
router.use((req, res, next) => {
  if (req.path === '/login') return next();
  return requireAuth(req, res, next);
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Usuario y password requeridos' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return res.status(401).json({ error: 'Credenciales invalidas' });
  if (!user.enabled) return res.status(401).json({ error: 'Usuario deshabilitado' });

  if (!verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Credenciales invalidas' });
  }

  // Update last login
  db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id);

  const token = createToken({ userId: user.id, username: user.username, role: user.role });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      role: user.role,
      must_change_password: !!user.must_change_password,
    },
  });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  res.json({
    id: req.user.id,
    username: req.user.username,
    display_name: req.user.display_name,
    role: req.user.role,
    must_change_password: !!req.user.must_change_password,
  });
});

// PUT /api/auth/password — Change own password
router.put('/password', (req, res) => {
  const { current_password, new_password } = req.body;
  if (!new_password || new_password.length < 6) return res.status(400).json({ error: 'Password debe tener minimo 6 caracteres' });

  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);

  // If must_change_password, don't require current password
  if (!req.user.must_change_password) {
    if (!current_password) return res.status(400).json({ error: 'Password actual requerida' });
    if (!verifyPassword(current_password, user.password_hash)) {
      return res.status(401).json({ error: 'Password actual incorrecta' });
    }
  }

  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?')
    .run(hashPassword(new_password), req.user.id);

  res.json({ success: true });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  // Token-less logout — client just deletes the token
  res.json({ success: true });
});

// ===== Admin-only user management =====

// GET /api/auth/users
router.get('/users', requireRole('admin'), (req, res) => {
  const users = db.prepare('SELECT id, username, display_name, role, enabled, must_change_password, created_at, last_login_at FROM users ORDER BY created_at ASC').all();
  res.json(users);
});

// POST /api/auth/users
router.post('/users', requireRole('admin'), (req, res) => {
  const { username, password, display_name, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Usuario y password requeridos' });
  if (password.length < 6) return res.status(400).json({ error: 'Password debe tener minimo 6 caracteres' });
  if (!['admin', 'operator', 'viewer'].includes(role)) return res.status(400).json({ error: 'Rol invalido. Opciones: admin, operator, viewer' });

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(409).json({ error: 'El usuario ya existe' });

  const result = db.prepare(
    'INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)'
  ).run(username, hashPassword(password), display_name || username, role || 'operator');

  const user = db.prepare('SELECT id, username, display_name, role, enabled, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(user);
});

// PUT /api/auth/users/:id
router.put('/users/:id', requireRole('admin'), (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  const { display_name, role, enabled, password } = req.body;

  if (password) {
    if (password.length < 6) return res.status(400).json({ error: 'Password debe tener minimo 6 caracteres' });
    db.prepare('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?').run(hashPassword(password), req.params.id);
  }

  db.prepare('UPDATE users SET display_name = ?, role = ?, enabled = ? WHERE id = ?').run(
    display_name ?? user.display_name,
    role ?? user.role,
    enabled !== undefined ? (enabled ? 1 : 0) : user.enabled,
    req.params.id
  );

  const updated = db.prepare('SELECT id, username, display_name, role, enabled, created_at, last_login_at FROM users WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/auth/users/:id
router.delete('/users/:id', requireRole('admin'), (req, res) => {
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;

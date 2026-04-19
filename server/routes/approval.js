import { Router } from 'express';
import db from '../db.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// List profiles
router.get('/profiles', (req, res) => {
  const profiles = db.prepare('SELECT * FROM approval_profiles ORDER BY is_builtin DESC, name ASC').all();
  res.json(profiles.map((p) => ({ ...p, rules: JSON.parse(p.rules || '[]') })));
});

// Create profile — operator+admin
router.post('/profiles', requireRole('admin', 'operator'), (req, res) => {
  const { name, description, connection_id, rules } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });

  const result = db.prepare(
    'INSERT INTO approval_profiles (name, description, connection_id, rules) VALUES (?, ?, ?, ?)'
  ).run(name, description || '', connection_id || null, JSON.stringify(rules || []));

  res.status(201).json(db.prepare('SELECT * FROM approval_profiles WHERE id = ?').get(result.lastInsertRowid));
});

// Update profile — operator+admin
router.put('/profiles/:id', requireRole('admin', 'operator'), (req, res) => {
  const existing = db.prepare('SELECT * FROM approval_profiles WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Perfil no encontrado' });

  const { name, description, rules } = req.body;
  db.prepare('UPDATE approval_profiles SET name=?, description=?, rules=? WHERE id=?').run(
    name || existing.name, description ?? existing.description,
    rules ? JSON.stringify(rules) : existing.rules, req.params.id
  );
  res.json(db.prepare('SELECT * FROM approval_profiles WHERE id = ?').get(req.params.id));
});

// Toggle — operator+admin
router.put('/profiles/:id/toggle', requireRole('admin', 'operator'), (req, res) => {
  const p = db.prepare('SELECT * FROM approval_profiles WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'No encontrado' });
  db.prepare('UPDATE approval_profiles SET enabled = ? WHERE id = ?').run(p.enabled ? 0 : 1, req.params.id);
  res.json({ id: p.id, enabled: !p.enabled });
});

// Delete (only custom) — operator+admin
router.delete('/profiles/:id', requireRole('admin', 'operator'), (req, res) => {
  const p = db.prepare('SELECT * FROM approval_profiles WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'No encontrado' });
  if (p.is_builtin) return res.status(403).json({ error: 'No se puede eliminar perfil integrado' });
  db.prepare('DELETE FROM approval_profiles WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Check command against active profiles
router.post('/check', (req, res) => {
  const { command, connectionId, sessionId } = req.body;
  const result = checkApproval(command, connectionId, sessionId);
  res.json(result);
});

// Approval log
router.get('/log', (req, res) => {
  const { session_id, connection_id, limit = 50 } = req.query;
  let sql = 'SELECT * FROM approval_log';
  const conds = [];
  const params = [];
  if (session_id) { conds.push('session_id = ?'); params.push(session_id); }
  if (connection_id) { conds.push('connection_id = ?'); params.push(connection_id); }
  if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit));
  res.json(db.prepare(sql).all(...params));
});

// Exported function for use in ai.js
export function checkApproval(command, connectionId, sessionId) {
  // Get enabled profiles (global + connection-specific)
  const profiles = db.prepare(
    'SELECT * FROM approval_profiles WHERE enabled = 1 AND (connection_id IS NULL OR connection_id = ?) ORDER BY connection_id DESC'
  ).all(connectionId);

  for (const profile of profiles) {
    const rules = JSON.parse(profile.rules || '[]');
    for (const rule of rules) {
      try {
        const regex = new RegExp(rule.pattern, 'i');
        if (regex.test(command.trim())) {
          const decision = rule.auto_approve ? 'approved' : 'denied';
          // Log the decision
          db.prepare(
            `INSERT INTO approval_log (profile_id, session_id, connection_id, command, decision, risk_level, reason)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).run(profile.id, sessionId, connectionId, command, decision, rule.risk_level || 'low', `Perfil: ${profile.name}`);

          return { decision, profile: profile.name, risk_level: rule.risk_level || 'low' };
        }
      } catch { /* invalid regex */ }
    }
  }

  // No matching rule = manual approval required
  return { decision: 'manual', profile: null, risk_level: 'unknown' };
}

export default router;

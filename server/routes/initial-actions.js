import { Router } from 'express';
import db from '../db.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// Get actions for a connection (merge defaults + custom)
router.get('/:connectionId', (req, res) => {
  const conn = db.prepare('SELECT os_type FROM connections WHERE id = ?').get(req.params.connectionId);
  const profile = db.prepare('SELECT os_family FROM server_profiles WHERE connection_id = ?').get(req.params.connectionId);
  const osFamily = profile?.os_family || (conn?.os_type === 'windows' ? 'windows' : null);

  // Get default actions (connection_id IS NULL) + connection-specific
  let actions;
  if (osFamily) {
    actions = db.prepare(
      'SELECT * FROM initial_actions WHERE enabled = 1 AND (connection_id IS NULL OR connection_id = ?) AND (os_family IS NULL OR os_family = ?) ORDER BY sort_order ASC'
    ).all(req.params.connectionId, osFamily);
  } else {
    actions = db.prepare(
      'SELECT * FROM initial_actions WHERE enabled = 1 AND (connection_id IS NULL OR connection_id = ?) AND os_family IS NULL ORDER BY sort_order ASC'
    ).all(req.params.connectionId);
  }

  res.json(actions);
});

// Create custom action — operator+admin
router.post('/', requireRole('admin', 'operator'), (req, res) => {
  const { connection_id, os_family, label, prompt, icon, category, sort_order } = req.body;
  if (!label || !prompt) return res.status(400).json({ error: 'label y prompt requeridos' });

  const result = db.prepare(
    'INSERT INTO initial_actions (connection_id, os_family, label, prompt, icon, category, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(connection_id || null, os_family || null, label, prompt, icon || '🔧', category || 'custom', sort_order || 99);

  res.status(201).json(db.prepare('SELECT * FROM initial_actions WHERE id = ?').get(result.lastInsertRowid));
});

// Delete — operator+admin
router.delete('/:id', requireRole('admin', 'operator'), (req, res) => {
  db.prepare('DELETE FROM initial_actions WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;

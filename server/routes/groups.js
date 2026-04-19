import { Router } from 'express';
import db from '../db.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// List all groups with member counts
router.get('/', (req, res) => {
  const groups = db.prepare(`
    SELECT g.*, COUNT(m.connection_id) as member_count
    FROM server_groups g
    LEFT JOIN server_group_members m ON g.id = m.group_id
    GROUP BY g.id
    ORDER BY g.name ASC
  `).all();
  res.json(groups);
});

// Get group with members
router.get('/:id', (req, res) => {
  const group = db.prepare('SELECT * FROM server_groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Grupo no encontrado' });

  const members = db.prepare(`
    SELECT c.id, c.name, c.host, c.port, c.os_type, c.environment, c.status
    FROM connections c
    JOIN server_group_members m ON c.id = m.connection_id
    WHERE m.group_id = ?
    ORDER BY c.name ASC
  `).all(req.params.id);

  res.json({ ...group, members });
});

// Create group — operator+admin
router.post('/', requireRole('admin', 'operator'), (req, res) => {
  const { name, type, description, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });

  try {
    const result = db.prepare(
      'INSERT INTO server_groups (name, type, description, color) VALUES (?, ?, ?, ?)'
    ).run(name, type || 'custom', description || '', color || '#00ff41');

    const group = db.prepare('SELECT * FROM server_groups WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(group);
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ya existe un grupo con ese nombre' });
    }
    throw e;
  }
});

// Update group — operator+admin
router.put('/:id', requireRole('admin', 'operator'), (req, res) => {
  const existing = db.prepare('SELECT * FROM server_groups WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Grupo no encontrado' });

  const { name, type, description, color } = req.body;
  db.prepare('UPDATE server_groups SET name = ?, type = ?, description = ?, color = ? WHERE id = ?').run(
    name || existing.name,
    type || existing.type,
    description !== undefined ? description : existing.description,
    color || existing.color,
    req.params.id
  );

  const group = db.prepare('SELECT * FROM server_groups WHERE id = ?').get(req.params.id);
  res.json(group);
});

// Delete group — operator+admin
router.delete('/:id', requireRole('admin', 'operator'), (req, res) => {
  const existing = db.prepare('SELECT * FROM server_groups WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Grupo no encontrado' });

  db.prepare('DELETE FROM server_groups WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Add member to group — operator+admin
router.post('/:id/members', requireRole('admin', 'operator'), (req, res) => {
  const { connection_id } = req.body;
  if (!connection_id) return res.status(400).json({ error: 'connection_id requerido' });

  try {
    db.prepare('INSERT INTO server_group_members (group_id, connection_id) VALUES (?, ?)').run(
      req.params.id, connection_id
    );
    res.json({ success: true });
  } catch (e) {
    if (e.message.includes('UNIQUE') || e.message.includes('PRIMARY')) {
      return res.status(409).json({ error: 'El servidor ya esta en este grupo' });
    }
    throw e;
  }
});

// Remove member from group — operator+admin
router.delete('/:id/members/:connectionId', requireRole('admin', 'operator'), (req, res) => {
  db.prepare('DELETE FROM server_group_members WHERE group_id = ? AND connection_id = ?').run(
    req.params.id, req.params.connectionId
  );
  res.json({ success: true });
});

export default router;

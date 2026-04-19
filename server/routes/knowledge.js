import { Router } from 'express';
import db from '../db.js';
import { importDocument, importFromUrl, searchDocuments } from '../services/knowledge.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// ===== Knowledge Entries =====

router.get('/', (req, res) => {
  const { os_family, os_version, category, outcome, source, search, limit = 50 } = req.query;
  let sql = 'SELECT * FROM knowledge_entries';
  const conditions = [];
  const params = [];

  if (os_family) { conditions.push('os_family = ?'); params.push(os_family); }
  if (os_version) { conditions.push('os_version = ?'); params.push(os_version); }
  if (category) { conditions.push('category = ?'); params.push(category); }
  if (outcome) { conditions.push('outcome = ?'); params.push(outcome); }
  if (source) { conditions.push('source = ?'); params.push(source); }
  if (search) { conditions.push('(action_name LIKE ? OR tags LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }

  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY success_count DESC, last_used_at DESC LIMIT ?';
  params.push(parseInt(limit));

  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const entry = db.prepare('SELECT * FROM knowledge_entries WHERE id = ?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Entrada no encontrada' });
  res.json(entry);
});

router.post('/', requireRole('admin', 'operator'), (req, res) => {
  const { os_family, os_version, category, action_name, command_sequence, outcome, outcome_details, tags } = req.body;
  if (!action_name) return res.status(400).json({ error: 'action_name requerido' });

  const result = db.prepare(
    `INSERT INTO knowledge_entries (os_family, os_version, category, action_name, command_sequence, outcome, outcome_details, tags, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual')`
  ).run(os_family, os_version, category || 'other', action_name, JSON.stringify(command_sequence || []), outcome, outcome_details, JSON.stringify(tags || []));

  res.status(201).json(db.prepare('SELECT * FROM knowledge_entries WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', requireRole('admin', 'operator'), (req, res) => {
  const existing = db.prepare('SELECT * FROM knowledge_entries WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'No encontrada' });

  const { action_name, category, outcome, outcome_details, resolution, tags } = req.body;
  db.prepare(
    'UPDATE knowledge_entries SET action_name=?, category=?, outcome=?, outcome_details=?, resolution=?, tags=? WHERE id=?'
  ).run(
    action_name || existing.action_name, category || existing.category,
    outcome || existing.outcome, outcome_details ?? existing.outcome_details,
    resolution ?? existing.resolution, tags ? JSON.stringify(tags) : existing.tags,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM knowledge_entries WHERE id = ?').get(req.params.id));
});

router.delete('/:id', requireRole('admin', 'operator'), (req, res) => {
  db.prepare('DELETE FROM knowledge_entries WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ===== Documents =====

router.get('/documents/list', (req, res) => {
  const { os_family, category } = req.query;
  let sql = 'SELECT id, title, source_type, source_path, os_family, os_version, category, tags, file_size, imported_at FROM knowledge_documents';
  const conds = [];
  const params = [];
  if (os_family) { conds.push('os_family = ?'); params.push(os_family); }
  if (category) { conds.push('category = ?'); params.push(category); }
  if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
  sql += ' ORDER BY imported_at DESC';
  res.json(db.prepare(sql).all(...params));
});

router.post('/documents/upload', requireRole('admin', 'operator'), (req, res) => {
  const { filePath, title, os_family, os_version, category, tags } = req.body;
  if (!filePath) return res.status(400).json({ error: 'filePath requerido' });

  try {
    const result = importDocument(filePath, { title, os_family, os_version, category, tags });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/documents/url', requireRole('admin', 'operator'), async (req, res) => {
  const { url, title, os_family, os_version, category, tags } = req.body;
  if (!url) return res.status(400).json({ error: 'URL requerida' });

  try {
    const result = await importFromUrl(url, { title, os_family, os_version, category, tags });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/documents/search', (req, res) => {
  const { query, os_family } = req.body;
  if (!query) return res.status(400).json({ error: 'query requerido' });
  res.json(searchDocuments(query, os_family));
});

router.delete('/documents/:id', requireRole('admin', 'operator'), (req, res) => {
  db.prepare('DELETE FROM knowledge_documents WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;

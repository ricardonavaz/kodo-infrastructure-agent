import { Router } from 'express';
import db from '../db.js';

const router = Router();

// List with filters
router.get('/', (req, res) => {
  const { connection_id, from, to, task_type, status, search, limit = 50, offset = 0 } = req.query;
  let sql = 'SELECT * FROM audit_log';
  const conditions = [];
  const params = [];

  if (connection_id) { conditions.push('connection_id = ?'); params.push(connection_id); }
  if (from) { conditions.push('datetime >= ?'); params.push(from); }
  if (to) { conditions.push('datetime <= ?'); params.push(to); }
  if (task_type) { conditions.push('task_type = ?'); params.push(task_type); }
  if (status) { conditions.push('final_status = ?'); params.push(status); }
  if (search) { conditions.push('(user_prompt LIKE ? OR commands_generated LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }

  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY datetime DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const records = db.prepare(sql).all(...params);
  const total = db.prepare(
    `SELECT COUNT(*) as count FROM audit_log${conditions.length ? ' WHERE ' + conditions.join(' AND ') : ''}`
  ).get(...params.slice(0, -2));

  res.json({ records, total: total.count });
});

// Single record
router.get('/:id', (req, res) => {
  const record = db.prepare('SELECT * FROM audit_log WHERE id = ?').get(req.params.id);
  if (!record) return res.status(404).json({ error: 'Registro no encontrado' });
  res.json(record);
});

// Stats
router.get('/stats/summary', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as count FROM audit_log').get();
  const success = db.prepare("SELECT COUNT(*) as count FROM audit_log WHERE final_status = 'success'").get();
  const avgDuration = db.prepare('SELECT AVG(duration_ms) as avg FROM audit_log WHERE duration_ms > 0').get();
  const modelUsage = db.prepare('SELECT model_used, COUNT(*) as count FROM audit_log WHERE model_used IS NOT NULL GROUP BY model_used ORDER BY count DESC').all();
  const taskTypes = db.prepare('SELECT task_type, COUNT(*) as count FROM audit_log GROUP BY task_type ORDER BY count DESC').all();
  const byDay = db.prepare("SELECT date(datetime) as day, COUNT(*) as count FROM audit_log GROUP BY day ORDER BY day DESC LIMIT 30").all();

  res.json({
    total: total.count,
    successRate: total.count > 0 ? (success.count / total.count * 100).toFixed(1) : 0,
    avgDurationMs: Math.round(avgDuration.avg || 0),
    modelUsage,
    taskTypes,
    byDay,
  });
});

// Export
router.get('/export/data', (req, res) => {
  const { format = 'json', ...filters } = req.query;
  let sql = 'SELECT * FROM audit_log';
  const conditions = [];
  const params = [];

  if (filters.connection_id) { conditions.push('connection_id = ?'); params.push(filters.connection_id); }
  if (filters.from) { conditions.push('datetime >= ?'); params.push(filters.from); }
  if (filters.to) { conditions.push('datetime <= ?'); params.push(filters.to); }

  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY datetime DESC';

  const records = db.prepare(sql).all(...params);

  if (format === 'csv') {
    const headers = 'id,connection_name,datetime,user_prompt,commands_generated,final_status,model_used,task_type,duration_ms\n';
    const rows = records.map((r) =>
      [r.id, `"${(r.connection_name || '').replace(/"/g, '""')}"`, r.datetime, `"${(r.user_prompt || '').replace(/"/g, '""')}"`,
       `"${(r.commands_generated || '').replace(/"/g, '""')}"`, r.final_status, r.model_used, r.task_type, r.duration_ms].join(',')
    ).join('\n');
    res.type('text/csv').send(headers + rows);
  } else {
    res.json(records);
  }
});

export default router;

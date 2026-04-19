import { Router } from 'express';
import db from '../db.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// List tasks
router.get('/', (req, res) => {
  const tasks = db.prepare('SELECT * FROM scheduled_tasks ORDER BY enabled DESC, name ASC').all();
  res.json(tasks);
});

// Get single
router.get('/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM scheduled_tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Tarea no encontrada' });
  res.json(task);
});

// Create — operator+admin
router.post('/', requireRole('admin', 'operator'), (req, res) => {
  const { name, description, cron_expression, connection_id, group_id, playbook_id, command, task_type, time_window_start, time_window_end, retry_count, retry_delay_ms, timeout_ms } = req.body;
  if (!name || !cron_expression) return res.status(400).json({ error: 'Nombre y expresion cron requeridos' });

  const result = db.prepare(
    `INSERT INTO scheduled_tasks (name, description, cron_expression, connection_id, group_id, playbook_id, command, task_type, time_window_start, time_window_end, retry_count, retry_delay_ms, timeout_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    name, description || '', cron_expression,
    connection_id || null, group_id || null, playbook_id || null,
    command || null, task_type || 'command',
    time_window_start || null, time_window_end || null,
    retry_count || 0, retry_delay_ms || 30000, timeout_ms || 60000
  );

  res.status(201).json(db.prepare('SELECT * FROM scheduled_tasks WHERE id = ?').get(result.lastInsertRowid));
});

// Update — operator+admin
router.put('/:id', requireRole('admin', 'operator'), (req, res) => {
  const existing = db.prepare('SELECT * FROM scheduled_tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Tarea no encontrada' });

  const fields = ['name', 'description', 'cron_expression', 'connection_id', 'group_id', 'playbook_id', 'command', 'task_type', 'time_window_start', 'time_window_end', 'retry_count', 'retry_delay_ms', 'timeout_ms'];
  const updates = [];
  const params = [];

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(req.body[field]);
    }
  }

  if (updates.length > 0) {
    params.push(req.params.id);
    db.prepare(`UPDATE scheduled_tasks SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  res.json(db.prepare('SELECT * FROM scheduled_tasks WHERE id = ?').get(req.params.id));
});

// Delete — operator+admin
router.delete('/:id', requireRole('admin', 'operator'), (req, res) => {
  db.prepare('DELETE FROM scheduled_tasks WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Toggle enable/disable — operator+admin
router.put('/:id/toggle', requireRole('admin', 'operator'), (req, res) => {
  const task = db.prepare('SELECT * FROM scheduled_tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Tarea no encontrada' });

  db.prepare('UPDATE scheduled_tasks SET enabled = ? WHERE id = ?').run(task.enabled ? 0 : 1, req.params.id);
  res.json({ id: task.id, enabled: !task.enabled });
});

// Manual trigger — operator+admin
router.post('/:id/run-now', requireRole('admin', 'operator'), async (req, res) => {
  const task = db.prepare('SELECT * FROM scheduled_tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Tarea no encontrada' });

  // Import dynamically to avoid circular deps
  const { default: schedulerModule } = await import('../services/scheduler.js');
  // We can't directly call executeTask since it's not exported.
  // Instead, trigger by temporarily marking last_run_at as null
  db.prepare('UPDATE scheduled_tasks SET last_run_at = NULL WHERE id = ?').run(req.params.id);

  res.json({ success: true, message: 'Tarea programada para ejecucion inmediata' });
});

// Run history
router.get('/:id/runs', (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  const runs = db.prepare(
    'SELECT * FROM scheduled_task_runs WHERE task_id = ? ORDER BY started_at DESC LIMIT ? OFFSET ?'
  ).all(req.params.id, parseInt(limit), parseInt(offset));
  res.json(runs);
});

// Templates
router.get('/templates/list', (req, res) => {
  res.json([
    { name: 'Disponibilidad horaria', cron: '0 * * * *', description: 'Cada hora verificar que el servidor responde', command: 'uptime' },
    { name: 'Updates diarios', cron: '0 6 * * *', description: 'Cada dia a las 6am revisar actualizaciones', task_type: 'playbook', playbook_hint: 'Verificar Actualizaciones' },
    { name: 'Mantenimiento nocturno', cron: '0 2 * * *', description: 'Cada noche a las 2am ejecutar limpieza', task_type: 'playbook', playbook_hint: 'Limpieza de Logs' },
    { name: 'Health check semanal', cron: '0 9 * * 1', description: 'Cada lunes a las 9am revision de salud', task_type: 'playbook', playbook_hint: 'Health Check General' },
    { name: 'Seguridad semanal', cron: '0 10 * * 5', description: 'Cada viernes revision de seguridad', task_type: 'playbook', playbook_hint: 'Revision de Seguridad Basica' },
  ]);
});

export default router;

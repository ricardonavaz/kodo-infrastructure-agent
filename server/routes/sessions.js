import { Router } from 'express';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// Start session — operator+admin
router.post('/:connectionId/start', requireRole('admin', 'operator'), (req, res) => {
  const conn = db.prepare('SELECT id, name FROM connections WHERE id = ?').get(req.params.connectionId);
  if (!conn) return res.status(404).json({ error: 'Conexion no encontrada' });

  // Check for existing active session
  const active = db.prepare("SELECT id FROM work_sessions WHERE connection_id = ? AND status = 'active'").get(conn.id);
  if (active) return res.json({ sessionId: active.id, existing: true });

  const sessionId = randomUUID();
  db.prepare('INSERT INTO work_sessions (id, connection_id) VALUES (?, ?)').run(sessionId, conn.id);

  res.json({ sessionId, existing: false });
});

// End session with AI summary — operator+admin
router.post('/:sessionId/end', requireRole('admin', 'operator'), async (req, res) => {
  const session = db.prepare('SELECT * FROM work_sessions WHERE id = ?').get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Sesion no encontrada' });
  if (session.status !== 'active') return res.json({ already: true });

  // Gather session data for summary
  const commands = db.prepare('SELECT command, exit_code FROM execution_log WHERE session_id = ?').all(session.id);
  const audits = db.prepare('SELECT user_prompt, final_status, task_type FROM audit_log WHERE session_id = ?').all(session.id);

  const startTime = new Date(session.started_at).getTime();
  const duration = Date.now() - startTime;

  // Generate simple summary
  const taskSummary = audits.map((a) => `- ${a.user_prompt} (${a.final_status})`).join('\n');
  const summary = `Sesion de trabajo: ${audits.length} tareas ejecutadas, ${session.successful_count} exitosas, ${session.failed_count} fallidas. Duracion: ${Math.round(duration / 60000)} minutos.\n\nTareas:\n${taskSummary || '(sin tareas registradas)'}`;

  db.prepare(
    `UPDATE work_sessions SET status = 'completed', ended_at = datetime('now'), summary = ?, total_duration_ms = ? WHERE id = ?`
  ).run(summary, duration, session.id);

  // Abandon zombie sessions for same connection
  db.prepare(
    `UPDATE work_sessions SET status = 'abandoned' WHERE connection_id = ? AND status = 'active' AND id != ?`
  ).run(session.connection_id, session.id);

  res.json({ summary, duration });
});

// Get active session for connection
router.get('/:connectionId/active', (req, res) => {
  const session = db.prepare(
    "SELECT * FROM work_sessions WHERE connection_id = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1"
  ).get(req.params.connectionId);
  res.json(session || null);
});

// Session history
router.get('/:connectionId/history', (req, res) => {
  const sessions = db.prepare(
    'SELECT * FROM work_sessions WHERE connection_id = ? ORDER BY started_at DESC LIMIT 50'
  ).all(req.params.connectionId);
  res.json(sessions);
});

// Session detail
router.get('/detail/:sessionId', (req, res) => {
  const session = db.prepare('SELECT * FROM work_sessions WHERE id = ?').get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Sesion no encontrada' });
  res.json({ ...session, changelog: JSON.parse(session.changelog || '[]') });
});

export default router;

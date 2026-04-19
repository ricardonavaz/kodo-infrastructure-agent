import { Router } from 'express';
import db from '../db.js';
import { runSecurityAudit } from '../services/security.js';
import { decrypt, isUnlocked } from '../services/crypto.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

function prepareForSSH(conn) {
  if (!conn) return conn;
  const prepared = { ...conn };
  if (conn.credentials_encrypted) {
    if (!isUnlocked()) throw new Error('Clave maestra bloqueada.');
    try {
      if (conn.credentials) prepared.credentials = decrypt(conn.credentials);
      if (conn.key_passphrase) prepared.key_passphrase = decrypt(conn.key_passphrase);
    } catch (e) { throw new Error('Error al descifrar: ' + e.message); }
  }
  return prepared;
}

// Run security audit — operator+admin
router.post('/audit/:connectionId', requireRole('admin', 'operator'), async (req, res) => {
  const conn = db.prepare('SELECT * FROM connections WHERE id = ?').get(req.params.connectionId);
  if (!conn) return res.status(404).json({ error: 'Conexion no encontrada' });

  try {
    const result = await runSecurityAudit(prepareForSSH(conn));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get latest security report
router.get('/report/:connectionId', (req, res) => {
  const profile = db.prepare('SELECT security_score, last_security_scan FROM server_profiles WHERE connection_id = ?').get(req.params.connectionId);
  const lastEvent = db.prepare(
    "SELECT details, created_at FROM server_events WHERE connection_id = ? AND event_type = 'security_scan' ORDER BY created_at DESC LIMIT 1"
  ).get(req.params.connectionId);

  if (!lastEvent) return res.json({ score: null, message: 'Sin auditorias previas' });

  res.json({
    score: profile?.security_score,
    lastScan: profile?.last_security_scan,
    report: JSON.parse(lastEvent.details || '{}'),
  });
});

// Get server events (bitacora)
router.get('/events/:connectionId', (req, res) => {
  const { days = 7, event_type, severity, limit = 100 } = req.query;
  let sql = `SELECT * FROM server_events WHERE connection_id = ? AND created_at >= datetime('now', ?)`;
  const params = [req.params.connectionId, `-${days} days`];

  if (event_type) { sql += ' AND event_type = ?'; params.push(event_type); }
  if (severity) { sql += ' AND severity = ?'; params.push(severity); }

  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit));

  res.json(db.prepare(sql).all(...params));
});

export default router;

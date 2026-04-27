import { Router } from 'express';
import db from '../db.js';
import { detectOsFamily, queryPendingUpdates, applyUpdates } from '../services/updates.js';
import { decrypt, isUnlocked } from '../services/crypto.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

function prepareForSSH(conn) {
  if (!conn) return conn;
  const prepared = { ...conn };
  if (conn.credentials_encrypted && isUnlocked()) {
    try {
      if (conn.credentials) prepared.credentials = decrypt(conn.credentials);
      if (conn.key_passphrase) prepared.key_passphrase = decrypt(conn.key_passphrase);
    } catch { /* ignore */ }
  }
  return prepared;
}

// Check updates for a connection — operator+admin
router.post('/check/:connectionId', requireRole('admin', 'operator'), async (req, res) => {
  const conn = db.prepare('SELECT * FROM connections WHERE id = ?').get(req.params.connectionId);
  if (!conn) return res.status(404).json({ error: 'Conexion no encontrada' });

  try {
    const sshConn = prepareForSSH(conn);
    const { osFamily, updateMechanism } = await detectOsFamily(sshConn);
    const updates = await queryPendingUpdates(sshConn, updateMechanism);

    const result = db.prepare(
      `INSERT INTO update_checks (connection_id, os_family, update_mechanism, pending_count, updates_json)
       VALUES (?, ?, ?, ?, ?)`
    ).run(conn.id, osFamily, updateMechanism, updates.length, JSON.stringify(updates));

    res.json({
      id: result.lastInsertRowid,
      osFamily,
      updateMechanism,
      pendingCount: updates.length,
      updates,
      criticalCount: updates.filter((u) => u.severity === 'critical').length,
      requiresReboot: updates.some((u) => u.requiresReboot),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get latest status for a connection
router.get('/status/:connectionId', (req, res) => {
  const check = db.prepare(
    'SELECT * FROM update_checks WHERE connection_id = ? ORDER BY checked_at DESC LIMIT 1'
  ).get(req.params.connectionId);
  res.json(check || { pendingCount: 0, status: 'unknown' });
});

// Get status for all connections
router.get('/status', (req, res) => {
  const checks = db.prepare(`
    SELECT uc.* FROM update_checks uc
    INNER JOIN (SELECT connection_id, MAX(checked_at) as max_checked FROM update_checks GROUP BY connection_id) latest
    ON uc.connection_id = latest.connection_id AND uc.checked_at = latest.max_checked
  `).all();
  res.json(checks);
});

// Apply updates — operator+admin
router.post('/apply/:connectionId', requireRole('admin', 'operator'), async (req, res) => {
  const { updateNames, applyAll } = req.body;
  const conn = db.prepare('SELECT * FROM connections WHERE id = ?').get(req.params.connectionId);
  if (!conn) return res.status(404).json({ error: 'Conexion no encontrada' });

  const latestCheck = db.prepare(
    'SELECT * FROM update_checks WHERE connection_id = ? ORDER BY checked_at DESC LIMIT 1'
  ).get(conn.id);

  if (!latestCheck) {
    return res.status(400).json({ error: 'Primero ejecuta una verificacion de actualizaciones' });
  }

  try {
    const sshConn = prepareForSSH(conn);
    const execRecord = db.prepare(
      'INSERT INTO update_executions (connection_id, update_check_id, updates_applied) VALUES (?, ?, ?)'
    ).run(conn.id, latestCheck.id, JSON.stringify(applyAll ? ['all'] : (updateNames || [])));
    const execId = execRecord.lastInsertRowid;

    const result = await applyUpdates(
      sshConn,
      latestCheck.update_mechanism,
      applyAll ? null : updateNames
    );

    db.prepare(
      'UPDATE update_executions SET completed_at = datetime(\'now\'), status = ?, output = ?, requires_reboot = ?, error = ? WHERE id = ?'
    ).run(
      result.success ? 'success' : 'failed',
      (result.output || '').substring(0, 50000),
      result.requiresReboot ? 1 : 0,
      result.stderr || null,
      execId
    );

    res.json({
      success: result.success,
      requiresReboot: result.requiresReboot,
      output: result.output?.substring(0, 2000),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update history for a connection
router.get('/history/:connectionId', (req, res) => {
  const checks = db.prepare(
    'SELECT * FROM update_checks WHERE connection_id = ? ORDER BY checked_at DESC LIMIT 20'
  ).all(req.params.connectionId);
  const execs = db.prepare(
    'SELECT * FROM update_executions WHERE connection_id = ? ORDER BY started_at DESC LIMIT 20'
  ).all(req.params.connectionId);
  res.json({ checks, executions: execs });
});

// Dashboard
router.get('/dashboard/summary', (req, res) => {
  const connections = db.prepare('SELECT id, name, host, os_type FROM connections').all();
  const dashboard = connections.map((conn) => {
    const latest = db.prepare(
      'SELECT * FROM update_checks WHERE connection_id = ? ORDER BY checked_at DESC LIMIT 1'
    ).get(conn.id);
    const lastExec = db.prepare(
      'SELECT * FROM update_executions WHERE connection_id = ? ORDER BY started_at DESC LIMIT 1'
    ).get(conn.id);

    let updates = [];
    let criticalCount = 0;
    if (latest?.updates_json) {
      updates = JSON.parse(latest.updates_json);
      criticalCount = updates.filter((u) => u.severity === 'critical').length;
    }

    return {
      connectionId: conn.id,
      connectionName: conn.name,
      host: conn.host,
      osType: conn.os_type,
      lastCheck: latest?.checked_at || null,
      pendingCount: latest?.pending_count || 0,
      criticalCount,
      osFamily: latest?.os_family || null,
      lastSuccess: lastExec?.status === 'success' ? lastExec.completed_at : null,
      lastFailure: lastExec?.status === 'failed' ? lastExec.completed_at : null,
    };
  });

  res.json(dashboard);
});

export default router;

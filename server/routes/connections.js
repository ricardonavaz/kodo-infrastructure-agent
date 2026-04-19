import { Router } from 'express';
import db from '../db.js';
import { testConnection, disconnect, getConnection, getConnectionStatus } from '../services/ssh.js';
import { encrypt, decrypt, isUnlocked } from '../services/crypto.js';
import { profileServer, getProfile, generateBriefing } from '../services/profiler.js';
import { randomUUID } from 'crypto';
import { requireRole } from '../middleware/auth.js';

// Prepare connection for SSH use: decrypt credentials if encrypted
function prepareForSSH(conn) {
  if (!conn) return conn;
  const prepared = { ...conn };
  if (conn.credentials_encrypted) {
    if (!isUnlocked()) {
      throw new Error('Clave maestra bloqueada. Desbloquea en Configuracion para usar credenciales cifradas.');
    }
    try {
      if (conn.credentials) prepared.credentials = decrypt(conn.credentials);
      if (conn.key_passphrase) prepared.key_passphrase = decrypt(conn.key_passphrase);
    } catch (e) {
      throw new Error('Error al descifrar credenciales: ' + e.message);
    }
  }
  return prepared;
}

const router = Router();

const SELECT_FIELDS = 'id, name, host, port, username, auth_type, os_type, environment, tags, description, notes, is_favorite, status, last_connection_at, last_validation_result, created_at';

// Batch status - must be before /:id routes
router.get('/status/all', (req, res) => {
  const connections = db.prepare('SELECT * FROM connections').all();
  const statuses = {};
  for (const conn of connections) {
    statuses[conn.id] = getConnectionStatus(conn);
  }
  res.json(statuses);
});

// List with filters
router.get('/', (req, res) => {
  const { search, environment, tags, status, favorite, group_id } = req.query;
  let sql = `SELECT ${SELECT_FIELDS} FROM connections`;
  const conditions = [];
  const params = [];

  if (search) {
    conditions.push('(name LIKE ? OR host LIKE ? OR tags LIKE ? OR description LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }
  if (environment) {
    conditions.push('environment = ?');
    params.push(environment);
  }
  if (tags) {
    conditions.push('tags LIKE ?');
    params.push(`%${tags}%`);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  if (favorite === '1' || favorite === 'true') {
    conditions.push('is_favorite = 1');
  }
  if (group_id) {
    conditions.push('id IN (SELECT connection_id FROM server_group_members WHERE group_id = ?)');
    params.push(group_id);
  }

  if (conditions.length) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY is_favorite DESC, name ASC';

  const connections = db.prepare(sql).all(...params);
  res.json(connections);
});

// Get single
router.get('/:id', (req, res) => {
  const conn = db.prepare(`SELECT ${SELECT_FIELDS} FROM connections WHERE id = ?`).get(req.params.id);
  if (!conn) return res.status(404).json({ error: 'Conexion no encontrada' });
  res.json(conn);
});

// Create with duplicate detection — operator+admin
router.post('/', requireRole('admin', 'operator'), (req, res) => {
  const { name, host, port, username, auth_type, credentials, os_type, environment, tags, description, notes, is_favorite } = req.body;

  if (!name || !host || !username) {
    return res.status(400).json({ error: 'Nombre, host y usuario son requeridos' });
  }

  // Duplicate detection
  const existing = db.prepare('SELECT id, name FROM connections WHERE host = ? AND port = ? AND username = ?').get(
    host, port || 22, username
  );
  if (existing) {
    return res.status(409).json({
      error: 'Ya existe una conexion con el mismo host, puerto y usuario',
      existing: { id: existing.id, name: existing.name },
    });
  }

  // Encrypt credentials if master key is unlocked
  let storedCredentials = credentials || '';
  let storedPassphrase = req.body.key_passphrase || '';
  let credentialsEncrypted = 0;
  if (isUnlocked() && storedCredentials) {
    storedCredentials = encrypt(storedCredentials);
    if (storedPassphrase) storedPassphrase = encrypt(storedPassphrase);
    credentialsEncrypted = 1;
  }

  const result = db.prepare(
    `INSERT INTO connections (name, host, port, username, auth_type, credentials, os_type, environment, tags, description, notes, is_favorite, key_path, key_passphrase, credentials_encrypted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    name, host, port || 22, username,
    auth_type || 'password', storedCredentials, os_type || 'linux',
    environment || 'production',
    JSON.stringify(tags || []),
    description || '', notes || '',
    is_favorite ? 1 : 0,
    req.body.key_path || '', storedPassphrase, credentialsEncrypted
  );

  const conn = db.prepare(`SELECT ${SELECT_FIELDS} FROM connections WHERE id = ?`).get(result.lastInsertRowid);
  res.status(201).json(conn);
});

// Update — operator+admin
router.put('/:id', requireRole('admin', 'operator'), (req, res) => {
  const { name, host, port, username, auth_type, credentials, os_type, environment, tags, description, notes, is_favorite } = req.body;
  const existing = db.prepare('SELECT * FROM connections WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Conexion no encontrada' });

  // Handle credential encryption on update
  let storedCredentials = credentials || null;
  let storedPassphrase = req.body.key_passphrase || null;
  let credentialsEncrypted = existing.credentials_encrypted;

  if (storedCredentials) {
    // New credentials provided - encrypt if master key is unlocked
    if (isUnlocked()) {
      storedCredentials = encrypt(storedCredentials);
      if (storedPassphrase) storedPassphrase = encrypt(storedPassphrase);
      credentialsEncrypted = 1;
    } else {
      credentialsEncrypted = 0;
    }
  }

  db.prepare(
    `UPDATE connections SET
      name = ?, host = ?, port = ?, username = ?, auth_type = ?,
      credentials = COALESCE(?, credentials), os_type = ?,
      environment = ?, tags = ?, description = ?, notes = ?, is_favorite = ?,
      key_path = COALESCE(?, key_path), key_passphrase = COALESCE(?, key_passphrase),
      credentials_encrypted = ?
    WHERE id = ?`
  ).run(
    name || existing.name,
    host || existing.host,
    port || existing.port,
    username || existing.username,
    auth_type || existing.auth_type,
    storedCredentials,
    os_type || existing.os_type,
    environment || existing.environment,
    tags !== undefined ? JSON.stringify(tags) : existing.tags,
    description !== undefined ? description : existing.description,
    notes !== undefined ? notes : existing.notes,
    is_favorite !== undefined ? (is_favorite ? 1 : 0) : existing.is_favorite,
    req.body.key_path || null,
    storedPassphrase,
    credentialsEncrypted,
    req.params.id
  );

  const conn = db.prepare(`SELECT ${SELECT_FIELDS} FROM connections WHERE id = ?`).get(req.params.id);
  res.json(conn);
});

// Toggle favorite — operator+admin
router.put('/:id/favorite', requireRole('admin', 'operator'), (req, res) => {
  const conn = db.prepare('SELECT id, is_favorite FROM connections WHERE id = ?').get(req.params.id);
  if (!conn) return res.status(404).json({ error: 'Conexion no encontrada' });

  const newVal = conn.is_favorite ? 0 : 1;
  db.prepare('UPDATE connections SET is_favorite = ? WHERE id = ?').run(newVal, req.params.id);
  res.json({ id: conn.id, is_favorite: newVal });
});

// Delete — operator+admin
router.delete('/:id', requireRole('admin', 'operator'), (req, res) => {
  const existing = db.prepare('SELECT * FROM connections WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Conexion no encontrada' });

  disconnect(existing);
  db.prepare('DELETE FROM connections WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Test connection — operator+admin
router.post('/:id/test', requireRole('admin', 'operator'), async (req, res) => {
  const conn = db.prepare('SELECT * FROM connections WHERE id = ?').get(req.params.id);
  if (!conn) return res.status(404).json({ error: 'Conexion no encontrada' });

  const result = await testConnection(prepareForSSH(conn));

  // Persist validation result
  const validationResult = JSON.stringify({
    status: result.success ? 'ok' : 'unreachable',
    message: result.success ? result.output : result.error,
    timestamp: new Date().toISOString(),
  });
  db.prepare('UPDATE connections SET last_validation_result = ?, status = ? WHERE id = ?').run(
    validationResult,
    result.success ? 'ok' : 'unreachable',
    req.params.id
  );

  res.json(result);
});

// Connect — operator+admin
router.post('/:id/connect', requireRole('admin', 'operator'), async (req, res) => {
  const conn = db.prepare('SELECT * FROM connections WHERE id = ?').get(req.params.id);
  if (!conn) return res.status(404).json({ error: 'Conexion no encontrada' });

  try {
    const { ssh } = await getConnection(prepareForSSH(conn));
    const whoami = await ssh.execCommand(
      conn.os_type === 'windows' ? 'hostname' : 'whoami && hostname && uname -a'
    );

    // Persist connection time and status
    db.prepare(`UPDATE connections SET last_connection_at = datetime('now'), status = 'ok' WHERE id = ?`).run(req.params.id);

    // Auto-start work session
    let sessionId = null;
    const activeSession = db.prepare("SELECT id FROM work_sessions WHERE connection_id = ? AND status = 'active'").get(req.params.id);
    if (activeSession) {
      sessionId = activeSession.id;
    } else {
      sessionId = randomUUID();
      db.prepare('INSERT INTO work_sessions (id, connection_id) VALUES (?, ?)').run(sessionId, req.params.id);
    }

    // Only auto-profile on FIRST connection ever (no profile exists)
    let profile = getProfile(req.params.id);
    let firstConnection = !profile;

    if (!profile) {
      try {
        profile = await profileServer(prepareForSSH(conn));
      } catch { /* profiling failed, non-critical */ }
    }

    // Generate briefing for first connection
    const briefing = firstConnection && profile ? generateBriefing(profile, conn.name) : null;

    res.json({
      success: true,
      message: 'Conexion establecida',
      output: whoami.stdout.trim(),
      host: conn.host,
      port: conn.port,
      username: conn.username,
      sessionId,
      firstConnection,
      briefing,
      profile: profile ? { os_family: profile.os_family, os_version: profile.os_version, package_manager: profile.package_manager, distro: profile.distro } : null,
    });
  } catch (err) {
    const newStatus = err.message.includes('Authentication') ? 'invalid_credentials' : 'unreachable';
    db.prepare('UPDATE connections SET status = ? WHERE id = ?').run(newStatus, req.params.id);

    res.json({
      success: false,
      message: 'Error de conexion',
      error: err.message,
      host: conn.host,
      port: conn.port,
    });
  }
});

// Disconnect — operator+admin
router.post('/:id/disconnect', requireRole('admin', 'operator'), (req, res) => {
  const conn = db.prepare('SELECT * FROM connections WHERE id = ?').get(req.params.id);
  if (!conn) return res.status(404).json({ error: 'Conexion no encontrada' });

  disconnect(conn);

  // Close active work session
  const activeSession = db.prepare("SELECT id, started_at FROM work_sessions WHERE connection_id = ? AND status = 'active'").get(req.params.id);
  if (activeSession) {
    const duration = Date.now() - new Date(activeSession.started_at).getTime();
    const audits = db.prepare('SELECT user_prompt, final_status FROM audit_log WHERE session_id = ?').all(activeSession.id);
    const taskList = audits.map((a) => `- ${a.user_prompt} (${a.final_status})`).join('\n');
    const summary = `Sesion finalizada. ${audits.length} tareas. Duracion: ${Math.round(duration / 60000)} min.\n${taskList || '(sin tareas)'}`;

    db.prepare(`UPDATE work_sessions SET status = 'completed', ended_at = datetime('now'), summary = ?, total_duration_ms = ? WHERE id = ?`)
      .run(summary, duration, activeSession.id);
  }

  res.json({ success: true, message: 'Desconectado', sessionSummary: activeSession ? 'Sesion cerrada' : null });
});

// Status
router.get('/:id/status', (req, res) => {
  const conn = db.prepare('SELECT * FROM connections WHERE id = ?').get(req.params.id);
  if (!conn) return res.status(404).json({ error: 'Conexion no encontrada' });

  const status = getConnectionStatus(conn);
  res.json({ id: conn.id, status });
});

export default router;

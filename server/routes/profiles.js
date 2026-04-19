import { Router } from 'express';
import db from '../db.js';
import { profileServer, getProfile } from '../services/profiler.js';
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

// Get profile
router.get('/:connectionId', (req, res) => {
  const profile = getProfile(req.params.connectionId);
  if (!profile) return res.json(null);
  res.json(profile);
});

// List all profiles
router.get('/', (req, res) => {
  const profiles = db.prepare(`
    SELECT sp.*, c.name as connection_name, c.host
    FROM server_profiles sp
    JOIN connections c ON sp.connection_id = c.id
    ORDER BY c.name
  `).all();
  res.json(profiles);
});

// Update manual fields — operator+admin
router.put('/:connectionId', requireRole('admin', 'operator'), (req, res) => {
  const { role, responsible, sla_level, custom_notes, custom_tags, maintenance_window,
          os_family, os_version, distro, shell_version } = req.body;
  const profile = getProfile(req.params.connectionId);
  if (!profile) return res.status(404).json({ error: 'Profile no encontrado. Conecta primero.' });

  db.prepare(`
    UPDATE server_profiles SET role=?, responsible=?, sla_level=?, custom_notes=?, custom_tags=?, maintenance_window=?,
      os_family=?, os_version=?, distro=?, shell_version=?
    WHERE connection_id=?
  `).run(
    role ?? profile.role, responsible ?? profile.responsible,
    sla_level ?? profile.sla_level, custom_notes ?? profile.custom_notes,
    custom_tags ? JSON.stringify(custom_tags) : profile.custom_tags,
    maintenance_window ?? profile.maintenance_window,
    os_family ?? profile.os_family, os_version ?? profile.os_version,
    distro ?? profile.distro, shell_version ?? profile.shell_version,
    req.params.connectionId
  );

  res.json(getProfile(req.params.connectionId));
});

// Refresh auto-profiling (full reset, like first connection) — operator+admin
router.post('/:connectionId/refresh', requireRole('admin', 'operator'), async (req, res) => {
  const conn = db.prepare('SELECT * FROM connections WHERE id = ?').get(req.params.connectionId);
  if (!conn) return res.status(404).json({ error: 'Conexion no encontrada' });

  try {
    // Save manual fields before delete
    const existing = getProfile(req.params.connectionId);
    const manualFields = existing ? {
      role: existing.role,
      responsible: existing.responsible,
      sla_level: existing.sla_level,
      custom_notes: existing.custom_notes,
      custom_tags: existing.custom_tags,
      maintenance_window: existing.maintenance_window,
    } : null;

    // Delete existing profile for a clean re-scan
    db.prepare('DELETE FROM server_profiles WHERE connection_id = ?').run(req.params.connectionId);

    // Run full profiling like first connection
    const profile = await profileServer(prepareForSSH(conn));

    // Restore manual fields
    if (manualFields) {
      db.prepare(`
        UPDATE server_profiles SET role=?, responsible=?, sla_level=?, custom_notes=?, custom_tags=?, maintenance_window=?
        WHERE connection_id=?
      `).run(
        manualFields.role || '', manualFields.responsible || '',
        manualFields.sla_level || '', manualFields.custom_notes || '',
        manualFields.custom_tags || '[]', manualFields.maintenance_window || '',
        req.params.connectionId
      );
    }

    const updated = getProfile(req.params.connectionId);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

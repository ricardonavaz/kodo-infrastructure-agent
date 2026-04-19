import { Router } from 'express';
import { randomBytes } from 'crypto';
import db from '../db.js';
import {
  hashPassword, verifyPassword, setupMasterKey, unlockWithPassword,
  lockMasterKey, isUnlocked, isKeychainAvailable, getFromKeychain,
  setInKeychain, deleteFromKeychain, encrypt, decrypt,
} from '../services/crypto.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// Get settings (mask sensitive values)
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const row of rows) {
    if (row.key === 'anthropic_api_key') {
      settings[row.key] = row.value ? '••••••••' + row.value.slice(-8) : '';
    } else if (row.key === 'master_key_hash' || row.key === 'master_key_salt') {
      continue; // never expose
    } else {
      settings[row.key] = row.value;
    }
  }
  res.json(settings);
});

// Update settings (admin only)
router.put('/', requireRole('admin'), (req, res) => {
  const { anthropic_api_key, default_model } = req.body;

  if (anthropic_api_key !== undefined) {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
      'anthropic_api_key', anthropic_api_key
    );
  }
  if (default_model !== undefined) {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
      'default_model', default_model
    );
  }

  res.json({ success: true });
});

// Master key status
router.get('/master-key/status', (req, res) => {
  const hashRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('master_key_hash');
  const keychainRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('use_keychain');

  res.json({
    isSetup: !!hashRow?.value,
    isUnlocked: isUnlocked(),
    keychainAvailable: isKeychainAvailable(),
    keychainConfigured: keychainRow?.value === 'true',
  });
});

// Setup master key (admin only)
router.post('/master-key/setup', requireRole('admin'), (req, res) => {
  const { password, useKeychain } = req.body;
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'La clave maestra debe tener al menos 8 caracteres' });
  }

  // Check if already set up
  const existing = db.prepare('SELECT value FROM settings WHERE key = ?').get('master_key_hash');
  if (existing?.value) {
    return res.status(409).json({ error: 'La clave maestra ya esta configurada' });
  }

  const salt = randomBytes(32).toString('base64');
  const { hash } = hashPassword(password);

  const transaction = db.transaction(() => {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('master_key_hash', hash);
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('master_key_salt', salt);
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('use_keychain', useKeychain ? 'true' : 'false');
  });
  transaction();

  // Unlock immediately
  setupMasterKey(password, salt);

  // Store in keychain if requested
  if (useKeychain && isKeychainAvailable()) {
    setInKeychain(password);
  }

  res.json({ success: true });
});

// Unlock master key (admin only)
router.post('/master-key/unlock', requireRole('admin'), (req, res) => {
  const { password } = req.body;
  const hashRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('master_key_hash');
  const saltRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('master_key_salt');

  if (!hashRow?.value || !saltRow?.value) {
    return res.status(400).json({ error: 'La clave maestra no esta configurada' });
  }

  if (!verifyPassword(password, hashRow.value, saltRow.value)) {
    return res.status(401).json({ error: 'Clave incorrecta' });
  }

  unlockWithPassword(password, saltRow.value);
  res.json({ success: true });
});

// Lock master key (admin only)
router.post('/master-key/lock', requireRole('admin'), (req, res) => {
  lockMasterKey();
  res.json({ success: true });
});

// Encrypt all existing plaintext credentials (admin only)
router.post('/connections/encrypt-all', requireRole('admin'), (req, res) => {
  if (!isUnlocked()) {
    return res.status(400).json({ error: 'Desbloquea la clave maestra primero' });
  }

  const connections = db.prepare(`SELECT id, credentials, key_passphrase, credentials_encrypted FROM connections WHERE credentials_encrypted = 0 AND credentials != ''`).all();

  let count = 0;
  const transaction = db.transaction(() => {
    for (const conn of connections) {
      const encCredentials = encrypt(conn.credentials);
      const encPassphrase = conn.key_passphrase ? encrypt(conn.key_passphrase) : '';
      db.prepare('UPDATE connections SET credentials = ?, key_passphrase = ?, credentials_encrypted = 1 WHERE id = ?').run(
        encCredentials, encPassphrase, conn.id
      );
      count++;
    }
  });
  transaction();

  res.json({ success: true, encrypted: count });
});

// Auto-unlock from keychain on module load
try {
  const keychainRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('use_keychain');
  if (keychainRow?.value === 'true' && isKeychainAvailable()) {
    const password = getFromKeychain();
    if (password) {
      const saltRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('master_key_salt');
      if (saltRow?.value) {
        unlockWithPassword(password, saltRow.value);
        console.log('  Master key auto-unlocked from Keychain');
      }
    }
  }
} catch {
  // Keychain not available or not configured
}

export default router;

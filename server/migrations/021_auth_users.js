import { scryptSync, randomBytes } from 'crypto';

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT DEFAULT '',
      role TEXT DEFAULT 'operator',
      enabled INTEGER DEFAULT 1,
      must_change_password INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS session_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_tokens_token ON session_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_tokens_expires ON session_tokens(expires_at);
  `);

  // Create default admin user: admin / admin (must change on first login)
  const adminHash = hashPassword('admin');
  db.prepare(
    `INSERT OR IGNORE INTO users (username, password_hash, display_name, role, must_change_password) VALUES (?, ?, ?, ?, ?)`
  ).run('admin', adminHash, 'Administrador', 'admin', 1);
}

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS update_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      connection_id INTEGER NOT NULL,
      checked_at TEXT DEFAULT (datetime('now')),
      os_family TEXT,
      update_mechanism TEXT,
      pending_count INTEGER DEFAULT 0,
      updates_json TEXT DEFAULT '[]',
      status TEXT DEFAULT 'checked',
      FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS update_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      connection_id INTEGER NOT NULL,
      update_check_id INTEGER,
      started_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      updates_applied TEXT DEFAULT '[]',
      status TEXT DEFAULT 'running',
      output TEXT,
      requires_reboot INTEGER DEFAULT 0,
      error TEXT,
      FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE,
      FOREIGN KEY (update_check_id) REFERENCES update_checks(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_update_checks_connection ON update_checks(connection_id);
  `);
}

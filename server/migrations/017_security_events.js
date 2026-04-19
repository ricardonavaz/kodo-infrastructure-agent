export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS server_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      connection_id INTEGER NOT NULL,
      session_id TEXT,
      event_type TEXT NOT NULL,
      severity TEXT DEFAULT 'info',
      title TEXT NOT NULL,
      details TEXT,
      command_executed TEXT,
      exit_code INTEGER,
      user_action TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_server_events_conn ON server_events(connection_id);
    CREATE INDEX IF NOT EXISTS idx_server_events_type ON server_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_server_events_created ON server_events(created_at);
  `);

  // Add security fields to profiles
  const cols = [
    "ALTER TABLE server_profiles ADD COLUMN security_score INTEGER DEFAULT NULL",
    "ALTER TABLE server_profiles ADD COLUMN last_security_scan TEXT",
  ];
  for (const sql of cols) {
    try { db.exec(sql); } catch { /* exists */ }
  }
}

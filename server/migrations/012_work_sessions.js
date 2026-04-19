export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS work_sessions (
      id TEXT PRIMARY KEY,
      connection_id INTEGER NOT NULL,
      started_at TEXT DEFAULT (datetime('now')),
      ended_at TEXT,
      status TEXT DEFAULT 'active',
      summary TEXT,
      changelog TEXT DEFAULT '[]',
      commands_count INTEGER DEFAULT 0,
      successful_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      total_duration_ms INTEGER DEFAULT 0,
      model_used TEXT,
      FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_work_sessions_connection ON work_sessions(connection_id);
    CREATE INDEX IF NOT EXISTS idx_work_sessions_status ON work_sessions(status);
  `);

  const tables = ['chat_history', 'execution_log', 'audit_log', 'active_jobs'];
  for (const t of tables) {
    try { db.exec(`ALTER TABLE ${t} ADD COLUMN session_id TEXT`); } catch { /* exists */ }
  }
}

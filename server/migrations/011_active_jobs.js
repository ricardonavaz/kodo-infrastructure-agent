export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS active_jobs (
      id TEXT PRIMARY KEY,
      connection_id INTEGER NOT NULL,
      status TEXT DEFAULT 'running',
      user_prompt TEXT,
      model TEXT,
      events TEXT DEFAULT '[]',
      result TEXT,
      error TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_active_jobs_connection ON active_jobs(connection_id);
    CREATE INDEX IF NOT EXISTS idx_active_jobs_status ON active_jobs(status);
  `);
}

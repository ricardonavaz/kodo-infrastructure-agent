export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS execution_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      connection_id INTEGER NOT NULL,
      chat_history_id INTEGER,
      command TEXT NOT NULL,
      stdout TEXT,
      stderr TEXT,
      exit_code INTEGER,
      started_at TEXT,
      completed_at TEXT,
      execution_time_ms INTEGER,
      connection_time_ms INTEGER,
      timed_out INTEGER DEFAULT 0,
      retried INTEGER DEFAULT 0,
      truncated INTEGER DEFAULT 0,
      FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_execution_log_connection ON execution_log(connection_id);
    CREATE INDEX IF NOT EXISTS idx_execution_log_started ON execution_log(started_at);
  `);
}

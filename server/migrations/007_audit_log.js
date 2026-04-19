export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      connection_id INTEGER,
      connection_name TEXT,
      user_profile TEXT DEFAULT 'default',
      datetime TEXT DEFAULT (datetime('now')),
      user_prompt TEXT,
      agent_interpretation TEXT,
      commands_generated TEXT DEFAULT '[]',
      full_output TEXT DEFAULT '[]',
      duration_ms INTEGER,
      final_status TEXT,
      model_used TEXT,
      task_type TEXT DEFAULT 'other',
      errors TEXT,
      FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_connection ON audit_log(connection_id);
    CREATE INDEX IF NOT EXISTS idx_audit_datetime ON audit_log(datetime);
    CREATE INDEX IF NOT EXISTS idx_audit_task_type ON audit_log(task_type);
  `);
}

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      cron_expression TEXT NOT NULL,
      connection_id INTEGER,
      group_id INTEGER,
      playbook_id INTEGER,
      command TEXT,
      task_type TEXT DEFAULT 'command',
      enabled INTEGER DEFAULT 1,
      time_window_start TEXT,
      time_window_end TEXT,
      retry_count INTEGER DEFAULT 0,
      retry_delay_ms INTEGER DEFAULT 30000,
      timeout_ms INTEGER DEFAULT 60000,
      last_run_at TEXT,
      next_run_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES server_groups(id) ON DELETE SET NULL,
      FOREIGN KEY (playbook_id) REFERENCES playbooks(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS scheduled_task_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      connection_id INTEGER,
      started_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      status TEXT DEFAULT 'running',
      output TEXT,
      error TEXT,
      duration_ms INTEGER,
      FOREIGN KEY (task_id) REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE SET NULL
    );
  `);
}

export function up(db) {
  // New columns on playbooks
  const pbCols = [
    "ALTER TABLE playbooks ADD COLUMN auditor_mode TEXT DEFAULT 'none'",
    "ALTER TABLE playbooks ADD COLUMN execution_mode TEXT DEFAULT 'sequential'",
    "ALTER TABLE playbooks ADD COLUMN max_sub_depth INTEGER DEFAULT 5",
  ];
  for (const sql of pbCols) {
    try { db.exec(sql); } catch { /* exists */ }
  }

  // New columns on playbook_runs
  const runCols = [
    "ALTER TABLE playbook_runs ADD COLUMN execution_mode TEXT DEFAULT 'sequential'",
    "ALTER TABLE playbook_runs ADD COLUMN auditor_log TEXT DEFAULT '[]'",
    "ALTER TABLE playbook_runs ADD COLUMN current_step INTEGER DEFAULT 0",
    "ALTER TABLE playbook_runs ADD COLUMN paused_at TEXT",
    "ALTER TABLE playbook_runs ADD COLUMN paused_reason TEXT",
  ];
  for (const sql of runCols) {
    try { db.exec(sql); } catch { /* exists */ }
  }

  // New table: interactions during playbook execution
  db.exec(`
    CREATE TABLE IF NOT EXISTS playbook_run_interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      step_index INTEGER NOT NULL,
      interaction_type TEXT NOT NULL,
      prompt_text TEXT DEFAULT '',
      title TEXT DEFAULT '',
      style TEXT DEFAULT 'info',
      options TEXT DEFAULT '[]',
      variable_name TEXT DEFAULT '',
      input_type TEXT DEFAULT 'text',
      response TEXT,
      responded_at TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (run_id) REFERENCES playbook_runs(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_interactions_run ON playbook_run_interactions(run_id);
    CREATE INDEX IF NOT EXISTS idx_interactions_status ON playbook_run_interactions(status);
  `);
}

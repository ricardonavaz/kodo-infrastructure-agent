export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      connection_id INTEGER,
      os_family TEXT,
      os_version TEXT,
      category TEXT DEFAULT 'other',
      action_name TEXT NOT NULL,
      command_sequence TEXT DEFAULT '[]',
      preconditions TEXT DEFAULT '[]',
      outcome TEXT,
      outcome_details TEXT,
      error_message TEXT,
      resolution TEXT,
      tags TEXT DEFAULT '[]',
      success_count INTEGER DEFAULT 0,
      failure_count INTEGER DEFAULT 0,
      last_used_at TEXT,
      learned_from_session TEXT,
      source TEXT DEFAULT 'auto',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_knowledge_os ON knowledge_entries(os_family, os_version);
    CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_entries(category);

    CREATE TABLE IF NOT EXISTS knowledge_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      source_type TEXT,
      source_path TEXT,
      os_family TEXT,
      os_version TEXT,
      category TEXT DEFAULT 'general',
      content_text TEXT,
      content_chunks TEXT DEFAULT '[]',
      tags TEXT DEFAULT '[]',
      file_size INTEGER,
      imported_at TEXT DEFAULT (datetime('now')),
      last_used_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_docs_os ON knowledge_documents(os_family);
  `);
}

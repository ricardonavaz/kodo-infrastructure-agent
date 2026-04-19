export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS server_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      type TEXT DEFAULT 'custom',
      description TEXT DEFAULT '',
      color TEXT DEFAULT '#00ff41',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS server_group_members (
      group_id INTEGER NOT NULL,
      connection_id INTEGER NOT NULL,
      PRIMARY KEY (group_id, connection_id),
      FOREIGN KEY (group_id) REFERENCES server_groups(id) ON DELETE CASCADE,
      FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
    );
  `);
}

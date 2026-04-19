export function up(db) {
  const columns = [
    "ALTER TABLE connections ADD COLUMN environment TEXT DEFAULT 'production'",
    "ALTER TABLE connections ADD COLUMN tags TEXT DEFAULT '[]'",
    "ALTER TABLE connections ADD COLUMN description TEXT DEFAULT ''",
    "ALTER TABLE connections ADD COLUMN notes TEXT DEFAULT ''",
    "ALTER TABLE connections ADD COLUMN last_connection_at TEXT",
    "ALTER TABLE connections ADD COLUMN last_validation_result TEXT",
    "ALTER TABLE connections ADD COLUMN is_favorite INTEGER DEFAULT 0",
    "ALTER TABLE connections ADD COLUMN status TEXT DEFAULT 'pending_review'",
  ];

  for (const sql of columns) {
    try {
      db.exec(sql);
    } catch (e) {
      // Column may already exist if migrating from inline schema
      if (!e.message.includes('duplicate column')) throw e;
    }
  }
}

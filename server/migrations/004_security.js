export function up(db) {
  const columns = [
    "ALTER TABLE connections ADD COLUMN credentials_encrypted INTEGER DEFAULT 0",
    "ALTER TABLE connections ADD COLUMN key_passphrase TEXT DEFAULT ''",
    "ALTER TABLE connections ADD COLUMN key_path TEXT DEFAULT ''",
  ];

  for (const sql of columns) {
    try {
      db.exec(sql);
    } catch (e) {
      if (!e.message.includes('duplicate column')) throw e;
    }
  }
}

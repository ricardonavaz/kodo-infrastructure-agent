export function up(db) {
  const cols = [
    "ALTER TABLE server_profiles ADD COLUMN shell_version TEXT DEFAULT ''",
  ];
  for (const sql of cols) {
    try { db.exec(sql); } catch { /* column already exists */ }
  }
}

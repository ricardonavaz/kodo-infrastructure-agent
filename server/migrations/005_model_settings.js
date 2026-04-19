export function up(db) {
  const columns = [
    "ALTER TABLE connections ADD COLUMN preferred_model TEXT DEFAULT NULL",
    "ALTER TABLE chat_history ADD COLUMN model_used TEXT DEFAULT NULL",
    "ALTER TABLE chat_history ADD COLUMN input_tokens INTEGER DEFAULT 0",
    "ALTER TABLE chat_history ADD COLUMN output_tokens INTEGER DEFAULT 0",
    "ALTER TABLE chat_history ADD COLUMN response_time_ms INTEGER DEFAULT 0",
    "ALTER TABLE chat_history ADD COLUMN total_latency_ms INTEGER DEFAULT 0",
    "ALTER TABLE chat_history ADD COLUMN api_error TEXT DEFAULT NULL",
  ];

  for (const sql of columns) {
    try {
      db.exec(sql);
    } catch (e) {
      if (!e.message.includes('duplicate column')) throw e;
    }
  }
}

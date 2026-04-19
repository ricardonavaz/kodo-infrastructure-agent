export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS approval_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      connection_id INTEGER,
      rules TEXT DEFAULT '[]',
      enabled INTEGER DEFAULT 1,
      is_builtin INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS approval_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER,
      session_id TEXT,
      connection_id INTEGER,
      command TEXT,
      decision TEXT,
      risk_level TEXT,
      reason TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (profile_id) REFERENCES approval_profiles(id) ON DELETE SET NULL
    );
  `);

  // Built-in profiles
  const profiles = [
    {
      name: 'Solo lectura',
      description: 'Aprueba automaticamente comandos de consulta que no modifican el sistema',
      rules: JSON.stringify([
        { pattern: '^(ls|cat|head|tail|grep|find|which|whoami|hostname|uname|uptime|date|df|du|free|top|ps|ss|netstat|ip|ifconfig|lsblk|lscpu|lsof|file|stat|wc|id|groups|env|printenv|systemctl\\s+status|service\\s+.*\\s+status)\\b', risk_level: 'low', auto_approve: true },
      ]),
    },
    {
      name: 'Monitoreo',
      description: 'Aprueba comandos de monitoreo y diagnostico sin riesgo',
      rules: JSON.stringify([
        { pattern: '^(ls|cat|head|tail|grep|find|which|whoami|hostname|uname|uptime|date|df|du|free|top|ps|ss|netstat|ip|ifconfig|lsblk|lscpu|lsof|file|stat|wc|id|groups|env|printenv|systemctl\\s+status|service\\s+.*\\s+status|journalctl|dmesg|vmstat|iostat|sar|mpstat|pidstat|nslookup|dig|traceroute|ping|curl\\s+-s|wget\\s+-q)\\b', risk_level: 'low', auto_approve: true },
      ]),
    },
    {
      name: 'Mantenimiento basico',
      description: 'Aprueba operaciones comunes de mantenimiento (update cache, log rotation)',
      rules: JSON.stringify([
        { pattern: '^(ls|cat|head|tail|grep|find|df|du|free|top|ps|ss|netstat|uname|uptime|systemctl\\s+status)\\b', risk_level: 'low', auto_approve: true },
        { pattern: '^sudo\\s+(apt\\s+update|apt\\s+list|yum\\s+check-update|dnf\\s+check-update|logrotate|journalctl\\s+--vacuum)\\b', risk_level: 'medium', auto_approve: true },
      ]),
    },
  ];

  const stmt = db.prepare(
    'INSERT INTO approval_profiles (name, description, rules, is_builtin) VALUES (?, ?, ?, 1)'
  );
  for (const p of profiles) {
    stmt.run(p.name, p.description, p.rules);
  }
}

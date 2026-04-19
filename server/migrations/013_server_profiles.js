export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS server_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      connection_id INTEGER NOT NULL UNIQUE,
      os_family TEXT,
      os_version TEXT,
      distro TEXT,
      kernel_version TEXT,
      arch TEXT,
      cpu_info TEXT,
      total_memory_mb INTEGER,
      total_disk_mb INTEGER,
      disk_layout TEXT DEFAULT '[]',
      package_manager TEXT,
      init_system TEXT,
      installed_services TEXT DEFAULT '[]',
      installed_packages TEXT DEFAULT '[]',
      open_ports TEXT DEFAULT '[]',
      role TEXT DEFAULT '',
      responsible TEXT DEFAULT '',
      sla_level TEXT DEFAULT '',
      custom_notes TEXT DEFAULT '',
      custom_tags TEXT DEFAULT '[]',
      maintenance_window TEXT DEFAULT '',
      last_profiled_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
    );
  `);
}

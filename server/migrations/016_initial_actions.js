export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS initial_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      connection_id INTEGER,
      os_family TEXT,
      label TEXT NOT NULL,
      prompt TEXT NOT NULL,
      icon TEXT DEFAULT '🔧',
      category TEXT DEFAULT 'general',
      sort_order INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
    );
  `);

  // Default actions (connection_id NULL = available for all)
  const actions = [
    { label: 'Health Check', prompt: 'Haz un health check completo del servidor: CPU, RAM, disco, uptime, servicios y carga', icon: '📊', category: 'monitoring', sort: 1 },
    { label: 'Actualizaciones', prompt: 'Revisa si hay actualizaciones pendientes en el sistema y clasifícalas por prioridad', icon: '🔄', category: 'maintenance', sort: 2 },
    { label: 'Espacio en Disco', prompt: 'Muestra el uso de disco detallado por partición y los 10 directorios más grandes', icon: '💾', category: 'monitoring', sort: 3 },
    { label: 'Servicios Activos', prompt: 'Lista todos los servicios activos y verifica si hay alguno fallido o en estado de error', icon: '⚙️', category: 'monitoring', sort: 4 },
    { label: 'Logs Recientes', prompt: 'Muestra los últimos errores y advertencias del sistema de los logs recientes', icon: '📋', category: 'diagnostic', sort: 5 },
    { label: 'Info del Sistema', prompt: 'Recopila información completa del sistema: OS, kernel, CPU, RAM, disco, red, hostname', icon: '🖥️', category: 'monitoring', sort: 6 },
    { label: 'Seguridad', prompt: 'Revisa la seguridad básica: usuarios con shell, últimos accesos, puertos abiertos, firewall', icon: '🛡️', category: 'security', sort: 7 },
    { label: 'Conectividad', prompt: 'Verifica la conectividad de red: DNS, ping externo, interfaces, tabla de rutas', icon: '📡', category: 'diagnostic', sort: 8 },
  ];

  const stmt = db.prepare(
    'INSERT INTO initial_actions (label, prompt, icon, category, sort_order) VALUES (?, ?, ?, ?, ?)'
  );
  for (const a of actions) {
    stmt.run(a.label, a.prompt, a.icon, a.category, a.sort);
  }
}

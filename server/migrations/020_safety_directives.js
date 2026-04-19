export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS safety_directives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      rule_type TEXT DEFAULT 'block_command',
      os_scope TEXT DEFAULT 'all',
      detection_pattern TEXT DEFAULT '',
      severity TEXT DEFAULT 'critical',
      is_builtin INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      source TEXT DEFAULT 'manual',
      suggested_by_ai INTEGER DEFAULT 0,
      ai_reasoning TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Built-in fundamental directives
  const builtins = [
    {
      title: 'No cerrar puerto SSH (22) en Linux',
      description: 'Cerrar el puerto 22 en un servidor Linux provoca perdida total de acceso remoto. El servidor queda completamente aislado sin posibilidad de reconexion.',
      rule_type: 'block_command',
      os_scope: 'linux',
      detection_pattern: 'ufw\\s+(deny|reject|delete\\s+allow)\\s+.*\\b22\\b|iptables.*DROP.*--dport\\s+22|iptables.*-D.*--dport\\s+22|firewall-cmd.*--remove.*ssh|firewall-cmd.*--remove.*22|nft.*drop.*dport\\s+22|systemctl\\s+(stop|disable)\\s+ssh|service\\s+ssh\\s+stop|systemctl\\s+(stop|disable)\\s+sshd|service\\s+sshd\\s+stop',
      severity: 'critical',
    },
    {
      title: 'No cerrar puerto RDP (3389) en Windows',
      description: 'Cerrar el puerto 3389 en un servidor Windows provoca perdida del acceso remoto por Escritorio Remoto. El servidor queda inaccesible si no hay otro metodo de acceso configurado.',
      rule_type: 'block_command',
      os_scope: 'windows',
      detection_pattern: 'Disable-NetFirewallRule.*RemoteDesktop|Remove-NetFirewallRule.*3389|Set-ItemProperty.*fDenyTSConnections.*1|netsh.*delete.*3389|Stop-Service.*TermService|Disable-NetAdapter',
      severity: 'critical',
    },
    {
      title: 'No cerrar puerto OpenSSH (22) en Windows',
      description: 'Si el servidor Windows usa OpenSSH para administracion remota, cerrar el puerto 22 o detener el servicio sshd provoca perdida de la conexion activa de Kodo.',
      rule_type: 'block_command',
      os_scope: 'windows',
      detection_pattern: 'Stop-Service.*sshd|Remove-NetFirewallRule.*22|netsh.*delete.*22|Set-Service.*sshd.*Disabled',
      severity: 'critical',
    },
    {
      title: 'No eliminar el usuario actual de conexion',
      description: 'Eliminar o deshabilitar el usuario con el que Kodo esta conectado provoca desconexion inmediata y posible bloqueo del acceso.',
      rule_type: 'block_command',
      os_scope: 'all',
      detection_pattern: 'userdel|deluser|Remove-LocalUser|Disable-LocalUser|passwd\\s+-l|usermod\\s+-L',
      severity: 'critical',
    },
    {
      title: 'No reiniciar sin confirmacion explicita',
      description: 'Un reinicio no planificado puede interrumpir servicios criticos y sesiones activas. Siempre confirmar con el operador antes de ejecutar.',
      rule_type: 'warn_before',
      os_scope: 'all',
      detection_pattern: 'reboot|shutdown|init\\s+[06]|poweroff|Restart-Computer|Stop-Computer',
      severity: 'high',
    },
    {
      title: 'No formatear discos o particiones',
      description: 'Formatear un disco destruye todos los datos de forma irreversible. Esta accion debe estar absolutamente prohibida en automatizacion.',
      rule_type: 'block_command',
      os_scope: 'all',
      detection_pattern: 'mkfs|format\\s+[a-zA-Z]:|Clear-Disk|Initialize-Disk.*-RemoveData|fdisk.*-w|wipefs',
      severity: 'critical',
    },
  ];

  const stmt = db.prepare(
    `INSERT INTO safety_directives (title, description, rule_type, os_scope, detection_pattern, severity, is_builtin, source)
     VALUES (?, ?, ?, ?, ?, ?, 1, 'builtin')`
  );

  for (const d of builtins) {
    stmt.run(d.title, d.description, d.rule_type, d.os_scope, d.detection_pattern, d.severity);
  }
}

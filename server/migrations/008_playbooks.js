export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS playbooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      objective TEXT DEFAULT '',
      compatible_systems TEXT DEFAULT '["linux"]',
      preconditions TEXT DEFAULT '[]',
      required_variables TEXT DEFAULT '[]',
      command_sequence TEXT NOT NULL DEFAULT '[]',
      pre_validations TEXT DEFAULT '[]',
      success_criteria TEXT DEFAULT '[]',
      rollback_commands TEXT DEFAULT '[]',
      error_handling TEXT DEFAULT '{}',
      required_permissions TEXT DEFAULT '[]',
      is_builtin INTEGER DEFAULT 0,
      category TEXT DEFAULT 'custom',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS playbook_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playbook_id INTEGER NOT NULL,
      connection_id INTEGER NOT NULL,
      started_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      status TEXT DEFAULT 'running',
      variables_used TEXT DEFAULT '{}',
      step_results TEXT DEFAULT '[]',
      error TEXT,
      FOREIGN KEY (playbook_id) REFERENCES playbooks(id) ON DELETE CASCADE,
      FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
    );
  `);

  // Built-in playbooks
  const builtins = [
    {
      name: 'Health Check General',
      description: 'Revision completa del estado del servidor',
      objective: 'Verificar salud general: CPU, RAM, disco, uptime, servicios',
      compatible_systems: '["linux"]',
      category: 'monitoring',
      command_sequence: JSON.stringify([
        { name: 'Uptime', command: 'uptime' },
        { name: 'Uso de CPU', command: "top -bn1 | head -5" },
        { name: 'Uso de memoria', command: 'free -h' },
        { name: 'Uso de disco', command: 'df -h' },
        { name: 'Carga del sistema', command: 'cat /proc/loadavg' },
        { name: 'Servicios fallidos', command: 'systemctl --failed --no-pager 2>/dev/null || echo "systemctl no disponible"' },
      ]),
    },
    {
      name: 'Verificar Actualizaciones',
      description: 'Consultar paquetes pendientes de actualizar',
      objective: 'Listar actualizaciones disponibles sin aplicarlas',
      compatible_systems: '["linux"]',
      category: 'maintenance',
      command_sequence: JSON.stringify([
        { name: 'Detectar gestor', command: 'which apt 2>/dev/null && echo "APT" || (which yum 2>/dev/null && echo "YUM" || (which dnf 2>/dev/null && echo "DNF" || echo "UNKNOWN"))' },
        { name: 'Actualizar cache', command: 'sudo apt update 2>/dev/null || sudo yum makecache 2>/dev/null || sudo dnf makecache 2>/dev/null' },
        { name: 'Listar pendientes', command: 'apt list --upgradable 2>/dev/null || yum check-update 2>/dev/null || dnf check-update 2>/dev/null' },
      ]),
    },
    {
      name: 'Aplicar Actualizaciones',
      description: 'Instalar todas las actualizaciones pendientes',
      objective: 'Aplicar parches y actualizaciones de seguridad',
      compatible_systems: '["linux"]',
      category: 'maintenance',
      command_sequence: JSON.stringify([
        { name: 'Aplicar updates', command: 'sudo apt upgrade -y 2>/dev/null || sudo yum update -y 2>/dev/null || sudo dnf upgrade -y 2>/dev/null' },
        { name: 'Verificar reinicio', command: 'test -f /var/run/reboot-required && echo "REINICIO REQUERIDO" || echo "No requiere reinicio"' },
      ]),
    },
    {
      name: 'Limpieza de Logs',
      description: 'Limpiar archivos de log antiguos',
      objective: 'Liberar espacio eliminando logs mayores a 7 dias',
      compatible_systems: '["linux"]',
      category: 'maintenance',
      command_sequence: JSON.stringify([
        { name: 'Espacio antes', command: 'du -sh /var/log/ 2>/dev/null' },
        { name: 'Rotar logs', command: 'sudo logrotate -f /etc/logrotate.conf 2>/dev/null || echo "logrotate no disponible"' },
        { name: 'Limpiar journal', command: 'sudo journalctl --vacuum-time=7d 2>/dev/null || echo "journalctl no disponible"' },
        { name: 'Espacio despues', command: 'du -sh /var/log/ 2>/dev/null' },
      ]),
    },
    {
      name: 'Diagnostico de Consumo',
      description: 'Identificar procesos con mayor consumo de recursos',
      objective: 'Encontrar que esta consumiendo CPU, RAM y disco',
      compatible_systems: '["linux"]',
      category: 'diagnostic',
      command_sequence: JSON.stringify([
        { name: 'Top CPU', command: 'ps aux --sort=-%cpu | head -10' },
        { name: 'Top Memoria', command: 'ps aux --sort=-%mem | head -10' },
        { name: 'Top Disco', command: 'du -h --max-depth=1 / 2>/dev/null | sort -rh | head -10' },
        { name: 'IO activo', command: 'iostat -x 1 2 2>/dev/null || echo "iostat no disponible"' },
      ]),
    },
    {
      name: 'Revision de Seguridad Basica',
      description: 'Verificaciones basicas de seguridad del servidor',
      objective: 'Revisar usuarios, puertos, firewall y accesos recientes',
      compatible_systems: '["linux"]',
      category: 'security',
      command_sequence: JSON.stringify([
        { name: 'Usuarios con shell', command: 'grep -v nologin /etc/passwd | grep -v /bin/false' },
        { name: 'Ultimos accesos', command: 'last -10' },
        { name: 'Puertos abiertos', command: 'ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null' },
        { name: 'Estado firewall', command: 'sudo ufw status 2>/dev/null || sudo iptables -L -n 2>/dev/null | head -20' },
        { name: 'Intentos fallidos SSH', command: 'grep "Failed password" /var/log/auth.log 2>/dev/null | tail -5 || echo "Log no disponible"' },
      ]),
    },
    {
      name: 'Validar Conectividad',
      description: 'Verificar conectividad de red y DNS',
      objective: 'Comprobar que el servidor puede comunicarse correctamente',
      compatible_systems: '["linux"]',
      category: 'diagnostic',
      command_sequence: JSON.stringify([
        { name: 'DNS', command: 'nslookup google.com 2>/dev/null || dig google.com +short 2>/dev/null' },
        { name: 'Ping externo', command: 'ping -c 3 8.8.8.8' },
        { name: 'Interfaces', command: 'ip addr show 2>/dev/null || ifconfig 2>/dev/null' },
        { name: 'Tabla de rutas', command: 'ip route 2>/dev/null || route -n 2>/dev/null' },
      ]),
    },
    {
      name: 'Recolectar Info Sistema',
      description: 'Recopilar version de sistema, kernel y paquetes clave',
      objective: 'Inventariar la configuracion del servidor',
      compatible_systems: '["linux"]',
      category: 'monitoring',
      command_sequence: JSON.stringify([
        { name: 'OS', command: 'cat /etc/os-release 2>/dev/null || uname -a' },
        { name: 'Kernel', command: 'uname -r' },
        { name: 'Hostname', command: 'hostname -f 2>/dev/null || hostname' },
        { name: 'CPU', command: 'lscpu | grep "Model name" 2>/dev/null || cat /proc/cpuinfo | grep "model name" | head -1' },
        { name: 'RAM total', command: "free -h | grep Mem | awk '{print $2}'" },
        { name: 'Disco total', command: 'lsblk -d -o NAME,SIZE 2>/dev/null || fdisk -l 2>/dev/null | grep "Disk /"' },
      ]),
    },
  ];

  const stmt = db.prepare(
    `INSERT INTO playbooks (name, description, objective, compatible_systems, command_sequence, is_builtin, category)
     VALUES (?, ?, ?, ?, ?, 1, ?)`
  );

  for (const pb of builtins) {
    stmt.run(pb.name, pb.description, pb.objective, pb.compatible_systems, pb.command_sequence, pb.category);
  }
}

import db from '../db.js';
import { executeCommand } from './ssh.js';

// ======================== LINUX COMMANDS ========================
const LINUX_COMMANDS = {
  os_release: "cat /etc/os-release 2>/dev/null || echo 'unknown'",
  arch: "uname -m 2>/dev/null",
  kernel: "uname -r 2>/dev/null",
  hostname_fqdn: "hostname -f 2>/dev/null || hostname",
  cpu: "nproc 2>/dev/null && grep 'model name' /proc/cpuinfo 2>/dev/null | head -1 | cut -d: -f2 | xargs",
  memory: "free -m 2>/dev/null | grep Mem | awk '{print $2}'",
  disk: "df -m / 2>/dev/null | tail -1 | awk '{print $2}'",
  disk_layout: "df -h 2>/dev/null | grep -v tmpfs | grep -v udev",
  package_manager: "which apt 2>/dev/null && echo apt || (which dnf 2>/dev/null && echo dnf || (which yum 2>/dev/null && echo yum || (which pacman 2>/dev/null && echo pacman || (which zypper 2>/dev/null && echo zypper || echo unknown))))",
  init_system: "pidof systemd >/dev/null 2>&1 && echo systemd || echo sysvinit",
  services: "systemctl list-units --type=service --state=running --no-pager --no-legend 2>/dev/null | awk '{print $1}' | sed 's/.service//' | head -40 || echo ''",
  ports: "ss -tlnp 2>/dev/null | tail -n +2 | awk '{print $4\":\"$6}' | head -20 || echo ''",
  uptime: "uptime -p 2>/dev/null || uptime",
  timezone: "timedatectl show --property=Timezone --value 2>/dev/null || cat /etc/timezone 2>/dev/null || echo 'unknown'",
  users_with_shell: "grep -v nologin /etc/passwd 2>/dev/null | grep -v /bin/false | cut -d: -f1 | head -20",
  virtualization: "systemd-detect-virt 2>/dev/null || echo 'unknown'",
  packages_count: "dpkg -l 2>/dev/null | grep '^ii' | wc -l || rpm -qa 2>/dev/null | wc -l || pacman -Q 2>/dev/null | wc -l || echo 0",
  top_packages: "dpkg -l 2>/dev/null | grep '^ii' | awk '{print $2}' | head -50 || rpm -qa --qf '%{NAME}\\n' 2>/dev/null | head -50 || pacman -Q 2>/dev/null | awk '{print $1}' | head -50 || echo ''",
  bash_version: "bash --version 2>/dev/null | head -1 | sed -n 's/.*version \\([0-9.]*\\).*/\\1/p' || echo 'unknown'",
};

// ======================== WINDOWS COMMANDS (PowerShell) ========================
const WINDOWS_COMMANDS = {
  os_release: "(Get-CimInstance Win32_OperatingSystem).Caption + '|' + (Get-CimInstance Win32_OperatingSystem).Version + '|' + (Get-CimInstance Win32_OperatingSystem).BuildNumber",
  arch: "(Get-CimInstance Win32_OperatingSystem).OSArchitecture",
  kernel: "[System.Environment]::OSVersion.Version.ToString()",
  hostname_fqdn: "[System.Net.Dns]::GetHostEntry($env:COMPUTERNAME).HostName",
  cpu: "(Get-CimInstance Win32_Processor | Select-Object -First 1).Name + '|' + (Get-CimInstance Win32_Processor | Measure-Object -Property NumberOfLogicalProcessors -Sum).Sum",
  memory: "[math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1MB)",
  disk: "Get-CimInstance Win32_LogicalDisk -Filter \"DriveType=3\" | ForEach-Object { $_.DeviceID + ' ' + [math]::Round($_.Size/1GB) + 'GB total ' + [math]::Round($_.FreeSpace/1GB) + 'GB free' }",
  disk_layout: "Get-CimInstance Win32_LogicalDisk -Filter \"DriveType=3\" | Format-Table DeviceID, @{N='SizeGB';E={[math]::Round($_.Size/1GB)}}, @{N='FreeGB';E={[math]::Round($_.FreeSpace/1GB)}} -AutoSize | Out-String",
  package_manager: "$PSVersionTable.PSVersion.ToString() + '|powershell'",
  init_system: "if (Get-Service | Where-Object {$_.Name -eq 'wuauserv'}) {'windows_services'} else {'unknown'}",
  services: "Get-Service | Where-Object {$_.Status -eq 'Running'} | Select-Object -First 40 -ExpandProperty Name",
  ports: "Get-NetTCPConnection -State Listen 2>$null | Select-Object -First 20 LocalPort,OwningProcess | ForEach-Object { $_.LocalPort.ToString() + ':' + (Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).ProcessName }",
  uptime: "$os = Get-CimInstance Win32_OperatingSystem; $uptime = (Get-Date) - $os.LastBootUpTime; '{0} days {1} hours' -f $uptime.Days, $uptime.Hours",
  timezone: "(Get-TimeZone).Id",
  users_with_shell: "Get-LocalUser | Where-Object {$_.Enabled -eq $true} | Select-Object -ExpandProperty Name",
  virtualization: "(Get-CimInstance Win32_ComputerSystem).Model",
  packages_count: "(Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* 2>$null | Measure-Object).Count",
  top_packages: "Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* 2>$null | Where-Object {$_.DisplayName} | Select-Object -First 50 -ExpandProperty DisplayName",
  powershell_version: "$PSVersionTable.PSVersion.ToString()",
  dotnet_version: "(Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\NET Framework Setup\\NDP\\v4\\Full' -ErrorAction SilentlyContinue).Release",
  windows_features: "Get-WindowsFeature 2>$null | Where-Object {$_.Installed -eq $true} | Select-Object -First 30 -ExpandProperty Name",
  iis_status: "Get-Service W3SVC -ErrorAction SilentlyContinue | Select-Object Status,Name | Format-List | Out-String",
  sql_server: "Get-Service | Where-Object {$_.Name -like 'MSSQL*'} | Select-Object Name,Status | Format-List | Out-String",
  windows_update: "(New-Object -ComObject Microsoft.Update.AutoUpdate).Results | Select-Object LastInstallationSuccessDate | Format-List | Out-String",
  firewall_status: "Get-NetFirewallProfile | Select-Object Name,Enabled | Format-Table -AutoSize | Out-String",
  rdp_status: "(Get-ItemProperty 'HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server').fDenyTSConnections",
};

function parseLinuxOs(output) {
  const result = { os_family: 'unknown', os_version: '', distro: '' };
  const lower = output.toLowerCase();

  if (lower.includes('ubuntu')) { result.os_family = 'debian'; result.distro = 'ubuntu'; }
  else if (lower.includes('debian')) { result.os_family = 'debian'; result.distro = 'debian'; }
  else if (lower.includes('centos')) { result.os_family = 'rhel'; result.distro = 'centos'; }
  else if (lower.includes('red hat') || lower.includes('rhel')) { result.os_family = 'rhel'; result.distro = 'rhel'; }
  else if (lower.includes('fedora')) { result.os_family = 'fedora'; result.distro = 'fedora'; }
  else if (lower.includes('suse') || lower.includes('sles')) { result.os_family = 'suse'; result.distro = 'suse'; }
  else if (lower.includes('amazon')) { result.os_family = 'rhel'; result.distro = 'amazon-linux'; }
  else if (lower.includes('rocky')) { result.os_family = 'rhel'; result.distro = 'rocky'; }
  else if (lower.includes('alma')) { result.os_family = 'rhel'; result.distro = 'almalinux'; }
  else if (lower.includes('oracle') && lower.includes('linux')) { result.os_family = 'rhel'; result.distro = 'oracle-linux'; }
  else if (lower.includes('alpine')) { result.os_family = 'alpine'; result.distro = 'alpine'; }
  else if (lower.includes('kali')) { result.os_family = 'debian'; result.distro = 'kali'; }
  else if (lower.includes('mint')) { result.os_family = 'debian'; result.distro = 'linux-mint'; }
  else if (lower.includes('raspbian') || lower.includes('raspberry')) { result.os_family = 'debian'; result.distro = 'raspbian'; }
  else if (lower.includes('arch')) { result.os_family = 'arch'; result.distro = 'arch'; }

  const prettyMatch = output.match(/PRETTY_NAME="?([^"\n]+)"?/i);
  if (prettyMatch) result.os_version = prettyMatch[1];
  else {
    const versionMatch = output.match(/VERSION_ID="?([^"\n]+)"?/i);
    if (versionMatch) result.os_version = versionMatch[1];
  }
  return result;
}

function parseWindowsOs(output) {
  const parts = output.split('|');
  const caption = (parts[0] || '').trim();
  const version = (parts[1] || '').trim();
  const build = (parts[2] || '').trim();

  let distro = 'windows';
  if (caption.includes('2025')) distro = 'windows-server-2025';
  else if (caption.includes('2022')) distro = 'windows-server-2022';
  else if (caption.includes('2019')) distro = 'windows-server-2019';
  else if (caption.includes('2016')) distro = 'windows-server-2016';
  else if (caption.includes('2012 R2')) distro = 'windows-server-2012r2';
  else if (caption.includes('2012')) distro = 'windows-server-2012';
  else if (caption.includes('2008 R2')) distro = 'windows-server-2008r2';
  else if (caption.includes('2008')) distro = 'windows-server-2008';
  else if (caption.includes('Server')) distro = 'windows-server';
  else if (caption.includes('11')) distro = 'windows-11';
  else if (caption.includes('10')) distro = 'windows-10';

  return {
    os_family: 'windows',
    os_version: caption || `Windows ${version}`,
    distro,
    build,
  };
}

async function runCmd(connectionInfo, cmd, timeout = 10000) {
  try {
    const r = await executeCommand(connectionInfo, cmd, timeout);
    return r.stdout?.trim() || '';
  } catch { return ''; }
}

export async function profileServer(connectionInfo) {
  // Auto-detect OS type if possible
  let isWindows = connectionInfo.os_type === 'windows';
  try {
    const detectResult = await runCmd(connectionInfo, 'uname -s', 5000);
    if (detectResult && !detectResult.toLowerCase().includes('not recognized') && !detectResult.toLowerCase().includes('is not')) {
      // uname responded — this is Linux/Unix
      isWindows = false;
    } else {
      // uname failed, try PowerShell detection
      const psResult = await runCmd(connectionInfo, '$PSVersionTable.PSVersion.Major', 5000);
      if (psResult && /^\d+$/.test(psResult.trim())) {
        isWindows = true;
      }
    }
  } catch { /* keep original os_type */ }

  const commands = isWindows ? WINDOWS_COMMANDS : LINUX_COMMANDS;
  const results = {};
  // Windows CIM/WMI commands are slow — use 20s timeout, Linux 10s
  const cmdTimeout = isWindows ? 20000 : 10000;

  for (const [key, cmd] of Object.entries(commands)) {
    results[key] = await runCmd(connectionInfo, cmd, cmdTimeout);
  }

  let profile;

  if (isWindows) {
    const os = parseWindowsOs(results.os_release);
    const cpuParts = (results.cpu || '').split('|');
    const services = results.services.split('\n').filter(Boolean);
    const ports = results.ports.split('\n').filter(Boolean);
    const users = results.users_with_shell.split('\n').filter(Boolean);
    const topPkgs = results.top_packages.split('\n').filter(Boolean);
    const psVersion = results.powershell_version || results.package_manager?.split('|')[0] || '';

    profile = {
      connection_id: connectionInfo.id,
      os_family: 'windows',
      os_version: os.os_version,
      distro: os.distro,
      kernel_version: results.kernel || os.build || '',
      arch: results.arch || '',
      cpu_info: `${cpuParts[1] || '?'} CPU ${cpuParts[0] || ''}`.trim(),
      total_memory_mb: parseInt(results.memory) || 0,
      total_disk_mb: 0, // parsed below
      disk_layout: results.disk_layout || results.disk || '',
      package_manager: `powershell ${psVersion}`,
      init_system: 'windows_services',
      shell_version: psVersion,
      installed_services: JSON.stringify(services),
      installed_packages: JSON.stringify(topPkgs),
      open_ports: JSON.stringify(ports),
      last_profiled_at: new Date().toISOString(),
      _hostname: results.hostname_fqdn,
      _uptime: results.uptime,
      _timezone: results.timezone,
      _virtualization: results.virtualization,
      _users: users,
      _packages_count: parseInt(results.packages_count) || topPkgs.length,
      // Windows-specific extras
      _powershell_version: psVersion,
      _windows_features: results.windows_features || '',
      _iis_status: results.iis_status || '',
      _sql_server: results.sql_server || '',
      _firewall_status: results.firewall_status || '',
      _rdp_status: results.rdp_status,
    };

    // Parse disk total from disk output
    const diskMatch = (results.disk || '').match(/(\d+)GB total/);
    if (diskMatch) profile.total_disk_mb = parseInt(diskMatch[1]) * 1024;

  } else {
    // Linux profiling (existing logic)
    const os = parseLinuxOs(results.os_release);
    const cpuParts = (results.cpu || '').split('\n');
    const services = results.services.split('\n').filter(Boolean);
    const ports = results.ports.split('\n').filter(Boolean);
    const users = results.users_with_shell.split('\n').filter(Boolean);
    const topPkgs = results.top_packages.split('\n').filter(Boolean);

    profile = {
      connection_id: connectionInfo.id,
      os_family: os.os_family,
      os_version: os.os_version,
      distro: os.distro,
      kernel_version: results.kernel,
      arch: results.arch,
      cpu_info: `${cpuParts[0] || '?'} CPU ${cpuParts[1] || ''}`.trim(),
      total_memory_mb: parseInt(results.memory) || 0,
      total_disk_mb: parseInt(results.disk) || 0,
      disk_layout: results.disk_layout || '',
      package_manager: results.package_manager.split('\n').pop()?.trim() || 'unknown',
      init_system: results.init_system,
      shell_version: results.bash_version || '',
      installed_services: JSON.stringify(services),
      installed_packages: JSON.stringify(topPkgs),
      open_ports: JSON.stringify(ports),
      last_profiled_at: new Date().toISOString(),
      _hostname: results.hostname_fqdn,
      _uptime: results.uptime,
      _timezone: results.timezone,
      _virtualization: results.virtualization,
      _users: users,
      _packages_count: parseInt(results.packages_count) || 0,
    };
  }

  // Upsert
  const existing = db.prepare('SELECT id FROM server_profiles WHERE connection_id = ?').get(connectionInfo.id);
  if (existing) {
    db.prepare(`
      UPDATE server_profiles SET
        os_family=?, os_version=?, distro=?, kernel_version=?, arch=?, cpu_info=?,
        total_memory_mb=?, total_disk_mb=?, disk_layout=?, package_manager=?, init_system=?,
        shell_version=?, installed_services=?, installed_packages=?, open_ports=?, last_profiled_at=?
      WHERE connection_id=?
    `).run(
      profile.os_family, profile.os_version, profile.distro, profile.kernel_version,
      profile.arch, profile.cpu_info, profile.total_memory_mb, profile.total_disk_mb,
      profile.disk_layout, profile.package_manager, profile.init_system,
      profile.shell_version || '', profile.installed_services, profile.installed_packages, profile.open_ports,
      profile.last_profiled_at, connectionInfo.id
    );
  } else {
    db.prepare(`
      INSERT INTO server_profiles (connection_id, os_family, os_version, distro, kernel_version, arch, cpu_info,
        total_memory_mb, total_disk_mb, disk_layout, package_manager, init_system,
        shell_version, installed_services, installed_packages, open_ports, last_profiled_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      connectionInfo.id, profile.os_family, profile.os_version, profile.distro,
      profile.kernel_version, profile.arch, profile.cpu_info, profile.total_memory_mb,
      profile.total_disk_mb, profile.disk_layout, profile.package_manager, profile.init_system,
      profile.shell_version || '', profile.installed_services, profile.installed_packages, profile.open_ports,
      profile.last_profiled_at
    );
  }

  const saved = db.prepare('SELECT * FROM server_profiles WHERE connection_id = ?').get(connectionInfo.id);
  // Attach runtime extras
  Object.keys(profile).filter((k) => k.startsWith('_')).forEach((k) => { saved[k] = profile[k]; });
  return saved;
}

export function getProfile(connectionId) {
  return db.prepare('SELECT * FROM server_profiles WHERE connection_id = ?').get(connectionId);
}

export function generateBriefing(profile, connName) {
  if (!profile) return null;

  const services = JSON.parse(profile.installed_services || '[]');
  const ports = JSON.parse(profile.open_ports || '[]');
  const pkgs = JSON.parse(profile.installed_packages || '[]');
  const isWindows = profile.os_family === 'windows';

  let briefing = `## 🖥️ Briefing del Servidor: ${connName}\n\n`;
  briefing += `### Sistema Operativo\n`;
  briefing += `- **OS:** ${profile.os_version || profile.distro || profile.os_family}\n`;
  briefing += isWindows ? `- **Build:** ${profile.kernel_version || 'N/A'}\n` : `- **Kernel:** ${profile.kernel_version || 'N/A'}\n`;
  briefing += `- **Arquitectura:** ${profile.arch || 'N/A'}\n`;
  briefing += `- **Hostname:** ${profile._hostname || 'N/A'}\n`;

  if (isWindows) {
    briefing += `- **Shell:** ${profile.package_manager || 'PowerShell'}\n`;
    if (profile._rdp_status !== undefined) briefing += `- **RDP:** ${profile._rdp_status === '0' ? '✅ Habilitado' : '❌ Deshabilitado'}\n`;
    if (profile._firewall_status) briefing += `- **Firewall:**\n\`\`\`\n${profile._firewall_status}\n\`\`\`\n`;
  } else {
    briefing += `- **Virtualizacion:** ${profile._virtualization || 'N/A'}\n`;
    briefing += `- **Timezone:** ${profile._timezone || 'N/A'}\n`;
  }

  briefing += `\n### Hardware\n`;
  briefing += `- **CPU:** ${profile.cpu_info || 'N/A'}\n`;
  briefing += `- **RAM Total:** ${profile.total_memory_mb ? profile.total_memory_mb + ' MB' : 'N/A'}\n`;
  briefing += `- **Disco Total:** ${profile.total_disk_mb ? Math.round(profile.total_disk_mb / 1024) + ' GB' : 'N/A'}\n`;
  if (profile.disk_layout) briefing += `\n\`\`\`\n${profile.disk_layout}\n\`\`\`\n`;

  briefing += `\n### Software\n`;
  briefing += `- **${isWindows ? 'Shell' : 'Package Manager'}:** ${profile.package_manager || 'N/A'}\n`;
  briefing += `- **Init System:** ${profile.init_system || 'N/A'}\n`;
  briefing += `- **Programas/Paquetes:** ${profile._packages_count || pkgs.length || 'N/A'}\n`;
  if (profile.role) briefing += `- **Rol:** ${profile.role}\n`;

  if (isWindows) {
    if (profile._iis_status?.trim()) briefing += `\n### IIS\n\`\`\`\n${profile._iis_status}\n\`\`\`\n`;
    if (profile._sql_server?.trim()) briefing += `\n### SQL Server\n\`\`\`\n${profile._sql_server}\n\`\`\`\n`;
    if (profile._windows_features) briefing += `\n### Windows Features Instaladas\n${profile._windows_features.split('\n').filter(Boolean).slice(0, 15).map((f) => `- ${f}`).join('\n')}\n`;
  }

  briefing += `\n### Servicios Activos (${services.length})\n`;
  briefing += services.length > 0 ? services.slice(0, 15).map((s) => `- ${s}`).join('\n') + (services.length > 15 ? `\n- ...y ${services.length - 15} mas` : '') : '- Sin datos';

  briefing += `\n\n### Puertos Abiertos (${ports.length})\n`;
  briefing += ports.length > 0 ? ports.slice(0, 10).map((p) => `- ${p}`).join('\n') + (ports.length > 10 ? `\n- ...y ${ports.length - 10} mas` : '') : '- Sin datos';

  briefing += `\n\n### Usuarios Activos\n`;
  briefing += profile._users?.length > 0 ? profile._users.map((u) => `- ${u}`).join('\n') : '- Sin datos';

  briefing += `\n\n---\n*Perfil generado automaticamente al ${new Date().toLocaleString()}*\n`;

  if (isWindows) {
    briefing += `\n[ACTION: Revisar actualizaciones de Windows pendientes]\n[ACTION: Verificar estado del firewall de Windows]\n[ACTION: Ejecutar audit de seguridad]`;
  } else {
    briefing += `\n[ACTION: Ejecutar health check completo]\n[ACTION: Revisar actualizaciones pendientes]\n[ACTION: Ejecutar audit de seguridad]`;
  }

  return briefing;
}

import db from '../db.js';
import { executeCommand } from './ssh.js';

const SECURITY_CHECKS = [
  {
    name: 'SSH Root Login',
    command: "grep -i '^PermitRootLogin' /etc/ssh/sshd_config 2>/dev/null || echo 'not found'",
    evaluate: (out) => {
      if (out.includes('no')) return { score: 10, status: 'ok', detail: 'Root login deshabilitado' };
      if (out.includes('yes')) return { score: 0, status: 'critical', detail: 'Root login HABILITADO - riesgo alto' };
      return { score: 5, status: 'warning', detail: `Config: ${out.trim()}` };
    },
  },
  {
    name: 'SSH Password Auth',
    command: "grep -i '^PasswordAuthentication' /etc/ssh/sshd_config 2>/dev/null || echo 'not found'",
    evaluate: (out) => {
      if (out.includes('no')) return { score: 10, status: 'ok', detail: 'Password auth deshabilitado - solo keys' };
      return { score: 5, status: 'warning', detail: 'Password auth habilitado - considerar solo keys' };
    },
  },
  {
    name: 'Firewall Status',
    command: "sudo ufw status 2>/dev/null | head -1 || sudo firewall-cmd --state 2>/dev/null || sudo iptables -L -n 2>/dev/null | wc -l",
    evaluate: (out) => {
      if (out.includes('active') || out.includes('running')) return { score: 10, status: 'ok', detail: 'Firewall activo' };
      return { score: 0, status: 'critical', detail: 'Firewall NO detectado o inactivo' };
    },
  },
  {
    name: 'Sudo Users',
    command: "grep -Po '^\\w+' /etc/sudoers 2>/dev/null; getent group sudo 2>/dev/null || getent group wheel 2>/dev/null",
    evaluate: (out) => {
      const users = out.split('\n').filter(Boolean).length;
      if (users <= 3) return { score: 8, status: 'ok', detail: `${users} usuarios con sudo - aceptable` };
      return { score: 4, status: 'warning', detail: `${users} usuarios con sudo - revisar si todos son necesarios` };
    },
  },
  {
    name: 'Failed SSH Attempts',
    command: "grep 'Failed password' /var/log/auth.log 2>/dev/null | wc -l || journalctl -u sshd --since '24 hours ago' 2>/dev/null | grep 'Failed' | wc -l",
    evaluate: (out) => {
      const count = parseInt(out.trim()) || 0;
      if (count < 10) return { score: 10, status: 'ok', detail: `${count} intentos fallidos en 24h` };
      if (count < 100) return { score: 5, status: 'warning', detail: `${count} intentos fallidos - considerar fail2ban` };
      return { score: 0, status: 'critical', detail: `${count} intentos fallidos - POSIBLE ATAQUE. Configurar fail2ban urgente.` };
    },
  },
  {
    name: 'Critical File Permissions',
    command: "stat -c '%a %n' /etc/passwd /etc/shadow /etc/ssh/sshd_config 2>/dev/null",
    evaluate: (out) => {
      const issues = [];
      for (const line of out.split('\n').filter(Boolean)) {
        const [perm, file] = line.split(' ');
        if (file?.includes('shadow') && perm !== '640' && perm !== '600') issues.push(`${file}: ${perm} (deberia ser 640)`);
        if (file?.includes('sshd_config') && perm !== '644' && perm !== '600') issues.push(`${file}: ${perm}`);
      }
      if (issues.length === 0) return { score: 10, status: 'ok', detail: 'Permisos de archivos criticos correctos' };
      return { score: 3, status: 'warning', detail: `Permisos a revisar: ${issues.join(', ')}` };
    },
  },
  {
    name: 'Open Ports',
    command: "ss -tlnp 2>/dev/null | tail -n +2 | wc -l",
    evaluate: (out) => {
      const count = parseInt(out.trim()) || 0;
      if (count <= 5) return { score: 10, status: 'ok', detail: `${count} puertos abiertos - minimo` };
      if (count <= 15) return { score: 7, status: 'ok', detail: `${count} puertos abiertos` };
      return { score: 3, status: 'warning', detail: `${count} puertos abiertos - revisar si todos son necesarios` };
    },
  },
  {
    name: 'Unattended Upgrades',
    command: "dpkg -l unattended-upgrades 2>/dev/null | grep '^ii' || echo 'not installed'",
    evaluate: (out) => {
      if (out.includes('ii')) return { score: 10, status: 'ok', detail: 'Actualizaciones automaticas configuradas' };
      return { score: 3, status: 'warning', detail: 'Sin actualizaciones automaticas - vulnerabilidades pueden acumularse' };
    },
  },
  {
    name: 'Pending Security Updates',
    command: "apt list --upgradable 2>/dev/null | grep -i security | wc -l || echo 0",
    evaluate: (out) => {
      const count = parseInt(out.trim()) || 0;
      if (count === 0) return { score: 10, status: 'ok', detail: 'Sin actualizaciones de seguridad pendientes' };
      if (count <= 5) return { score: 5, status: 'warning', detail: `${count} updates de seguridad pendientes` };
      return { score: 0, status: 'critical', detail: `${count} updates de seguridad pendientes - APLICAR URGENTE` };
    },
  },
  {
    name: 'SSL Certificates',
    command: "find /etc/ssl/certs /etc/letsencrypt -name '*.pem' -o -name '*.crt' 2>/dev/null | head -5 | while read f; do echo \"$f: $(openssl x509 -enddate -noout -in $f 2>/dev/null)\"; done || echo 'no certs found'",
    evaluate: (out) => {
      if (out.includes('no certs found')) return { score: 7, status: 'info', detail: 'Sin certificados SSL detectados' };
      return { score: 8, status: 'ok', detail: `Certificados encontrados: ${out.substring(0, 200)}` };
    },
  },
];

export async function runSecurityAudit(connectionInfo) {
  const results = [];
  let totalScore = 0;
  let maxScore = 0;

  for (const check of SECURITY_CHECKS) {
    try {
      const cmdResult = await executeCommand(connectionInfo, check.command, 10000);
      const evaluation = check.evaluate(cmdResult.stdout || '');
      results.push({ name: check.name, ...evaluation, command: check.command });
      totalScore += evaluation.score;
      maxScore += 10;
    } catch (err) {
      results.push({ name: check.name, score: 0, status: 'error', detail: `Error: ${err.message}`, command: check.command });
      maxScore += 10;
    }
  }

  const securityScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

  // Update profile
  db.prepare(
    `UPDATE server_profiles SET security_score = ?, last_security_scan = datetime('now') WHERE connection_id = ?`
  ).run(securityScore, connectionInfo.id);

  // Log event
  const criticalCount = results.filter((r) => r.status === 'critical').length;
  const warningCount = results.filter((r) => r.status === 'warning').length;

  db.prepare(
    `INSERT INTO server_events (connection_id, event_type, severity, title, details)
     VALUES (?, 'security_scan', ?, ?, ?)`
  ).run(
    connectionInfo.id,
    criticalCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : 'info',
    `Security Audit: Score ${securityScore}/100`,
    JSON.stringify({ score: securityScore, results: results.map((r) => ({ name: r.name, status: r.status, detail: r.detail })) })
  );

  return { securityScore, results, criticalCount, warningCount, okCount: results.filter((r) => r.status === 'ok').length };
}

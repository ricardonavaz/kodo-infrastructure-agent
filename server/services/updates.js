import { executeCommand } from './ssh.js';

export async function detectOsFamily(connectionInfo) {
  const result = await executeCommand(connectionInfo, 'cat /etc/os-release 2>/dev/null || uname -s');
  const output = result.stdout.toLowerCase();

  if (output.includes('ubuntu') || output.includes('debian')) {
    return { osFamily: 'debian', updateMechanism: 'apt' };
  }
  if (output.includes('centos') || output.includes('rhel') || output.includes('red hat')) {
    return { osFamily: 'rhel', updateMechanism: output.includes('dnf') ? 'dnf' : 'yum' };
  }
  if (output.includes('fedora')) {
    return { osFamily: 'fedora', updateMechanism: 'dnf' };
  }
  if (output.includes('suse') || output.includes('sles')) {
    return { osFamily: 'suse', updateMechanism: 'zypper' };
  }
  if (output.includes('arch')) {
    return { osFamily: 'arch', updateMechanism: 'pacman' };
  }
  if (connectionInfo.os_type === 'windows') {
    return { osFamily: 'windows', updateMechanism: 'windows_update' };
  }

  // Try to detect by available package manager
  const aptCheck = await executeCommand(connectionInfo, 'which apt 2>/dev/null');
  if (aptCheck.code === 0) return { osFamily: 'debian', updateMechanism: 'apt' };

  const dnfCheck = await executeCommand(connectionInfo, 'which dnf 2>/dev/null');
  if (dnfCheck.code === 0) return { osFamily: 'rhel', updateMechanism: 'dnf' };

  const yumCheck = await executeCommand(connectionInfo, 'which yum 2>/dev/null');
  if (yumCheck.code === 0) return { osFamily: 'rhel', updateMechanism: 'yum' };

  return { osFamily: 'unknown', updateMechanism: 'unknown' };
}

export async function queryPendingUpdates(connectionInfo, mechanism) {
  let result;
  const updates = [];

  switch (mechanism) {
    case 'apt':
      await executeCommand(connectionInfo, 'sudo apt update -qq 2>/dev/null');
      result = await executeCommand(connectionInfo, 'apt list --upgradable 2>/dev/null');
      for (const line of result.stdout.split('\n').slice(1)) {
        const match = line.match(/^(\S+)\/\S+\s+(\S+)\s+\S+\s+\[upgradable from: (\S+)\]/);
        if (match) {
          updates.push({
            name: match[1],
            newVersion: match[2],
            currentVersion: match[3],
            type: match[1].includes('security') ? 'security' : 'regular',
          });
        }
      }
      break;

    case 'yum':
    case 'dnf':
      result = await executeCommand(connectionInfo, `sudo ${mechanism} check-update -q 2>/dev/null`);
      for (const line of result.stdout.split('\n')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2 && parts[0] && !parts[0].startsWith('Last') && !parts[0].startsWith('Obsoleting')) {
          updates.push({
            name: parts[0],
            newVersion: parts[1],
            currentVersion: '',
            type: 'regular',
          });
        }
      }
      break;

    case 'pacman':
      result = await executeCommand(connectionInfo, 'pacman -Qu 2>/dev/null');
      for (const line of result.stdout.split('\n')) {
        const match = line.match(/^(\S+)\s+(\S+)\s+->\s+(\S+)/);
        if (match) {
          updates.push({ name: match[1], currentVersion: match[2], newVersion: match[3], type: 'regular' });
        }
      }
      break;

    default:
      break;
  }

  // Classify severity
  for (const u of updates) {
    u.severity = classifySeverity(u.name, u.type);
    u.requiresReboot = /kernel|linux-image|glibc|systemd/.test(u.name);
  }

  return updates;
}

function classifySeverity(name, type) {
  if (type === 'security' || /security|CVE/i.test(name)) return 'critical';
  if (/kernel|linux-image|glibc|openssl|openssh/.test(name)) return 'important';
  if (/lib|devel|headers/.test(name)) return 'moderate';
  return 'low';
}

export async function applyUpdates(connectionInfo, mechanism, updateNames = null) {
  let cmd;
  switch (mechanism) {
    case 'apt':
      cmd = updateNames
        ? `sudo apt install -y ${updateNames.join(' ')}`
        : 'sudo apt upgrade -y';
      break;
    case 'yum':
      cmd = updateNames
        ? `sudo yum update -y ${updateNames.join(' ')}`
        : 'sudo yum update -y';
      break;
    case 'dnf':
      cmd = updateNames
        ? `sudo dnf upgrade -y ${updateNames.join(' ')}`
        : 'sudo dnf upgrade -y';
      break;
    case 'pacman':
      cmd = 'sudo pacman -Syu --noconfirm';
      break;
    default:
      return { success: false, error: 'Mecanismo de actualización no soportado' };
  }

  const result = await executeCommand(connectionInfo, cmd, 300000); // 5min timeout

  // Check reboot requirement
  const rebootCheck = await executeCommand(connectionInfo,
    'test -f /var/run/reboot-required && echo "REBOOT" || (which needs-restarting 2>/dev/null && needs-restarting -r 2>/dev/null || echo "OK")'
  );
  const requiresReboot = rebootCheck.stdout.includes('REBOOT') || rebootCheck.code !== 0;

  return {
    success: result.code === 0,
    output: result.stdout,
    stderr: result.stderr,
    requiresReboot,
  };
}

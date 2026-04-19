import { NodeSSH } from 'node-ssh';

const pool = new Map();
const MAX_OUTPUT = 100 * 1024; // 100KB max stdout/stderr

export async function getConnection(connectionInfo) {
  const key = `${connectionInfo.host}:${connectionInfo.port}:${connectionInfo.username}`;

  if (pool.has(key)) {
    const existing = pool.get(key);
    if (existing.isConnected()) return { ssh: existing, connectionTimeMs: 0 };
    pool.delete(key);
  }

  const ssh = new NodeSSH();
  const config = {
    host: connectionInfo.host,
    port: connectionInfo.port || 22,
    username: connectionInfo.username,
    readyTimeout: 10000,
  };

  if (connectionInfo.auth_type === 'key') {
    if (connectionInfo.key_path) {
      config.privateKeyPath = connectionInfo.key_path;
    } else if (connectionInfo.credentials) {
      const key = connectionInfo.credentials.trim();
      // Validate that it looks like a private key, not encrypted JSON
      if (key.startsWith('{')) {
        throw new Error('La llave privada parece estar cifrada. Desbloquea la clave maestra en Configuracion.');
      }
      if (!key.startsWith('-----BEGIN')) {
        throw new Error('Formato de llave privada invalido. Debe comenzar con -----BEGIN');
      }
      config.privateKey = key;
    } else {
      throw new Error('Se requiere una llave privada o ruta al archivo de llave para auth_type=key');
    }
    if (connectionInfo.key_passphrase) {
      config.passphrase = connectionInfo.key_passphrase;
    }
  } else {
    config.password = connectionInfo.credentials;
  }

  const connStart = Date.now();
  await ssh.connect(config);
  const connectionTimeMs = Date.now() - connStart;

  pool.set(key, ssh);
  return { ssh, connectionTimeMs };
}

export async function executeCommand(connectionInfo, command, timeoutMs = 30000) {
  const { ssh, connectionTimeMs } = await getConnection(connectionInfo);

  const isWindows = connectionInfo.os_type === 'windows';
  const startedAt = new Date().toISOString();
  const execStart = Date.now();

  // For Windows, wrap complex PowerShell commands to ensure proper execution via OpenSSH
  let finalCommand = command;
  if (isWindows && !command.startsWith('powershell') && !command.startsWith('cmd')) {
    // Detect commands that need PowerShell wrapping (contain $, pipes with objects, cmdlets)
    const needsWrap = /\$\w|Get-|Set-|New-|Remove-|Select-|Where-|ForEach-|Measure-|Format-|Out-|ConvertTo-|Invoke-|\[math\]|\[System\]|\[Net\]/.test(command);
    if (needsWrap) {
      // Escape double quotes in the command and wrap with powershell -Command
      const escaped = command.replace(/"/g, '\\"');
      finalCommand = `powershell -NoProfile -NonInteractive -Command "${escaped}"`;
    }
  }

  let result;
  let timedOut = false;

  try {
    result = await Promise.race([
      ssh.execCommand(finalCommand, { execOptions: { pty: !isWindows } }),
      new Promise((_, reject) =>
        setTimeout(() => { timedOut = true; reject(new Error('Command timed out')); }, timeoutMs)
      ),
    ]);
  } catch (err) {
    if (timedOut) {
      return {
        stdout: '',
        stderr: `Timeout: el comando excedio ${timeoutMs / 1000}s`,
        code: -1,
        command,
        executionTimeMs: Date.now() - execStart,
        connectionTimeMs,
        startedAt,
        completedAt: new Date().toISOString(),
        timedOut: true,
        truncated: false,
      };
    }
    throw err;
  }

  const executionTimeMs = Date.now() - execStart;
  let truncated = false;
  let stdout = result.stdout || '';
  let stderr = result.stderr || '';

  if (stdout.length > MAX_OUTPUT) {
    stdout = stdout.substring(0, MAX_OUTPUT) + '\n... [output truncated]';
    truncated = true;
  }
  if (stderr.length > MAX_OUTPUT) {
    stderr = stderr.substring(0, MAX_OUTPUT) + '\n... [output truncated]';
    truncated = true;
  }

  return {
    stdout,
    stderr,
    code: result.code,
    command,
    executionTimeMs,
    connectionTimeMs,
    startedAt,
    completedAt: new Date().toISOString(),
    timedOut: false,
    truncated,
  };
}

export async function testConnection(connectionInfo) {
  try {
    const { ssh } = await getConnection(connectionInfo);
    const result = await ssh.execCommand(
      connectionInfo.os_type === 'windows' ? 'hostname' : 'whoami'
    );
    return { success: true, output: result.stdout.trim() };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export function disconnectAll() {
  for (const [key, ssh] of pool) {
    ssh.dispose();
    pool.delete(key);
  }
}

export function disconnect(connectionInfo) {
  const key = `${connectionInfo.host}:${connectionInfo.port}:${connectionInfo.username}`;
  if (pool.has(key)) {
    pool.get(key).dispose();
    pool.delete(key);
  }
}

export function getConnectionStatus(connectionInfo) {
  const key = `${connectionInfo.host}:${connectionInfo.port}:${connectionInfo.username}`;
  if (pool.has(key)) {
    const ssh = pool.get(key);
    if (ssh.isConnected()) return 'connected';
    pool.delete(key);
  }
  return 'disconnected';
}

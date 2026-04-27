import db from '../db.js';
import { executeCommand } from './ssh.js';
import { decrypt, isUnlocked } from './crypto.js';

let intervalId = null;

function prepareForSSH(conn) {
  if (!conn) return conn;
  const prepared = { ...conn };
  if (conn.credentials_encrypted && isUnlocked()) {
    try {
      if (conn.credentials) prepared.credentials = decrypt(conn.credentials);
      if (conn.key_passphrase) prepared.key_passphrase = decrypt(conn.key_passphrase);
    } catch { /* ignore */ }
  }
  return prepared;
}

// Parse cron expression (minute hour day-of-month month day-of-week)
function matchesCron(expression, date) {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const checks = [
    { value: date.getMinutes(), field: parts[0] },
    { value: date.getHours(), field: parts[1] },
    { value: date.getDate(), field: parts[2] },
    { value: date.getMonth() + 1, field: parts[3] },
    { value: date.getDay(), field: parts[4] },
  ];

  return checks.every(({ value, field }) => matchesField(value, field));
}

function matchesField(value, field) {
  if (field === '*') return true;

  // Handle */n
  if (field.startsWith('*/')) {
    const interval = parseInt(field.substring(2));
    return value % interval === 0;
  }

  // Handle ranges: 1-5
  if (field.includes('-')) {
    const [min, max] = field.split('-').map(Number);
    return value >= min && value <= max;
  }

  // Handle lists: 1,3,5
  if (field.includes(',')) {
    return field.split(',').map(Number).includes(value);
  }

  return parseInt(field) === value;
}

async function executeTask(task) {
  const startTime = Date.now();
  const connections = [];

  if (task.connection_id) {
    const conn = db.prepare('SELECT * FROM connections WHERE id = ?').get(task.connection_id);
    if (conn) connections.push(conn);
  } else if (task.group_id) {
    const members = db.prepare(
      'SELECT c.* FROM connections c JOIN server_group_members m ON c.id = m.connection_id WHERE m.group_id = ?'
    ).all(task.group_id);
    connections.push(...members);
  }

  if (connections.length === 0) return;

  for (const conn of connections) {
    const sshConn = prepareForSSH(conn);
    const runResult = db.prepare(
      'INSERT INTO scheduled_task_runs (task_id, connection_id) VALUES (?, ?)'
    ).run(task.id, conn.id);
    const runId = runResult.lastInsertRowid;

    let output = '';
    let error = null;
    let status = 'success';

    try {
      if (task.task_type === 'playbook' && task.playbook_id) {
        const pb = db.prepare('SELECT * FROM playbooks WHERE id = ?').get(task.playbook_id);
        if (pb) {
          const steps = JSON.parse(pb.command_sequence || '[]');
          for (const step of steps) {
            const result = await executeCommand(sshConn, step.command, task.timeout_ms);
            output += `[${step.name}] exit=${result.code}\n${result.stdout}\n`;
            if (result.code !== 0) status = 'partial_failure';
          }
        }
      } else if (task.command) {
        const result = await executeCommand(sshConn, task.command, task.timeout_ms);
        output = result.stdout;
        if (result.stderr) output += '\n[stderr] ' + result.stderr;
        if (result.code !== 0) status = 'failed';
      }
    } catch (err) {
      error = err.message;
      status = 'error';

      // Retry logic
      if (task.retry_count > 0) {
        for (let i = 0; i < task.retry_count; i++) {
          await new Promise((r) => setTimeout(r, task.retry_delay_ms));
          try {
            if (task.command) {
              const retry = await executeCommand(sshConn, task.command, task.timeout_ms);
              output = retry.stdout;
              error = null;
              status = retry.code === 0 ? 'success' : 'failed';
              break;
            }
          } catch (retryErr) {
            error = retryErr.message;
          }
        }
      }
    }

    const durationMs = Date.now() - startTime;
    db.prepare(
      'UPDATE scheduled_task_runs SET completed_at = datetime(\'now\'), status = ?, output = ?, error = ?, duration_ms = ? WHERE id = ?'
    ).run(status, output.substring(0, 50000), error, durationMs, runId);
  }

  db.prepare('UPDATE scheduled_tasks SET last_run_at = datetime(\'now\') WHERE id = ?').run(task.id);
}

function tick() {
  const now = new Date();
  const tasks = db.prepare('SELECT * FROM scheduled_tasks WHERE enabled = 1').all();

  for (const task of tasks) {
    if (!matchesCron(task.cron_expression, now)) continue;

    // Check time window
    if (task.time_window_start && task.time_window_end) {
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (timeStr < task.time_window_start || timeStr > task.time_window_end) continue;
    }

    // Prevent double execution within the same minute
    if (task.last_run_at) {
      const lastRun = new Date(task.last_run_at + 'Z');
      if (now - lastRun < 60000) continue;
    }

    // Execute asynchronously
    executeTask(task).catch((err) => console.error(`Scheduler error for task ${task.id}:`, err.message));
  }
}

export function start() {
  if (intervalId) return;
  intervalId = setInterval(tick, 60000);
  console.log('  Scheduler started (60s interval)');
}

export function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

import { Router } from 'express';
import { randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import db from '../db.js';
import { chat } from '../services/ai.js';
import { decrypt, isUnlocked } from '../services/crypto.js';
import { learnFromExecution } from '../services/knowledge.js';
import { getProfile } from '../services/profiler.js';
import { selectModel } from '../services/model-router.js';
import { parseSemanticBlocks } from '../services/semantic-parser.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// In-memory SSE clients per job
const jobClients = new Map(); // jobId -> Set of response objects

// Clean up zombie jobs on startup (were "running" when server crashed/restarted)
try {
  const zombies = db.prepare("SELECT id FROM active_jobs WHERE status = 'running'").all();
  if (zombies.length > 0) {
    db.prepare(
      `UPDATE active_jobs SET status = 'interrupted', error = 'Server reiniciado durante ejecucion', completed_at = datetime('now') WHERE status = 'running'`
    ).run();
    console.log(`  Cleaned up ${zombies.length} zombie job(s)`);
  }
} catch { /* table may not exist yet */ }

const TASK_PATTERNS = [
  [/actualiz|update|upgrade|patch|parche/i, 'maintenance'],
  [/diagnos|problema|error|log|revisar|debug/i, 'diagnostic'],
  [/deploy|desplieg|instalar|install/i, 'deployment'],
  [/config|ajust|modific|cambiar|set/i, 'configuration'],
  [/monitor|estado|salud|health|cpu|ram|disco|disk|memoria|uptime/i, 'monitoring'],
  [/segur|security|firewall|permiso|access|acceso/i, 'security'],
  [/reinici|restart|reboot|stop|start|servicio|service/i, 'maintenance'],
];

function detectTaskType(prompt) {
  for (const [pattern, type] of TASK_PATTERNS) {
    if (pattern.test(prompt)) return type;
  }
  return 'other';
}

function prepareForSSH(conn) {
  if (!conn) return conn;
  const prepared = { ...conn };
  if (conn.credentials_encrypted) {
    if (!isUnlocked()) {
      throw new Error('Clave maestra bloqueada. Desbloquea en Configuracion para usar credenciales cifradas.');
    }
    try {
      if (conn.credentials) prepared.credentials = decrypt(conn.credentials);
      if (conn.key_passphrase) prepared.key_passphrase = decrypt(conn.key_passphrase);
    } catch (e) {
      throw new Error('Error al descifrar credenciales: ' + e.message);
    }
  }
  return prepared;
}

function broadcastToJob(jobId, eventType, eventData) {
  const clients = jobClients.get(jobId);
  if (!clients) return;
  const payload = `data: ${JSON.stringify({ type: eventType, data: eventData })}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch { /* client disconnected */ }
  }
}

function persistEvent(jobId, eventType, eventData) {
  try {
    const job = db.prepare('SELECT events FROM active_jobs WHERE id = ?').get(jobId);
    if (!job) return;
    const events = JSON.parse(job.events || '[]');
    events.push({ type: eventType, data: eventData, timestamp: new Date().toISOString() });
    db.prepare('UPDATE active_jobs SET events = ? WHERE id = ?').run(JSON.stringify(events), jobId);
  } catch { /* ignore */ }
}

// POST: Start a chat job (returns jobId, executes in background) — operator+admin
router.post('/:connectionId/chat', requireRole('admin', 'operator'), async (req, res) => {
  const { message, model, session_id } = req.body;
  const { connectionId } = req.params;

  if (!message) return res.status(400).json({ error: 'Mensaje requerido' });

  const conn = db.prepare('SELECT * FROM connections WHERE id = ?').get(connectionId);
  if (!conn) return res.status(404).json({ error: 'Conexion no encontrada' });

  // Resolve session_id: from body, or find active session
  const sessionId = session_id || db.prepare("SELECT id FROM work_sessions WHERE connection_id = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1").get(connectionId)?.id || null;

  // Smart model routing if no manual override
  const taskType = detectTaskType(message);
  const resolvedModel = model || selectModel(taskType, message);

  const jobId = randomUUID();

  // Create job record WITH session_id
  db.prepare(
    'INSERT INTO active_jobs (id, connection_id, user_prompt, model, session_id) VALUES (?, ?, ?, ?, ?)'
  ).run(jobId, connectionId, message, resolvedModel, sessionId);

  // Save user message to chat history WITH session_id
  db.prepare('INSERT INTO chat_history (connection_id, role, content, session_id) VALUES (?, ?, ?, ?)').run(
    connectionId, 'user', message, sessionId
  );

  // Return jobId + resolved model info
  res.json({ jobId, model: resolvedModel, taskType });

  // Execute in background
  const history = db
    .prepare('SELECT role, content FROM chat_history WHERE connection_id = ? ORDER BY created_at ASC')
    .all(connectionId);
  history.pop();

  const onEvent = (type, data) => {
    persistEvent(jobId, type, data);
    broadcastToJob(jobId, type, data);
  };

  // Emit model selection event
  onEvent('model_selected', { model: resolvedModel, taskType, reason: model ? 'Manual override' : `Auto: ${taskType}` });

  try {
    const result = await chat(prepareForSSH(conn), message, history, resolvedModel, onEvent);

    // Save assistant message with metrics + session_id
    db.prepare(
      `INSERT INTO chat_history (connection_id, role, content, model_used, input_tokens, output_tokens, response_time_ms, total_latency_ms, session_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      connectionId, 'assistant', result.response,
      result.metrics.model, result.metrics.inputTokens, result.metrics.outputTokens,
      result.metrics.responseTimeMs, result.metrics.totalLatencyMs, sessionId
    );

    // Audit log WITH session_id
    const commands = result.executions?.map((e) => e.command) || [];
    const hasErrors = result.executions?.some((e) => e.exitCode !== 0);
    try {
      db.prepare(
        `INSERT INTO audit_log (connection_id, connection_name, user_prompt, commands_generated, full_output, duration_ms, final_status, model_used, task_type, session_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        connectionId, conn.name, message,
        JSON.stringify(commands),
        JSON.stringify(result.executions?.map((e) => ({ stdout: e.stdout?.substring(0, 500), stderr: e.stderr?.substring(0, 500), exitCode: e.exitCode })) || []),
        result.metrics.totalLatencyMs,
        hasErrors ? 'partial_failure' : 'success',
        result.metrics.model, taskType, sessionId
      );
    } catch { /* audit non-critical */ }

    // Log events to server_events bitacora
    if (result.executions?.length > 0) {
      try {
        const evtStmt = db.prepare(
          `INSERT INTO server_events (connection_id, session_id, event_type, severity, title, command_executed, exit_code, user_action)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        );
        for (const exec of result.executions) {
          evtStmt.run(
            connectionId, sessionId, 'command',
            exec.exitCode === 0 ? 'info' : 'warning',
            `Comando: ${exec.command.substring(0, 100)}`,
            exec.command, exec.exitCode, message.substring(0, 100)
          );
        }
      } catch { /* non-critical */ }
    }

    // Update session counters
    if (sessionId) {
      try {
        const cmdCount = result.executions?.length || 0;
        const successCount = result.executions?.filter((e) => e.exitCode === 0).length || 0;
        const failCount = cmdCount - successCount;
        db.prepare(
          `UPDATE work_sessions SET commands_count = commands_count + ?, successful_count = successful_count + ?, failed_count = failed_count + ? WHERE id = ?`
        ).run(cmdCount, successCount, failCount, sessionId);
      } catch { /* non-critical */ }
    }

    // Auto-learn from execution
    const profile = getProfile(connectionId);
    if (result.executions?.length > 0) {
      try {
        learnFromExecution({
          sessionId, connectionId: parseInt(connectionId),
          osFamily: profile?.os_family, osVersion: profile?.os_version,
          actionName: message.substring(0, 100),
          commands: result.executions.map((e) => ({ command: e.command, exitCode: e.exitCode })),
          outcome: hasErrors ? 'partial' : 'success',
          outcomeDetails: result.response?.substring(0, 500),
          category: taskType,
        });
      } catch { /* learning non-critical */ }
    }

    // Parse semantic blocks from AI response
    try {
      const { blocks, tags } = parseSemanticBlocks(result.response, result.executions);
      result.blocks = blocks;
      result.tags = tags;
    } catch { /* parsing non-critical, continue with raw text */ }

    // Mark job complete
    db.prepare(
      `UPDATE active_jobs SET status = ?, result = ?, completed_at = datetime('now') WHERE id = ?`
    ).run('completed', JSON.stringify(result), jobId);

    // Broadcast done
    broadcastToJob(jobId, 'done', result);

    // Clean up SSE clients
    setTimeout(() => { jobClients.delete(jobId); }, 5000);

  } catch (err) {
    console.error('Agent error:', err.message);

    db.prepare(
      'INSERT INTO chat_history (connection_id, role, content, api_error) VALUES (?, ?, ?, ?)'
    ).run(connectionId, 'assistant', `Error: ${err.message}`, err.message);

    try {
      db.prepare(
        `INSERT INTO audit_log (connection_id, connection_name, user_prompt, final_status, errors, task_type)
         VALUES (?, ?, ?, 'error', ?, 'other')`
      ).run(connectionId, conn?.name, message, err.message);
    } catch { /* ignore */ }

    db.prepare(
      `UPDATE active_jobs SET status = ?, error = ?, completed_at = datetime('now') WHERE id = ?`
    ).run('error', err.message, jobId);

    broadcastToJob(jobId, 'error', { message: err.message });
    setTimeout(() => { jobClients.delete(jobId); }, 5000);
  }
});

// GET: SSE stream for a job
router.get('/:connectionId/jobs/:jobId/stream', (req, res) => {
  const { jobId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Check if job already completed
  const job = db.prepare('SELECT status, result, error FROM active_jobs WHERE id = ?').get(jobId);
  if (job?.status === 'completed') {
    res.write(`data: ${JSON.stringify({ type: 'done', data: JSON.parse(job.result) })}\n\n`);
    res.end();
    return;
  }
  if (job?.status === 'error' || job?.status === 'interrupted' || job?.status === 'cancelled') {
    res.write(`data: ${JSON.stringify({ type: 'error', data: { message: job.error || 'Job terminado' } })}\n\n`);
    res.end();
    return;
  }

  // Register as SSE client
  if (!jobClients.has(jobId)) jobClients.set(jobId, new Set());
  jobClients.get(jobId).add(res);

  // Send heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch { clearInterval(heartbeat); }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    jobClients.get(jobId)?.delete(res);
  });
});

// POST: Cancel a job — operator+admin
router.post('/:connectionId/jobs/:jobId/cancel', requireRole('admin', 'operator'), (req, res) => {
  const { jobId } = req.params;
  const job = db.prepare('SELECT status FROM active_jobs WHERE id = ?').get(jobId);
  if (!job) return res.status(404).json({ error: 'Job no encontrado' });

  db.prepare(
    `UPDATE active_jobs SET status = 'cancelled', error = 'Cancelado por el usuario', completed_at = datetime('now') WHERE id = ?`
  ).run(jobId);

  // Notify SSE clients
  broadcastToJob(jobId, 'cancelled', { message: 'Job cancelado por el usuario' });
  setTimeout(() => { jobClients.delete(jobId); }, 1000);

  res.json({ success: true });
});

// GET: Active jobs for a connection (must be before :jobId)
router.get('/:connectionId/jobs/active', (req, res) => {
  const jobs = db.prepare(
    "SELECT id, status, user_prompt, model, created_at FROM active_jobs WHERE connection_id = ? AND status = 'running' ORDER BY created_at DESC"
  ).all(req.params.connectionId);
  res.json(jobs);
});

// GET: Job status + all events (for reconnection)
router.get('/:connectionId/jobs/:jobId', (req, res) => {
  const job = db.prepare('SELECT * FROM active_jobs WHERE id = ?').get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job no encontrado' });

  res.json({
    ...job,
    events: JSON.parse(job.events || '[]'),
    result: job.result ? JSON.parse(job.result) : null,
  });
});

// History
router.get('/:connectionId/history', (req, res) => {
  const { connectionId } = req.params;
  const history = db
    .prepare('SELECT id, role, content, model_used, input_tokens, output_tokens, response_time_ms, total_latency_ms, created_at FROM chat_history WHERE connection_id = ? ORDER BY created_at ASC')
    .all(connectionId);
  res.json(history);
});

// Executions
router.get('/:connectionId/executions', (req, res) => {
  const { connectionId } = req.params;
  const { limit = 50, offset = 0 } = req.query;
  const executions = db
    .prepare('SELECT * FROM execution_log WHERE connection_id = ? ORDER BY started_at DESC LIMIT ? OFFSET ?')
    .all(connectionId, parseInt(limit), parseInt(offset));
  res.json(executions);
});

// Clear history — operator+admin
router.delete('/:connectionId/history', requireRole('admin', 'operator'), (req, res) => {
  const { connectionId } = req.params;
  db.prepare('DELETE FROM chat_history WHERE connection_id = ?').run(connectionId);
  res.json({ success: true });
});

// POST: AI contextual explanation for a semantic block — operator+admin
router.post('/:connectionId/explain', requireRole('admin', 'operator'), async (req, res) => {
  const { blockType, blockData, action, context } = req.body;
  if (!blockType || !blockData) return res.status(400).json({ error: 'blockType y blockData requeridos' });

  const apiKey = db.prepare('SELECT value FROM settings WHERE key = ?').get('anthropic_api_key')?.value;
  if (!apiKey) return res.status(400).json({ error: 'API key no configurada' });

  const profile = getProfile(req.params.connectionId);
  const actionPrompts = {
    explain: 'Explica que significa este resultado de forma clara y concisa. Incluye por que importa y que riesgo representa.',
    deepen: 'Proporciona un analisis tecnico profundo de este resultado. Incluye causas posibles, relaciones con otros componentes del sistema, y detalles avanzados.',
    impact: 'Analiza el impacto de este hallazgo en el sistema. Que pasa si no se atiende? A que otros componentes afecta?',
    fix: 'Genera un comando o procedimiento concreto para resolver o mejorar esta situacion. Incluye el comando exacto y explica que hace.',
    simplify: 'Explica esto en terminos simples, como si fuera para un gerente o persona no tecnica. Evita jerga.',
    compare: 'Compara estos valores con lo que seria un estado saludable o normal. Indica que esta bien y que esta fuera de rango.',
  };

  const systemPrompt = `Eres Kodo, asistente experto en infraestructura. Respondes siempre en espanol, de forma concisa y util.
${profile ? `Servidor: ${profile.os_version || profile.distro} (${profile.arch}), ${profile.package_manager}` : ''}`;

  const userPrompt = `${actionPrompts[action] || actionPrompts.explain}

TIPO DE BLOQUE: ${blockType}
DATOS:
${JSON.stringify(blockData, null, 2)}
${context ? `\nCONTEXTO DE LA SESION:\n${context.substring(0, 1000)}` : ''}`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const explanation = response.content[0]?.text || '';
    res.json({ explanation, tokens: { input: response.usage?.input_tokens, output: response.usage?.output_tokens } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

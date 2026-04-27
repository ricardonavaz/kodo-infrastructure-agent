import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import db from '../db.js';
import { executeCommand } from '../services/ssh.js';
import { decrypt, isUnlocked } from '../services/crypto.js';
import { getProfile } from '../services/profiler.js';
import { getKnowledgeForPrompt } from '../services/knowledge.js';
import { executePlaybook as runPlaybook } from '../services/playbook-executor.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

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

// List playbooks
router.get('/', (req, res) => {
  const { category, system } = req.query;
  let sql = 'SELECT * FROM playbooks';
  const conditions = [];
  const params = [];

  if (category) { conditions.push('category = ?'); params.push(category); }
  if (system) { conditions.push('compatible_systems LIKE ?'); params.push(`%${system}%`); }

  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY is_builtin DESC, name ASC';

  res.json(db.prepare(sql).all(...params));
});

// Get single
router.get('/:id', (req, res) => {
  const pb = db.prepare('SELECT * FROM playbooks WHERE id = ?').get(req.params.id);
  if (!pb) return res.status(404).json({ error: 'Playbook no encontrado' });
  res.json(pb);
});

// Create — operator+admin
router.post('/', requireRole('admin', 'operator'), (req, res) => {
  const { name, description, objective, compatible_systems, command_sequence, category,
          preconditions, required_variables, success_criteria, rollback_commands,
          auditor_mode, execution_mode, max_sub_depth } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });

  const result = db.prepare(
    `INSERT INTO playbooks (name, description, objective, compatible_systems, command_sequence, category, preconditions, required_variables, success_criteria, rollback_commands, auditor_mode, execution_mode, max_sub_depth)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    name, description || '', objective || '',
    JSON.stringify(compatible_systems || ['linux']),
    JSON.stringify(command_sequence || []),
    category || 'custom',
    JSON.stringify(preconditions || []),
    JSON.stringify(required_variables || []),
    JSON.stringify(success_criteria || []),
    JSON.stringify(rollback_commands || []),
    auditor_mode || 'none',
    execution_mode || 'sequential',
    max_sub_depth ?? 5
  );

  res.status(201).json(db.prepare('SELECT * FROM playbooks WHERE id = ?').get(result.lastInsertRowid));
});

// Update — operator+admin
router.put('/:id', requireRole('admin', 'operator'), (req, res) => {
  const existing = db.prepare('SELECT * FROM playbooks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Playbook no encontrado' });
  if (existing.is_builtin) return res.status(403).json({ error: 'No se puede modificar un playbook integrado. Duplicalo primero.' });

  const { name, description, objective, compatible_systems, command_sequence, category,
          preconditions, required_variables, success_criteria, rollback_commands,
          auditor_mode, execution_mode, max_sub_depth } = req.body;
  db.prepare(
    `UPDATE playbooks SET name = ?, description = ?, objective = ?, compatible_systems = ?, command_sequence = ?, category = ?,
     preconditions = ?, required_variables = ?, success_criteria = ?, rollback_commands = ?,
     auditor_mode = ?, execution_mode = ?, max_sub_depth = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(
    name || existing.name,
    description !== undefined ? description : existing.description,
    objective !== undefined ? objective : existing.objective,
    compatible_systems ? JSON.stringify(compatible_systems) : existing.compatible_systems,
    command_sequence ? JSON.stringify(command_sequence) : existing.command_sequence,
    category || existing.category,
    preconditions ? JSON.stringify(preconditions) : existing.preconditions,
    required_variables ? JSON.stringify(required_variables) : existing.required_variables,
    success_criteria ? JSON.stringify(success_criteria) : existing.success_criteria,
    rollback_commands ? JSON.stringify(rollback_commands) : existing.rollback_commands,
    auditor_mode ?? existing.auditor_mode,
    execution_mode ?? existing.execution_mode,
    max_sub_depth ?? existing.max_sub_depth,
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM playbooks WHERE id = ?').get(req.params.id));
});

// Delete — operator+admin
router.delete('/:id', requireRole('admin', 'operator'), (req, res) => {
  const existing = db.prepare('SELECT * FROM playbooks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Playbook no encontrado' });
  if (existing.is_builtin) return res.status(403).json({ error: 'No se puede eliminar un playbook integrado' });

  db.prepare('DELETE FROM playbooks WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Execute playbook — operator+admin
router.post('/:id/execute', requireRole('admin', 'operator'), async (req, res) => {
  const { connectionId, variables = {}, executionMode, auditorMode } = req.body;
  const pb = db.prepare('SELECT * FROM playbooks WHERE id = ?').get(req.params.id);
  if (!pb) return res.status(404).json({ error: 'Playbook no encontrado' });

  const conn = db.prepare('SELECT * FROM connections WHERE id = ?').get(connectionId);
  if (!conn) return res.status(404).json({ error: 'Conexion no encontrada' });

  try {
    const result = await runPlaybook(pb.id, connectionId, variables, prepareForSSH(conn), {
      executionMode: executionMode || pb.execution_mode || 'sequential',
      auditorMode: auditorMode || pb.auditor_mode || 'none',
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Execute playbook with SSE streaming — operator+admin
router.post('/:id/execute-stream', requireRole('admin', 'operator'), async (req, res) => {
  const { connectionId, variables = {}, executionMode, auditorMode } = req.body;
  const pb = db.prepare('SELECT * FROM playbooks WHERE id = ?').get(req.params.id);
  if (!pb) return res.status(404).json({ error: 'Playbook no encontrado' });

  const conn = db.prepare('SELECT * FROM connections WHERE id = ?').get(connectionId);
  if (!conn) return res.status(404).json({ error: 'Conexion no encontrada' });

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    res.write('data: {"type":"ping"}\n\n');
  }, 30000);

  const onEvent = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  };

  try {
    const result = await runPlaybook(pb.id, connectionId, variables, prepareForSSH(conn), {
      executionMode: executionMode || pb.execution_mode || 'sequential',
      auditorMode: auditorMode || pb.auditor_mode || 'none',
      onEvent,
    });
    res.write(`data: ${JSON.stringify({ type: 'done', data: result })}\n\n`);
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'error', data: { message: err.message } })}\n\n`);
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
});

// Respond to a pending interaction — operator+admin
router.post('/runs/:runId/interactions/:interactionId/respond', requireRole('admin', 'operator'), (req, res) => {
  const { response } = req.body;
  const interaction = db.prepare('SELECT * FROM playbook_run_interactions WHERE id = ? AND run_id = ?')
    .get(req.params.interactionId, req.params.runId);

  if (!interaction) return res.status(404).json({ error: 'Interaccion no encontrada' });
  if (interaction.status !== 'pending') return res.status(400).json({ error: 'Interaccion ya respondida' });

  db.prepare('UPDATE playbook_run_interactions SET response = ?, responded_at = datetime(\'now\'), status = ? WHERE id = ?')
    .run(response, 'responded', req.params.interactionId);

  res.json({ success: true });
});

// Get run detail with interactions
router.get('/runs/:runId', (req, res) => {
  const run = db.prepare('SELECT * FROM playbook_runs WHERE id = ?').get(req.params.runId);
  if (!run) return res.status(404).json({ error: 'Run no encontrado' });

  const interactions = db.prepare('SELECT * FROM playbook_run_interactions WHERE run_id = ? ORDER BY step_index')
    .all(req.params.runId);

  res.json({ ...run, interactions });
});

// Get pending interactions for a run
router.get('/runs/:runId/interactions', (req, res) => {
  const interactions = db.prepare('SELECT * FROM playbook_run_interactions WHERE run_id = ? ORDER BY step_index')
    .all(req.params.runId);
  res.json(interactions);
});

// Run history
router.get('/:id/runs', (req, res) => {
  const runs = db.prepare(
    'SELECT * FROM playbook_runs WHERE playbook_id = ? ORDER BY started_at DESC LIMIT 50'
  ).all(req.params.id);
  res.json(runs);
});

// ===== AI Playbook Generator (uses Opus) =====

const PLAYBOOK_GEN_PROMPT = `Eres un ingeniero de infraestructura senior especializado en automatizacion de servidores.

Tu tarea es generar un playbook operativo detallado, ejecutable paso a paso via SSH.

REGLAS ESTRICTAS:
1. Cada paso debe tener un comando SSH exacto y funcional
2. Incluye validaciones ANTES de cada paso critico (verificar que el servicio existe, que hay espacio, etc.)
3. Incluye verificaciones DESPUES de cada paso (confirmar que el cambio se aplico)
4. Incluye comandos de ROLLBACK para cada paso que modifique el sistema
5. Los comandos deben ser especificos para el sistema operativo del servidor
6. Usa el package manager correcto ({package_manager})
7. Nunca asumas - verifica primero

FORMATO DE RESPUESTA (JSON estricto):
{
  "name": "Nombre descriptivo del playbook",
  "description": "Descripcion detallada",
  "objective": "Objetivo especifico",
  "category": "maintenance|deployment|configuration|security|diagnostic",
  "preconditions": ["Condicion 1 a verificar", "Condicion 2"],
  "command_sequence": [
    {"name": "Paso 1: Verificar prerequisitos", "command": "comando ssh"},
    {"name": "Paso 2: Accion principal", "command": "comando ssh"},
    {"name": "Paso 3: Verificar resultado", "command": "comando ssh"}
  ],
  "rollback_commands": [
    {"name": "Revertir paso 2", "command": "comando de rollback"}
  ],
  "success_criteria": ["Criterio 1 para confirmar exito", "Criterio 2"],
  "required_variables": [{"name": "var_name", "description": "Que es", "default": "valor"}],
  "estimated_duration": "5 minutos",
  "risk_level": "low|medium|high"
}

Responde SOLO con el JSON, sin texto adicional.`;

router.post('/generate', requireRole('admin', 'operator'), async (req, res) => {
  const { objective, connectionId } = req.body;
  if (!objective) return res.status(400).json({ error: 'objective requerido' });

  const apiKey = db.prepare('SELECT value FROM settings WHERE key = ?').get('anthropic_api_key')?.value;
  if (!apiKey) return res.status(400).json({ error: 'API key no configurada' });

  // Build context
  const profile = connectionId ? getProfile(connectionId) : null;
  const knowledge = connectionId ? getKnowledgeForPrompt(connectionId) : '';

  const systemPrompt = PLAYBOOK_GEN_PROMPT
    .replace('{package_manager}', profile?.package_manager || 'apt/yum');

  let userPrompt = `OBJETIVO: ${objective}`;
  if (profile) {
    userPrompt += `\n\nSERVIDOR DESTINO:\n- OS: ${profile.os_version || profile.distro}\n- Arch: ${profile.arch}\n- Package Manager: ${profile.package_manager}\n- Init System: ${profile.init_system}\n- RAM: ${profile.total_memory_mb} MB\n- Disco: ${profile.total_disk_mb} MB`;
  }
  if (knowledge) userPrompt += `\n${knowledge}`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-opus-4-20250514',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content[0]?.text || '';
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'La IA no genero un playbook valido', raw: text });
    }

    const playbook = JSON.parse(jsonMatch[0]);

    // Save to database
    const result = db.prepare(
      `INSERT INTO playbooks (name, description, objective, compatible_systems, command_sequence, category, preconditions, required_variables, success_criteria, rollback_commands)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      playbook.name, playbook.description, playbook.objective,
      JSON.stringify([profile?.os_family || 'linux']),
      JSON.stringify(playbook.command_sequence || []),
      playbook.category || 'custom',
      JSON.stringify(playbook.preconditions || []),
      JSON.stringify(playbook.required_variables || []),
      JSON.stringify(playbook.success_criteria || []),
      JSON.stringify(playbook.rollback_commands || [])
    );

    const saved = db.prepare('SELECT * FROM playbooks WHERE id = ?').get(result.lastInsertRowid);

    res.json({
      playbook: saved,
      metrics: {
        model: 'claude-opus-4-20250514',
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

import db from '../db.js';
import { executeCommand } from './ssh.js';
import { auditStep } from './auditor.js';

const MAX_DEPTH = 5;
const INTERACTION_POLL_MS = 1000;
const INTERACTION_TIMEOUT_MS = 300000; // 5 min

/**
 * Execute a playbook with support for advanced step types.
 *
 * @param {number} playbookId
 * @param {number} connectionId
 * @param {object} variables - key-value map for {{variable}} substitution
 * @param {object} sshConn - prepared SSH connection info
 * @param {object} [options]
 * @param {number} [options.depth=0] - current sub-playbook recursion depth
 * @param {function} [options.onEvent] - SSE callback (type, data)
 * @param {string} [options.executionMode='sequential']
 * @param {string} [options.auditorMode='none'] - none | audit_log | supervised
 * @param {number} [options.parentRunId] - parent run ID for sub-playbooks
 */
export async function executePlaybook(playbookId, connectionId, variables, sshConn, options = {}) {
  const {
    depth = 0,
    onEvent = null,
    executionMode = 'sequential',
    auditorMode = 'none',
    parentRunId = null,
  } = options;

  const emit = (type, data) => { try { onEvent?.(type, data); } catch { /* ignore */ } };

  // Depth check
  if (depth > MAX_DEPTH) {
    const err = `Limite de profundidad de sub-playbooks alcanzado (max ${MAX_DEPTH})`;
    emit('error', { message: err });
    return { status: 'error', error: err, steps: [] };
  }

  const pb = db.prepare('SELECT * FROM playbooks WHERE id = ?').get(playbookId);
  if (!pb) {
    const err = 'Playbook no encontrado';
    emit('error', { message: err });
    return { status: 'error', error: err, steps: [] };
  }

  const steps = JSON.parse(pb.command_sequence || '[]');
  const stepResults = [];
  let overallStatus = 'success';

  // Create run record
  const run = db.prepare(
    'INSERT INTO playbook_runs (playbook_id, connection_id, variables_used, execution_mode) VALUES (?, ?, ?, ?)'
  ).run(pb.id, connectionId, JSON.stringify(variables), executionMode);
  const runId = run.lastInsertRowid;

  emit('playbook_start', {
    runId, playbook: pb.name, steps: steps.length, depth,
    auditorMode, executionMode,
  });

  const auditorLog = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepType = step.type || 'command';

    // Update current step
    db.prepare('UPDATE playbook_runs SET current_step = ? WHERE id = ?').run(i, runId);

    emit('step_start', { index: i, name: step.name, type: stepType, total: steps.length });

    try {
      let stepResult;

      switch (stepType) {
        case 'command': {
          stepResult = await executeCommandStep(step, variables, sshConn, connectionId, emit);
          break;
        }

        case 'invoke_playbook': {
          stepResult = await executeSubPlaybook(step, variables, sshConn, connectionId, {
            depth, onEvent, auditorMode,
          });
          break;
        }

        case 'message': {
          stepResult = await executeMessageStep(step, variables, runId, i, emit);
          break;
        }

        case 'prompt': {
          stepResult = await executePromptStep(step, variables, runId, i, emit);
          // Inject user response as variable
          if (stepResult.response !== undefined && step.variable_name) {
            variables[step.variable_name] = stepResult.response;
          }
          break;
        }

        case 'approval_gate': {
          stepResult = await executeApprovalGate(step, runId, i, emit);
          if (stepResult.status === 'rejected') {
            overallStatus = 'aborted';
            stepResults.push(stepResult);
            emit('step_result', { index: i, ...stepResult });
            break;
          }
          break;
        }

        default: {
          stepResult = { name: step.name, type: stepType, status: 'skipped', message: `Tipo de paso desconocido: ${stepType}` };
        }
      }

      stepResults.push(stepResult);
      emit('step_result', { index: i, ...stepResult });

      // Auditor evaluation (only for command steps with results)
      if (auditorMode !== 'none' && stepType === 'command' && stepResult) {
        const verdict = await auditStep(step, stepResult, {
          playbook: pb.name,
          serverConnection: connectionId,
          previousSteps: stepResults.slice(0, -1),
          auditorMode,
        });

        auditorLog.push({ step: i, ...verdict });
        emit('auditor_verdict', { step: i, ...verdict });

        if (auditorMode === 'supervised' && verdict.verdict === 'halt') {
          // Create an approval gate for the auditor's halt
          const gateResult = await executeApprovalGate(
            { name: `Auditor: ${verdict.reason}`, text: `El auditor ha detenido la ejecucion.\n\nRazon: ${verdict.reason}\nRiesgo: ${verdict.risk_level}\nRecomendaciones: ${verdict.recommendations || 'N/A'}` },
            runId, i, emit
          );
          if (gateResult.status === 'rejected') {
            overallStatus = 'aborted';
            break;
          }
        }
      }

      // Check if we should stop
      if (stepResult.status === 'failed' || stepResult.status === 'error') {
        overallStatus = 'partial_failure';
      }
      if (overallStatus === 'aborted') break;

    } catch (err) {
      const errorResult = { name: step.name, type: stepType, status: 'error', error: err.message };
      stepResults.push(errorResult);
      emit('step_error', { index: i, ...errorResult });
      overallStatus = 'error';
      break;
    }
  }

  // Update run record
  db.prepare(
    'UPDATE playbook_runs SET completed_at = datetime("now"), status = ?, step_results = ?, auditor_log = ? WHERE id = ?'
  ).run(overallStatus, JSON.stringify(stepResults), JSON.stringify(auditorLog), runId);

  emit('playbook_complete', { runId, playbook: pb.name, status: overallStatus, steps: stepResults.length });

  return { runId, playbook: pb.name, status: overallStatus, steps: stepResults };
}

// ======================== Step Executors ========================

async function executeCommandStep(step, variables, sshConn, connectionId, emit) {
  let cmd = step.command;
  // Substitute variables
  for (const [key, value] of Object.entries(variables)) {
    cmd = cmd.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  emit('executing', { command: cmd });

  const result = await executeCommand(sshConn, cmd);

  // Log execution
  try {
    db.prepare(
      `INSERT INTO execution_log (connection_id, command, stdout, stderr, exit_code, started_at, completed_at, execution_time_ms, connection_time_ms, timed_out, truncated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      connectionId, result.command, result.stdout || '', result.stderr || '',
      result.code, result.startedAt, result.completedAt,
      result.executionTimeMs || 0, result.connectionTimeMs || 0,
      result.timedOut ? 1 : 0, result.truncated ? 1 : 0
    );
  } catch { /* don't fail */ }

  return {
    name: step.name,
    type: 'command',
    command: cmd,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.code,
    executionTimeMs: result.executionTimeMs,
    status: result.code === 0 ? 'success' : 'failed',
  };
}

async function executeSubPlaybook(step, parentVariables, sshConn, connectionId, options) {
  const subPlaybookId = step.playbook_id;
  if (!subPlaybookId) {
    return { name: step.name, type: 'invoke_playbook', status: 'error', error: 'playbook_id no especificado' };
  }

  // Merge variables: parent vars + step-specific overrides
  const mergedVars = { ...parentVariables, ...(step.variables || {}) };

  const result = await executePlaybook(subPlaybookId, connectionId, mergedVars, sshConn, {
    depth: (options.depth || 0) + 1,
    onEvent: (type, data) => {
      // Prefix sub-playbook events
      options.onEvent?.(`sub_${type}`, { parent_step: step.name, ...data });
    },
    auditorMode: options.auditorMode || 'none',
  });

  return {
    name: step.name,
    type: 'invoke_playbook',
    playbook_id: subPlaybookId,
    playbook_name: result.playbook,
    sub_run_id: result.runId,
    status: result.status,
    sub_steps: result.steps?.length || 0,
  };
}

async function executeMessageStep(step, variables, runId, stepIndex, emit) {
  let text = step.text || '';
  for (const [key, value] of Object.entries(variables)) {
    text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  // Record interaction (no pause needed for messages)
  db.prepare(
    'INSERT INTO playbook_run_interactions (run_id, step_index, interaction_type, prompt_text, title, style, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(runId, stepIndex, 'message', text, step.title || step.name, step.style || 'info', 'responded');

  emit('message_display', { title: step.title || step.name, text, style: step.style || 'info' });

  return { name: step.name, type: 'message', status: 'success', text };
}

async function executePromptStep(step, variables, runId, stepIndex, emit) {
  // Create pending interaction
  const interaction = db.prepare(
    'INSERT INTO playbook_run_interactions (run_id, step_index, interaction_type, prompt_text, variable_name, input_type, options, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(runId, stepIndex, 'prompt', step.text || '', step.variable_name || '', step.input_type || 'text', JSON.stringify(step.options || []), 'pending');
  const interactionId = interaction.lastInsertRowid;

  emit('prompt_request', {
    interactionId,
    text: step.text || step.name,
    variable_name: step.variable_name,
    input_type: step.input_type || 'text',
    options: step.options || [],
  });

  // Poll for response
  const response = await waitForInteractionResponse(interactionId);

  return {
    name: step.name,
    type: 'prompt',
    status: response ? 'success' : 'timed_out',
    response: response?.response,
    variable_name: step.variable_name,
  };
}

async function executeApprovalGate(step, runId, stepIndex, emit) {
  // Create pending interaction
  const interaction = db.prepare(
    'INSERT INTO playbook_run_interactions (run_id, step_index, interaction_type, prompt_text, status) VALUES (?, ?, ?, ?, ?)'
  ).run(runId, stepIndex, 'approval_gate', step.text || step.name, 'pending');
  const interactionId = interaction.lastInsertRowid;

  emit('approval_request', {
    interactionId,
    text: step.text || step.name,
  });

  // Update run as paused
  db.prepare('UPDATE playbook_runs SET paused_at = datetime("now"), paused_reason = ? WHERE id = ?')
    .run(step.text || step.name, runId);

  // Poll for response
  const response = await waitForInteractionResponse(interactionId);

  // Clear pause
  db.prepare('UPDATE playbook_runs SET paused_at = NULL, paused_reason = NULL WHERE id = ?').run(runId);

  const approved = response?.response === 'approve' || response?.response === 'approved';

  return {
    name: step.name,
    type: 'approval_gate',
    status: approved ? 'approved' : (response ? 'rejected' : 'timed_out'),
    response: response?.response,
  };
}

// ======================== Helpers ========================

function waitForInteractionResponse(interactionId) {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const poll = () => {
      const record = db.prepare('SELECT * FROM playbook_run_interactions WHERE id = ?').get(interactionId);

      if (record && record.status === 'responded') {
        resolve(record);
        return;
      }

      if (Date.now() - startTime > INTERACTION_TIMEOUT_MS) {
        // Timeout — mark as timed_out
        db.prepare('UPDATE playbook_run_interactions SET status = ? WHERE id = ?').run('timed_out', interactionId);
        resolve(null);
        return;
      }

      setTimeout(poll, INTERACTION_POLL_MS);
    };

    poll();
  });
}

import Anthropic from '@anthropic-ai/sdk';
import db from '../db.js';
import { getProfile } from './profiler.js';

const AUDITOR_PROMPT = `Eres un ingeniero de infraestructura senior actuando como auditor de seguridad y operaciones.

Tu trabajo es supervisar la ejecucion automatizada de playbooks en servidores de produccion. Para cada paso ejecutado, debes evaluar:

1. ¿El comando se ejecuto exitosamente? (exit code, output esperado)
2. ¿El output es el esperado para este tipo de operacion?
3. ¿Hay indicios de problemas de seguridad, rendimiento o estabilidad?
4. ¿Es seguro continuar con el siguiente paso?

REGLAS:
- Se conservador: ante la duda, emite 'warn' o 'halt'
- Comandos destructivos (rm, mkfs, dd, format, etc.) siempre deben ser 'halt' a menos que sean parte de un procedimiento de limpieza esperado
- Exit codes distintos de 0 requieren analisis del stderr
- Si el output muestra errores criticos del sistema, disco lleno, o servicios caidos: 'halt'
- Operaciones de solo lectura son generalmente seguras: 'continue'

FORMATO DE RESPUESTA (JSON estricto):
{
  "verdict": "continue" | "warn" | "halt",
  "reason": "Explicacion breve en espanol de tu decision",
  "risk_level": "low" | "medium" | "high" | "critical",
  "recommendations": "Recomendaciones opcionales"
}

Responde SOLO con el JSON.`;

function getApiKey() {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('anthropic_api_key');
  return row?.value;
}

function getAuditorModel() {
  // Use Haiku by default for speed and cost
  return 'claude-haiku-4-5-20251001';
}

/**
 * Audit a single playbook step after execution.
 *
 * @param {object} step - The step definition { name, command, type }
 * @param {object} stepResult - The execution result { stdout, stderr, exitCode, ... }
 * @param {object} context - { playbook, serverConnection, previousSteps, auditorMode }
 * @returns {{ verdict: string, reason: string, risk_level: string, recommendations: string }}
 */
export async function auditStep(step, stepResult, context = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { verdict: 'continue', reason: 'API key no configurada, omitiendo auditoria', risk_level: 'low', recommendations: '' };
  }

  // Build context for the auditor
  const profile = context.serverConnection ? getProfile(context.serverConnection) : null;

  let userMessage = `PLAYBOOK: ${context.playbook || 'desconocido'}\n`;
  if (profile) {
    userMessage += `SERVIDOR: ${profile.os_version || profile.distro || profile.os_family} (${profile.arch})\n`;
  }
  userMessage += `\nPASO EJECUTADO:\n`;
  userMessage += `- Nombre: ${step.name}\n`;
  userMessage += `- Comando: ${step.command || stepResult.command || 'N/A'}\n`;
  userMessage += `- Exit Code: ${stepResult.exitCode}\n`;
  userMessage += `- Status: ${stepResult.status}\n`;

  if (stepResult.stdout) {
    const truncated = stepResult.stdout.length > 2000 ? stepResult.stdout.substring(0, 2000) + '...[truncado]' : stepResult.stdout;
    userMessage += `\nSTDOUT:\n${truncated}\n`;
  }
  if (stepResult.stderr) {
    const truncated = stepResult.stderr.length > 1000 ? stepResult.stderr.substring(0, 1000) + '...[truncado]' : stepResult.stderr;
    userMessage += `\nSTDERR:\n${truncated}\n`;
  }

  if (context.previousSteps?.length > 0) {
    userMessage += `\nPASOS PREVIOS (${context.previousSteps.length}):\n`;
    for (const prev of context.previousSteps.slice(-5)) {
      userMessage += `- ${prev.name}: ${prev.status} (exit: ${prev.exitCode ?? 'N/A'})\n`;
    }
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: getAuditorModel(),
      max_tokens: 512,
      system: AUDITOR_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { verdict: 'continue', reason: 'Respuesta del auditor no parseable', risk_level: 'low', recommendations: '' };
    }

    const result = JSON.parse(jsonMatch[0]);
    return {
      verdict: result.verdict || 'continue',
      reason: result.reason || '',
      risk_level: result.risk_level || 'low',
      recommendations: result.recommendations || '',
    };
  } catch (err) {
    // On API error, don't block execution
    return {
      verdict: 'continue',
      reason: `Error del auditor: ${err.message}`,
      risk_level: 'low',
      recommendations: 'Revisar manualmente',
    };
  }
}

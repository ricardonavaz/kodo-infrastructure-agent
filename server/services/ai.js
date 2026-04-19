import Anthropic from '@anthropic-ai/sdk';
import db from '../db.js';
import { executeCommand } from './ssh.js';
import { getProfile } from './profiler.js';
import { getKnowledgeForPrompt } from './knowledge.js';
import { checkApproval } from '../routes/approval.js';
import { checkCommand as checkDirective, getDirectivesForPrompt } from './safety-directives.js';

function getApiKey() {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('anthropic_api_key');
  return row?.value;
}

function getDefaultModel() {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('default_model');
  return row?.value || 'claude-sonnet-4-20250514';
}

const MODEL_COSTS = {
  'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
  'claude-haiku-4-5-20251001': { input: 0.001, output: 0.005 },
  'claude-opus-4-20250514': { input: 0.015, output: 0.075 },
};

const HISTORY_WINDOW_SIZE = 20;
const MAX_TOOL_ITERATIONS = 10;

function estimateCost(model, inputTokens, outputTokens) {
  const costs = MODEL_COSTS[model] || MODEL_COSTS['claude-sonnet-4-20250514'];
  return ((inputTokens / 1000) * costs.input + (outputTokens / 1000) * costs.output).toFixed(6);
}

const DESTRUCTIVE_PATTERN = /\b(rm\s+-rf|mkfs|dd\s+if=|drop\s+(table|database)|truncate\s+table|format\s+|fdisk|shutdown|reboot|init\s+0|poweroff|systemctl\s+(stop|disable)|kill\s+-9|pkill|wipefs|Remove-Item\s+-Recurse|Stop-Service|Disable-NetAdapter|Clear-Disk|Format-Volume|Restart-Computer|Stop-Computer)\b/i;

const SYSTEM_PROMPT = `Eres "Kōdo", un agente de infraestructura experto en administración de servidores Linux y Windows.

REGLAS:
1. El usuario te habla en español. Siempre responde en español.
2. Cuando el usuario pida algo que requiera ejecutar comandos en el servidor, usa la herramienta execute_command.
3. Puedes ejecutar múltiples comandos en secuencia si es necesario.
4. Después de ejecutar comandos, explica los resultados de forma clara y concisa.
5. Si un comando es potencialmente destructivo, ADVIERTE al usuario antes de ejecutarlo y pide confirmación.
6. Formatea la salida de comandos en bloques de código cuando sea apropiado.
7. Si el usuario solo hace una pregunta de conocimiento general, responde sin ejecutar comandos.

SOPORTE WINDOWS:
- En servidores Windows, la shell es PowerShell via OpenSSH.
- SIEMPRE usa cmdlets de PowerShell, NUNCA comandos bash/linux.
- Ejemplos correctos para Windows:
  - Estado del sistema: Get-CimInstance Win32_OperatingSystem
  - Servicios: Get-Service | Where-Object {$_.Status -eq 'Running'}
  - Disco: Get-CimInstance Win32_LogicalDisk
  - Memoria: Get-CimInstance Win32_ComputerSystem | Select TotalPhysicalMemory
  - Updates: Get-WindowsUpdate (si PSWindowsUpdate está instalado) o (New-Object -ComObject Microsoft.Update.AutoUpdate)
  - Firewall: Get-NetFirewallProfile, Get-NetFirewallRule
  - Usuarios: Get-LocalUser
  - Procesos: Get-Process | Sort-Object CPU -Descending | Select -First 10
  - Logs: Get-EventLog -LogName System -Newest 20
  - Paquetes: Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*
- Para instalar software, usa winget, choco, o msi según disponibilidad.
- Para actualizaciones, considera Install-Module PSWindowsUpdate si no está instalado.

FORMATO DE RESPUESTA:
- Usa headers con ## para secciones principales
- Usa tablas markdown |col|col| cuando presentes datos tabulares
- Usa listas con - para detalles
- Usa **negrita** para valores clave y etiquetas
- Usa separadores --- entre secciones
- Usa emojis relevantes: ✅ ⚠️ ❌ 📊 💾 🔧 🛡️ 🔄 📡

ESTRUCTURA OBLIGATORIA de cada respuesta:
1. **Titulo** con emoji descriptivo (## 📊 Titulo)
2. **Cuerpo** con datos organizados en secciones, tablas y listas
3. **Separador** ---
4. **Sintesis** (SIEMPRE al final, 2-3 lineas máximo):
   ## 📌 Sintesis
   Resumen ejecutivo ultra-breve: qué se encontró, estado general, si requiere acción inmediata o no.
5. **Acciones sugeridas** en formato [ACTION: descripción corta] (2-3 máximo)

CONTEXTO: Estás conectado al servidor del usuario vía SSH. El sistema operativo es: {os_type}.`;

/**
 * Build the server-specific context string from profile, knowledge, and directives.
 * Pure function — receives resolved data, does not query the DB.
 * @param {string} osType - 'linux' or 'windows'
 * @param {object|null} profile - server profile from getProfile()
 * @param {string} knowledgeContext - result of getKnowledgeForPrompt()
 * @param {string} directivesContext - result of getDirectivesForPrompt()
 * @returns {string}
 */
export function buildServerContext(osType, profile, knowledgeContext, directivesContext) {
  let context = '';

  if (profile) {
    context += `\n\nPERFIL DEL SERVIDOR:
- OS: ${profile.os_version || profile.distro || profile.os_family || 'desconocido'}
- Familia OS: ${profile.os_family || 'desconocido'}
- Distro: ${profile.distro || 'N/A'}
- Kernel: ${profile.kernel_version || 'N/A'}
- Arch: ${profile.arch || 'N/A'}
- CPU: ${profile.cpu_info || 'N/A'}
- RAM: ${profile.total_memory_mb ? profile.total_memory_mb + ' MB' : 'N/A'}
- Disco: ${profile.total_disk_mb ? profile.total_disk_mb + ' MB' : 'N/A'}
- Package Manager: ${profile.package_manager || 'N/A'}
- Shell: ${profile.shell_version || 'N/A'}
- Init System: ${profile.init_system || 'N/A'}
- Rol: ${profile.role || 'no definido'}
${profile.custom_notes ? '- Notas: ' + profile.custom_notes : ''}
Usa el package manager correcto (${profile.package_manager}) y adapta los comandos a este SO especifico.`;

    // PowerShell version-specific rules
    if (profile.os_family === 'windows' && profile.shell_version) {
      const psMajor = parseInt(profile.shell_version);
      context += `\n\nVERSION DE POWERSHELL: ${profile.shell_version}`;
      if (psMajor >= 7) {
        context += `\nEste servidor tiene PowerShell 7+. Usa cmdlets modernos: Get-CimInstance, Invoke-RestMethod, ConvertTo-Json. Puedes usar operador ternario (?:), null-coalescing (??), pipeline parallelism (ForEach-Object -Parallel). Evita Get-WmiObject (deprecado).`;
      } else if (psMajor >= 5) {
        context += `\nEste servidor tiene PowerShell 5.x (Windows PowerShell). Get-CimInstance disponible y preferido. Get-WmiObject funciona pero es legacy. NO uses sintaxis de PS7: operador ternario (?:), null-coalescing (??), ForEach-Object -Parallel. Usa if/else en su lugar.`;
      } else if (psMajor >= 3) {
        context += `\nEste servidor tiene PowerShell 3.x/4.x. Usa Get-CimInstance cuando sea posible, pero Get-WmiObject es mas confiable. No uses Invoke-RestMethod avanzado. Sintaxis basica solamente.`;
      } else {
        context += `\nEste servidor tiene PowerShell legacy (2.x o anterior). SOLO usa Get-WmiObject, NO Get-CimInstance. No uses ConvertTo-Json, Invoke-RestMethod, ni cmdlets modernos. Usa .NET classes directamente cuando sea necesario. Comandos simples solamente.`;
      }
    }

    // Bash version context for Linux
    if (profile.os_family !== 'windows' && profile.shell_version && profile.shell_version !== 'unknown') {
      context += `\n\nVERSION DE BASH: ${profile.shell_version}`;
    }
  }

  if (knowledgeContext) context += knowledgeContext;
  if (directivesContext) context += directivesContext;

  return context;
}

/**
 * Build the system content blocks array with cache_control for prompt caching.
 * Single breakpoint: SYSTEM_PROMPT + serverContext concatenated.
 * @param {string} osType - 'linux' or 'windows'
 * @param {string} serverContext - result of buildServerContext()
 * @returns {Array} content blocks for the system parameter
 */
export function buildSystemBlocks(osType, serverContext) {
  const basePrompt = SYSTEM_PROMPT.replace('{os_type}', osType || 'linux');
  const fullText = serverContext ? basePrompt + serverContext : basePrompt;

  return [
    {
      type: 'text',
      text: fullText,
      cache_control: { type: 'ephemeral' },
    },
  ];
}

/**
 * Build the tools array with cache_control on the last tool for prompt caching.
 * @returns {Array} tools with cache_control on the last element
 */
export function buildCachedTools() {
  return [
    {
      name: 'execute_command',
      description: 'Ejecuta un comando en el servidor remoto via SSH.',
      input_schema: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'El comando a ejecutar en el servidor' },
        },
        required: ['command'],
      },
    },
    {
      name: 'query_server_history',
      description: 'Consulta la bitacora de eventos del servidor. Usa esto cuando el usuario pregunte sobre el historial de acciones, que se hizo antes, cuando fue la ultima actualizacion, etc.',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Tipo de busqueda: recent (ultimos 20), commands, security_scan, connection, all. O un texto para buscar.' },
          days: { type: 'number', description: 'Cuantos dias atras buscar (default 7)' },
        },
        required: ['query'],
      },
      cache_control: { type: 'ephemeral' },
    },
  ];
}

function logExecution(connectionId, result) {
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
}

/**
 * @param {object} connectionInfo
 * @param {string} userMessage
 * @param {array} history
 * @param {string|null} modelOverride
 * @param {function|null} onEvent - callback(type, data) for SSE streaming
 */
export async function chat(connectionInfo, userMessage, history = [], modelOverride = null, onEvent = null) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('API key no configurada. Ve a Configuracion para agregar tu clave de Anthropic.');
  }

  const model = modelOverride || connectionInfo.preferred_model || getDefaultModel();
  const client = new Anthropic({ apiKey });

  // Build system prompt with prompt caching (single breakpoint)
  const profile = getProfile(connectionInfo.id);
  const knowledgeContext = getKnowledgeForPrompt(connectionInfo.id) || '';
  const directivesContext = getDirectivesForPrompt(connectionInfo.os_type || 'linux') || '';
  const serverContext = buildServerContext(connectionInfo.os_type, profile, knowledgeContext, directivesContext);
  const systemBlocks = buildSystemBlocks(connectionInfo.os_type, serverContext);
  const cachedTools = buildCachedTools();

  // Sliding window: keep only the most recent messages
  const trimmedHistory = history.slice(-HISTORY_WINDOW_SIZE);
  const messages = [
    ...trimmedHistory.map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: userMessage },
  ];

  const emit = (type, data) => { try { onEvent?.(type, data); } catch { /* ignore */ } };

  // Retry wrapper for rate limits (429)
  async function apiCallWithRetry(params, maxRetries = 3) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await client.messages.create(params);
      } catch (err) {
        if (err.status === 429 && attempt < maxRetries) {
          const waitSec = Math.pow(2, attempt + 1) * 5; // 10s, 20s, 40s
          emit('thinking', { message: `Rate limit - reintentando en ${waitSec}s...`, model: params.model, apiCall: 0 });
          await new Promise((r) => setTimeout(r, waitSec * 1000));
          continue;
        }
        throw err;
      }
    }
  }

  const totalStart = Date.now();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheCreation = 0;
  let totalCacheRead = 0;
  let apiResponseTimeMs = 0;
  let apiCallCount = 0;

  // First API call
  emit('thinking', { message: `Enviando a ${model.split('-').slice(1, 3).join(' ')}...`, model, apiCall: ++apiCallCount });

  const apiStart = Date.now();
  let response = await apiCallWithRetry({
    model, max_tokens: 4096, system: systemBlocks, tools: cachedTools, messages,
  });
  apiResponseTimeMs += Date.now() - apiStart;
  totalInputTokens += response.usage?.input_tokens || 0;
  totalOutputTokens += response.usage?.output_tokens || 0;
  totalCacheCreation += response.usage?.cache_creation_input_tokens || 0;
  totalCacheRead += response.usage?.cache_read_input_tokens || 0;

  emit('ai_thinking_done', { apiCall: apiCallCount, responseTimeMs: Date.now() - apiStart, inputTokens: response.usage?.input_tokens, outputTokens: response.usage?.output_tokens, cacheCreation: response.usage?.cache_creation_input_tokens, cacheRead: response.usage?.cache_read_input_tokens });

  const commandResults = [];
  const executions = [];

  // Tool-use loop (max MAX_TOOL_ITERATIONS iterations)
  let toolIteration = 0;
  while (response.stop_reason === 'tool_use') {
    toolIteration++;

    if (toolIteration > MAX_TOOL_ITERATIONS) {
      emit('tool_limit', { message: `Limite de ${MAX_TOOL_ITERATIONS} iteraciones alcanzado. Abortando.`, iteration: toolIteration });
      break;
    }
    const assistantContent = response.content;
    const toolUseBlocks = assistantContent.filter((b) => b.type === 'tool_use');
    const textBlocks = assistantContent.filter((b) => b.type === 'text');

    // Emit any text Claude produced before tool calls
    for (const tb of textBlocks) {
      if (tb.text?.trim()) {
        emit('ai_text', { text: tb.text });
      }
    }

    const toolResults = [];

    for (let i = 0; i < toolUseBlocks.length; i++) {
      const toolUse = toolUseBlocks[i];
      if (toolUse.name === 'execute_command') {
        const cmd = toolUse.input.command;
        const isDestructive = DESTRUCTIVE_PATTERN.test(cmd);

        // Check safety directives BEFORE executing
        const directiveCheck = checkDirective(cmd, connectionInfo.os_type || 'linux');
        if (directiveCheck.blocked) {
          emit('directive_blocked', {
            command: cmd,
            violations: directiveCheck.violations,
            message: directiveCheck.message,
          });
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify({
              error: `COMANDO BLOQUEADO POR DIRECTRIZ DE SEGURIDAD: ${directiveCheck.message}. ${directiveCheck.violations.map((v) => v.description).join(' ')}`,
              blocked: true,
              directive: directiveCheck.violations[0]?.title,
            }),
            is_error: true,
          });
          continue;
        }
        if (directiveCheck.warnings.length > 0) {
          emit('directive_warning', {
            command: cmd,
            warnings: directiveCheck.warnings,
            message: directiveCheck.message,
          });
        }

        emit('tool_use', { command: cmd, index: i + 1, total: toolUseBlocks.length, isDestructive });
        emit('executing', { command: cmd, server: connectionInfo.name || connectionInfo.host });

        try {
          const result = await executeCommand(connectionInfo, cmd);
          commandResults.push(result);
          logExecution(connectionInfo.id, result);

          const execution = {
            command: cmd,
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.code,
            executionTimeMs: result.executionTimeMs,
            connectionTimeMs: result.connectionTimeMs,
            startedAt: result.startedAt,
            completedAt: result.completedAt,
            timedOut: result.timedOut,
            truncated: result.truncated,
            isDestructive,
          };
          executions.push(execution);

          emit('command_result', {
            command: cmd,
            exitCode: result.code,
            stdout: result.stdout?.substring(0, 2000),
            stderr: result.stderr?.substring(0, 500),
            executionTimeMs: result.executionTimeMs,
            connectionTimeMs: result.connectionTimeMs,
            timedOut: result.timedOut,
          });

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(result),
          });
        } catch (err) {
          emit('command_error', { command: cmd, error: err.message });
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify({ error: err.message }),
            is_error: true,
          });
        }
      } else if (toolUse.name === 'query_server_history') {
        emit('tool_use', { command: `[Consulta bitacora: ${toolUse.input.query}]`, index: i + 1, total: toolUseBlocks.length, isDestructive: false });
        try {
          const days = toolUse.input.days || 7;
          const query = toolUse.input.query;
          let events;
          if (['recent', 'all'].includes(query)) {
            events = db.prepare(
              `SELECT event_type, severity, title, command_executed, exit_code, created_at FROM server_events WHERE connection_id = ? AND created_at >= datetime('now', ?) ORDER BY created_at DESC LIMIT 30`
            ).all(connectionInfo.id, `-${days} days`);
          } else {
            events = db.prepare(
              `SELECT event_type, severity, title, command_executed, exit_code, created_at FROM server_events WHERE connection_id = ? AND (event_type = ? OR title LIKE ? OR command_executed LIKE ?) AND created_at >= datetime('now', ?) ORDER BY created_at DESC LIMIT 30`
            ).all(connectionInfo.id, query, `%${query}%`, `%${query}%`, `-${days} days`);
          }
          toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify({ events, count: events.length }) });
        } catch (err) {
          toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify({ error: err.message }), is_error: true });
        }
      }
    }

    messages.push({ role: 'assistant', content: assistantContent });
    messages.push({ role: 'user', content: toolResults });

    // On the last allowed iteration, inject a closure instruction
    if (toolIteration === MAX_TOOL_ITERATIONS) {
      messages.push({
        role: 'user',
        content: `IMPORTANTE: Has alcanzado el maximo de ${MAX_TOOL_ITERATIONS} iteraciones de herramientas. Responde al usuario ahora con un resumen final de lo que descubriste hasta este punto, incluso si no tienes toda la informacion deseada. No llames mas tools en esta respuesta.`,
      });
    }

    // Next API call
    emit('thinking', { message: 'Analizando resultados...', model, apiCall: ++apiCallCount });

    const loopStart = Date.now();
    response = await apiCallWithRetry({
      model, max_tokens: 4096, system: systemBlocks, tools: cachedTools, messages,
    });
    apiResponseTimeMs += Date.now() - loopStart;
    totalInputTokens += response.usage?.input_tokens || 0;
    totalOutputTokens += response.usage?.output_tokens || 0;
    totalCacheCreation += response.usage?.cache_creation_input_tokens || 0;
    totalCacheRead += response.usage?.cache_read_input_tokens || 0;

    emit('ai_thinking_done', { apiCall: apiCallCount, responseTimeMs: Date.now() - loopStart, inputTokens: response.usage?.input_tokens, outputTokens: response.usage?.output_tokens, cacheCreation: response.usage?.cache_creation_input_tokens, cacheRead: response.usage?.cache_read_input_tokens });
  }

  const totalLatencyMs = Date.now() - totalStart;

  const textResponse = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  emit('ai_response', { text: textResponse });

  const metrics = {
    model,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    cacheCreationTokens: totalCacheCreation,
    cacheReadTokens: totalCacheRead,
    responseTimeMs: apiResponseTimeMs,
    totalLatencyMs,
    estimatedCost: estimateCost(model, totalInputTokens, totalOutputTokens),
    apiCalls: apiCallCount,
  };

  emit('metrics', metrics);

  return { response: textResponse, commandResults, executions, metrics };
}

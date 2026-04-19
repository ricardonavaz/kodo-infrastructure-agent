/**
 * DIAGNOSTIC ONE-SHOT: Measure system prompt token sizes.
 *
 * Purpose: Measures char count and approximate token count of each
 * block in the system prompt (SYSTEM_PROMPT constant, server profile,
 * knowledge, directives) to evaluate prompt caching feasibility.
 *
 * When to use: Run manually when the system prompt grows (new blocks,
 * more directives) to verify it still meets cache token minimums
 * (1024 for Sonnet/Opus, 2048 for Haiku).
 *
 * Run from server/: node scripts/measure-prompt.js
 * Requires: at least 1 connection in the SQLite DB.
 */
import db from '../db.js';
import { getProfile } from '../services/profiler.js';
import { getKnowledgeForPrompt } from '../services/knowledge.js';
import { getDirectivesForPrompt } from '../services/safety-directives.js';

// Approximate token count: chars / 4 (conservative for English/Spanish mixed text)
function approxTokens(text) {
  return Math.ceil(text.length / 4);
}

// The exact SYSTEM_PROMPT constant from ai.js lines 32-77
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

// Tool definitions from ai.js lines 164-188
const TOOLS_JSON = JSON.stringify([
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
  },
]);

// Find first connection with a profile
const conn = db.prepare('SELECT c.*, sp.connection_id as has_profile FROM connections c LEFT JOIN server_profiles sp ON c.id = sp.connection_id LIMIT 1').get();

if (!conn) {
  console.log('No hay conexiones en la BD. No se puede medir.');
  process.exit(0);
}

console.log(`\nServidor: ${conn.name} (${conn.host}) | OS: ${conn.os_type}`);
console.log('='.repeat(70));

// Block 1: SYSTEM_PROMPT constant with os_type replaced
const block1 = SYSTEM_PROMPT.replace('{os_type}', conn.os_type || 'linux');

// Block 2: Server profile
const profile = getProfile(conn.id);
let profileBlock = '';
if (profile) {
  profileBlock = `\n\nPERFIL DEL SERVIDOR:
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

  // PowerShell/Bash version
  if (profile.os_family === 'windows' && profile.shell_version) {
    const psMajor = parseInt(profile.shell_version);
    profileBlock += `\n\nVERSION DE POWERSHELL: ${profile.shell_version}`;
    if (psMajor >= 7) {
      profileBlock += `\nEste servidor tiene PowerShell 7+. Usa cmdlets modernos: Get-CimInstance, Invoke-RestMethod, ConvertTo-Json. Puedes usar operador ternario (?:), null-coalescing (??), pipeline parallelism (ForEach-Object -Parallel). Evita Get-WmiObject (deprecado).`;
    } else if (psMajor >= 5) {
      profileBlock += `\nEste servidor tiene PowerShell 5.x (Windows PowerShell). Get-CimInstance disponible y preferido. Get-WmiObject funciona pero es legacy. NO uses sintaxis de PS7: operador ternario (?:), null-coalescing (??), ForEach-Object -Parallel. Usa if/else en su lugar.`;
    }
  } else if (profile.os_family !== 'windows' && profile.shell_version && profile.shell_version !== 'unknown') {
    profileBlock += `\n\nVERSION DE BASH: ${profile.shell_version}`;
  }
}

// Block 3: Knowledge
const knowledgeBlock = getKnowledgeForPrompt(conn.id) || '';

// Block 4: Directives
const directivesBlock = getDirectivesForPrompt(conn.os_type || 'linux') || '';

// Composed blocks
const serverContext = profileBlock + knowledgeBlock + directivesBlock;
const fullPrompt = block1 + serverContext;

// Results
console.log('\n  Bloque                        | Chars  | Tokens aprox');
console.log('  ------------------------------|--------|------------');
console.log(`  SYSTEM_PROMPT (constante)     | ${block1.length.toString().padStart(6)} | ${approxTokens(block1).toString().padStart(10)}`);
console.log(`  Perfil del servidor           | ${profileBlock.length.toString().padStart(6)} | ${approxTokens(profileBlock).toString().padStart(10)}`);
console.log(`  Conocimiento (knowledge)      | ${knowledgeBlock.length.toString().padStart(6)} | ${approxTokens(knowledgeBlock).toString().padStart(10)}`);
console.log(`  Directrices de seguridad      | ${directivesBlock.length.toString().padStart(6)} | ${approxTokens(directivesBlock).toString().padStart(10)}`);
console.log('  ------------------------------|--------|------------');
console.log(`  Server context (2+3+4)        | ${serverContext.length.toString().padStart(6)} | ${approxTokens(serverContext).toString().padStart(10)}`);
console.log(`  TOTAL system prompt           | ${fullPrompt.length.toString().padStart(6)} | ${approxTokens(fullPrompt).toString().padStart(10)}`);
console.log(`  Tools (JSON)                  | ${TOOLS_JSON.length.toString().padStart(6)} | ${approxTokens(TOOLS_JSON).toString().padStart(10)}`);

console.log('\n  Umbrales de cache:');
console.log(`  - Haiku: 2048 tokens minimo`);
console.log(`  - Sonnet/Opus: 1024 tokens minimo`);

const totalTokens = approxTokens(fullPrompt);
console.log(`\n  Bloque 1 solo (SYSTEM_PROMPT):    ${approxTokens(block1)} tokens → ${approxTokens(block1) >= 2048 ? '✅ cacheable para Haiku' : approxTokens(block1) >= 1024 ? '⚠️  cacheable solo para Sonnet/Opus' : '❌ muy corto para cache'}`);
console.log(`  Bloque 1+2 (+ server context):    ${totalTokens} tokens → ${totalTokens >= 2048 ? '✅ cacheable para Haiku' : totalTokens >= 1024 ? '⚠️  cacheable solo para Sonnet/Opus' : '❌ muy corto para cache'}`);

console.log('\n  Recomendacion:');
if (approxTokens(block1) >= 2048) {
  console.log('  → Usar 2 breakpoints (SYSTEM_PROMPT separado de server context)');
} else if (totalTokens >= 2048) {
  console.log('  → Usar 1 solo breakpoint (SYSTEM_PROMPT + server context juntos)');
} else if (totalTokens >= 1024) {
  console.log('  → Usar 1 solo breakpoint, pero solo cacheable bajo Sonnet/Opus (no Haiku)');
} else {
  console.log('  → ⚠️  Prompt total demasiado corto para cachear en cualquier modelo');
}

console.log('');
process.exit(0);

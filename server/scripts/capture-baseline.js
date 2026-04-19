/**
 * DIAGNOSTIC ONE-SHOT: Capture system prompt baseline for fixture testing.
 *
 * Purpose: Generates the exact system prompt that ai.js would build
 * for the first connection in the DB, and saves it as a fixture file
 * at services/__tests__/fixtures/system-prompt-baseline.txt.
 * The fixture is used by ai-cache.test.js to verify that refactors
 * to the prompt construction produce identical output.
 *
 * When to use: Run manually after changing the system prompt structure,
 * profile format, or knowledge/directives injection logic. Then update
 * the regression test if the change is intentional.
 *
 * Run from server/: node scripts/capture-baseline.js
 * Requires: at least 1 connection with a profile in the SQLite DB.
 */
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db from '../db.js';
import { getProfile } from '../services/profiler.js';
import { getKnowledgeForPrompt } from '../services/knowledge.js';
import { getDirectivesForPrompt } from '../services/safety-directives.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Exact copy of SYSTEM_PROMPT from ai.js lines 32-77
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

// Build system prompt exactly like ai.js does
const conn = db.prepare('SELECT * FROM connections LIMIT 1').get();
if (!conn) { console.error('No connections in DB'); process.exit(1); }

let systemPrompt = SYSTEM_PROMPT.replace('{os_type}', conn.os_type || 'linux');

const profile = getProfile(conn.id);
if (profile) {
  systemPrompt += `\n\nPERFIL DEL SERVIDOR:
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

  if (profile.os_family === 'windows' && profile.shell_version) {
    const psMajor = parseInt(profile.shell_version);
    systemPrompt += `\n\nVERSION DE POWERSHELL: ${profile.shell_version}`;
    if (psMajor >= 7) {
      systemPrompt += `\nEste servidor tiene PowerShell 7+. Usa cmdlets modernos: Get-CimInstance, Invoke-RestMethod, ConvertTo-Json. Puedes usar operador ternario (?:), null-coalescing (??), pipeline parallelism (ForEach-Object -Parallel). Evita Get-WmiObject (deprecado).`;
    } else if (psMajor >= 5) {
      systemPrompt += `\nEste servidor tiene PowerShell 5.x (Windows PowerShell). Get-CimInstance disponible y preferido. Get-WmiObject funciona pero es legacy. NO uses sintaxis de PS7: operador ternario (?:), null-coalescing (??), ForEach-Object -Parallel. Usa if/else en su lugar.`;
    } else if (psMajor >= 3) {
      systemPrompt += `\nEste servidor tiene PowerShell 3.x/4.x. Usa Get-CimInstance cuando sea posible, pero Get-WmiObject es mas confiable. No uses Invoke-RestMethod avanzado. Sintaxis basica solamente.`;
    } else {
      systemPrompt += `\nEste servidor tiene PowerShell legacy (2.x o anterior). SOLO usa Get-WmiObject, NO Get-CimInstance. No uses ConvertTo-Json, Invoke-RestMethod, ni cmdlets modernos. Usa .NET classes directamente cuando sea necesario. Comandos simples solamente.`;
    }
  }

  if (profile.os_family !== 'windows' && profile.shell_version && profile.shell_version !== 'unknown') {
    systemPrompt += `\n\nVERSION DE BASH: ${profile.shell_version}`;
  }
}

const knowledgeContext = getKnowledgeForPrompt(conn.id);
if (knowledgeContext) systemPrompt += knowledgeContext;

const directivesContext = getDirectivesForPrompt(conn.os_type || 'linux');
if (directivesContext) systemPrompt += directivesContext;

const outPath = join(__dirname, '../services/__tests__/fixtures/system-prompt-baseline.txt');
fs.writeFileSync(outPath, systemPrompt, 'utf8');
console.log(`Baseline captured: ${outPath}`);
console.log(`Length: ${systemPrompt.length} chars, ~${Math.ceil(systemPrompt.length / 4)} tokens`);
console.log(`Server: ${conn.name} (${conn.host}) | OS: ${conn.os_type}`);
process.exit(0);

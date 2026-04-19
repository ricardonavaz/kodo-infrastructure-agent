# Changelog

Todos los cambios relevantes de Kodo Infrastructure Agent.

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---

## [1.0.0] - 2026-04-14

### Release inicial

#### Funcionalidades principales
- **Conexiones SSH** — CRUD de servidores con cifrado AES-256-GCM de credenciales
- **Chat con agente IA** — Conversacion en espanol con Claude (Haiku/Sonnet/Opus) para administracion de servidores
- **Ejecucion de comandos** — Tool-use loop automatico que genera y ejecuta comandos SSH
- **Streaming en tiempo real** — SSE para chat con eventos: thinking, executing, command_result, ai_response
- **Auto-profiling** — Inventario automatico del servidor al primera conexion (22 comandos Linux, 20+ Windows)
- **Sesiones de trabajo** — Tracking de actividad con contadores y resumen automatico al desconectar
- **Playbooks** — 8 playbooks integrados + creacion custom + generacion con Opus
- **Scheduler** — Tareas cron automatizadas por servidor o grupo
- **Knowledge Base** — Aprendizaje automatico de exitos/fallos por OS + importacion de documentos
- **Perfiles de servidor** — Inventario completo con campos manuales (rol, responsable, SLA, notas)
- **Auditoria de seguridad** — Escaneo de vulnerabilidades con scoring 0-100
- **Gestion de actualizaciones** — Deteccion y aplicacion de updates (apt, yum, dnf, pacman, zypper)
- **Grupos de servidores** — Agrupacion con colores para organizacion
- **Perfiles de aprobacion** — 3 perfiles builtin (solo lectura, monitoreo, mantenimiento)
- **Exportacion** — Reportes en HTML/Markdown/texto con opcion de enriquecimiento IA
- **Acciones iniciales** — 8 acciones rapidas por conexion
- **Seleccion inteligente de modelo** — Routing automatico Haiku/Sonnet/Opus segun tarea

#### Stack
- Backend: Express.js, Node.js (ES modules)
- Frontend: React 18.3, Vite
- Database: SQLite3 (better-sqlite3, WAL mode)
- IA: Anthropic Claude SDK
- SSH: node-ssh
- Cifrado: AES-256-GCM, PBKDF2-SHA512 (600K iter), Keychain macOS

#### Base de datos
- 17 migraciones, ~20 tablas
- Auto-backup antes de migraciones (ultimos 5)
- WAL mode para concurrencia
- Foreign keys con ON DELETE CASCADE

---

## [1.3.0] - 2026-04-14

### Interfaz Semantica Interactiva

#### Agregado
- **Motor de parsing semantico** (`semantic-parser.js`) — Convierte respuestas de texto del agente en bloques tipados (data_table, metric_block, finding, question_prompt, recommendation, code_block, summary_card, execution_step)
- **Sistema de bloques React** — 9 componentes especializados en `client/src/components/blocks/`
- **SmartMessage.jsx** — Orquestador que renderiza bloques semanticos con fallback a markdown
- **MetricBlock** — KPI cards con progress bars y color por umbral (verde/ambar/rojo)
- **DataTable** — Tablas interactivas sortables y filtrables
- **Finding** — Cards de hallazgos con severidad, impacto, evidencia y remediacion
- **QuestionPrompt** — Preguntas convertidas en botones/select/input interactivos
- **Recommendation** — Cards de recomendacion con prioridad y boton ejecutar
- **SummaryCard** — Resumen ejecutivo con status dot y highlights
- **ExecutionStep** — Pasos de ejecucion colapsables con exit code y duration
- **CodeBlock** — Bloques de codigo con toolbar (copiar/ejecutar)
- **ContextActions** — Menu contextual por bloque (copiar, explicar, profundizar, ejecutar)
- **BlockAssistant** — Asistente IA contextual inline que explica/analiza cualquier bloque usando Haiku
- **Endpoint /explain** — `POST /api/agent/:connectionId/explain` para explicaciones contextuales
- **Auto-tagging** — Etiquetado automatico de respuestas (linux, windows, seguridad, rendimiento, etc.)
- **CSS .sb-*** — Sistema completo de estilos para bloques semanticos

#### Archivos nuevos
- `server/services/semantic-parser.js`
- `client/src/utils/formatMessage.js`
- `client/src/components/SmartMessage.jsx`
- `client/src/components/blocks/` (9 componentes)
- `client/src/components/ContextActions.jsx`
- `client/src/components/BlockAssistant.jsx`

---

## [1.2.0] - 2026-04-14

### Playbooks Avanzados

#### Agregado
- **Editor visual de playbooks** — Interfaz drag & drop para crear/editar pasos con configuracion por tipo
- **5 tipos de paso** — command (existente), invoke_playbook, message, prompt, approval_gate
- **Sub-playbooks** — Un playbook puede invocar otro como paso, con herencia de variables y limite de profundidad (max 5)
- **Pasos interactivos** — message (mostrar info), prompt (solicitar input), approval_gate (pedir aprobacion)
- **Agente auditor IA** — Segundo agente Claude (Haiku) que supervisa la ejecucion y puede detenerla
- **Modos de auditor** — none, audit_log (solo registra), supervised (aprueba/rechaza)
- **Ejecucion con SSE streaming** — `POST /playbooks/:id/execute-stream` para seguimiento en tiempo real
- **API de interacciones** — Endpoints para responder a prompts y approval gates durante ejecucion
- **Servicio playbook-executor.js** — Motor de ejecucion extraido y expandido
- **Servicio auditor.js** — Agente auditor como servicio independiente
- **Migracion 019** — Columnas auditor_mode, execution_mode, max_sub_depth en playbooks + tabla playbook_run_interactions

#### Archivos nuevos
- `server/services/playbook-executor.js`
- `server/services/auditor.js`
- `client/src/components/PlaybookEditor.jsx`
- `server/migrations/019_advanced_playbook_steps.js`

---

## [1.1.0] - 2026-04-14

### Profile & OS Detection

#### Agregado
- **Deteccion de version de PowerShell** — Se persiste en `shell_version` y se muestra en el profile
- **Deteccion de version de Bash** — Nuevo comando en profiler para Linux
- **Auto-deteccion de OS type** — Intenta `uname` y `$PSVersionTable` para determinar Linux vs Windows automaticamente
- **Override manual de OS** — El usuario puede editar os_family, os_version, distro y shell_version desde el profile
- **Prompt adaptado a version de PS** — Reglas especificas por version (PS 2.x usa Get-WmiObject, PS 5.x usa Get-CimInstance, PS 7+ usa cmdlets modernos)

#### Mejorado
- **Mas distribuciones Linux** — Amazon Linux, Alpine, Oracle Linux, Rocky, AlmaLinux, Kali, Linux Mint, Raspberry Pi OS
- **Mas versiones Windows** — Server 2008/2008R2, 2012/2012R2, 2025
- **ProfileViewer** — Muestra version de shell, seccion de override de OS editable

#### Archivos modificados
- `server/services/profiler.js` — Deteccion expandida + auto-detect + shell_version
- `server/routes/profiles.js` — PUT acepta os_family, os_version, distro, shell_version
- `server/services/ai.js` — System prompt con version de PS y reglas por version
- `client/src/components/ProfileViewer.jsx` — UI actualizada
- `server/migrations/018_profile_shell_info.js` — Nueva columna shell_version

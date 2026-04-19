# Arquitectura del Sistema

## Vision General

Kodo sigue una arquitectura cliente-servidor clasica con tres capas principales:

```
┌─────────────────────────────────────────────────────┐
│                   CLIENTE (React/Vite)               │
│  ┌──────────┐ ┌──────────┐ ┌───────────────────┐   │
│  │ Sidebar  │ │ Terminal │ │ Modales/Managers  │   │
│  │ (servers)│ │ (chat)   │ │ (playbooks,etc)   │   │
│  └────┬─────┘ └────┬─────┘ └────────┬──────────┘   │
│       └─────────────┼────────────────┘               │
│                     │ useApi.js (fetch + SSE)         │
└─────────────────────┼───────────────────────────────┘
                      │ HTTP / SSE
┌─────────────────────┼───────────────────────────────┐
│                 SERVIDOR (Express.js)                │
│  ┌──────────────────┼──────────────────────┐        │
│  │            15 Routers REST              │        │
│  │  connections | agent | settings | ...   │        │
│  └──────────────────┼──────────────────────┘        │
│  ┌──────────────────┼──────────────────────┐        │
│  │           Capa de Servicios             │        │
│  │  ai | ssh | profiler | scheduler | ...  │        │
│  └──────┬───────────┼──────────────┬───────┘        │
│         │           │              │                │
│    ┌────┴────┐ ┌────┴────┐  ┌─────┴─────┐         │
│    │ SQLite  │ │  SSH    │  │ Claude AI │         │
│    │ (WAL)   │ │ (pool)  │  │ (Anthropic)│         │
│    └─────────┘ └─────────┘  └───────────┘         │
└─────────────────────────────────────────────────────┘
```

## Capas del Sistema

### 1. Frontend (Client)

**Tecnologia:** React 18.3 + Vite
**Puerto:** 5173 (desarrollo)
**Estilo:** CSS vanilla con variables custom (dark theme, verde neon #00ff41)
**Fuentes:** JetBrains Mono (codigo), Inter (texto)

**Componentes principales:**
- `App.jsx` — Estado global: conexiones, sesiones, modos de UI
- `Sidebar.jsx` — Lista de servidores con favoritos, status, acciones
- `SplitView.jsx` — Layout dos paneles (servidores + chat/contenido)
- `Terminal.jsx` — Interfaz de chat + panel de ejecucion
- `ExecutionPanel.jsx` — Output de comandos en tiempo real

**Comunicacion con backend:**
- `useApi.js` — Cliente API centralizado con `fetch()` y SSE (`EventSource`)
- Todas las llamadas pasan por `request(path, options)` que maneja JSON y errores
- Streaming via SSE para chat de agente (jobs con eventos en tiempo real)

### 2. Backend (Server)

**Tecnologia:** Express.js con ES modules
**Puerto:** 3001 (configurable via `PORT`)
**Base de datos:** SQLite3 con better-sqlite3

**Entry point (`index.js`):**
- Configura CORS y JSON parser (limite 10MB)
- Monta 15 routers en `/api/*`
- Endpoint de health: `GET /api/health`
- Inicia scheduler de tareas cron
- Manejo de errores no capturados (excepto EADDRINUSE)

### 3. Capa de Servicios

| Servicio | Archivo | Responsabilidad |
|---|---|---|
| AI Chat | `services/ai.js` | Motor de chat con Claude, tool-use loop, streaming SSE |
| SSH | `services/ssh.js` | Pool de conexiones SSH, ejecucion de comandos |
| Crypto | `services/crypto.js` | Cifrado AES-256-GCM, master key, Keychain macOS |
| Profiler | `services/profiler.js` | Inventario de servidores (22 cmds Linux, 20+ Windows) |
| Scheduler | `services/scheduler.js` | Ejecucion de tareas cron cada minuto |
| Knowledge | `services/knowledge.js` | Aprendizaje automatico por OS, importacion de docs |
| Model Router | `services/model-router.js` | Seleccion inteligente de modelo Claude |
| Security | `services/security.js` | Auditoria de seguridad del servidor |
| Updates | `services/updates.js` | Deteccion y aplicacion de actualizaciones |

### 4. Capa de Datos

**Base de datos:** SQLite3 (`server/kodo.db`)
- Modo WAL (Write-Ahead Logging) para concurrencia
- Foreign keys habilitadas
- Auto-backup antes de migraciones (ultimos 5)
- Checkpoint WAL en shutdown graceful

**Sistema de migraciones:**
- Archivos en `server/migrations/` numerados (`001_base_schema.js` ... `017_security_events.js`)
- Cada archivo exporta `up(db)` que recibe la instancia de better-sqlite3
- Se ejecutan automaticamente al iniciar el servidor
- Tracking en tabla `schema_migrations`
- Transacciones atomicas por migracion

## Flujos de Datos Principales

### Flujo de Chat con Agente IA

```
1. Usuario escribe mensaje en Terminal.jsx
2. useApi.chatStream() → POST /api/agent/:connId/chat
3. Servidor crea job en active_jobs, responde con jobId
4. Cliente conecta a SSE: GET /api/agent/:connId/jobs/:jobId/stream
5. Servidor envía mensaje a Claude API con:
   - System prompt (reglas + perfil del servidor + knowledge)
   - Historial de conversacion
   - Tools disponibles: execute_command, query_server_history
6. Claude responde con tool_use → ejecuta comando via SSH
7. Resultado del comando se envia de vuelta a Claude
8. Loop continua hasta que Claude responde con texto final
9. Eventos SSE emitidos: thinking, tool_use, executing, command_result, ai_response, metrics
10. Resultado guardado en chat_history + audit_log + execution_log
```

### Flujo de Conexion a Servidor

```
1. Usuario crea conexion (ConnectionForm.jsx → POST /api/connections)
2. Credenciales cifradas con master key si esta desbloqueada
3. Usuario conecta → POST /api/connections/:id/connect
4. SSH establecido via node-ssh → conexion agregada al pool
5. Auto-profiling del servidor (22 comandos para Linux, 20+ para Windows)
6. Sesion de trabajo creada automaticamente
7. Briefing generado si es primera conexion
8. Chat habilitado
```

### Flujo de Ejecucion de Playbooks

```
1. Usuario selecciona playbook y servidor
2. POST /api/playbooks/:id/execute con connectionId + variables
3. Se crea registro en playbook_runs
4. Para cada paso del command_sequence:
   a. Sustituir variables {{var}} por valores
   b. Ejecutar comando via SSH
   c. Registrar resultado (stdout, stderr, exitCode, timing)
   d. Si falla → marcar como partial_failure, continuar o parar
5. Actualizar playbook_runs con status final y step_results
```

## Modelo de Seleccion de Modelos IA

| Modelo | Uso | Costo relativo |
|---|---|---|
| claude-haiku-4-5 | Default: consultas generales, monitoreo | Bajo |
| claude-sonnet-4 | Tareas complejas, modificaciones de sistema | Medio |
| claude-opus-4 | Generacion de playbooks, planificacion compleja | Alto |

La seleccion se basa en:
- Tipo de tarea detectado via regex (maintenance, diagnostic, deployment, etc.)
- Longitud del mensaje del usuario
- Override manual del usuario via ModelSelector

## Motor Semantico (v1.3.0+)

### Arquitectura de Rendering

```
ai.js chat() → { response: "markdown text", executions }
  → semantic-parser.js parseSemanticBlocks(text, executions)
  → result.blocks = [ { type, data, actions }, ... ]
  → agent.js broadcastToJob('done', result)
  → Terminal.jsx → SmartMessage.jsx
  → Block components tipados con interaccion
```

### Flujo de datos semántico

1. El agente IA genera una respuesta en texto markdown
2. `semantic-parser.js` analiza el texto linea por linea y lo clasifica en bloques tipados
3. Cada bloque tiene: `id`, `type`, `title`, `tags`, `severity`, `actions`, y campos especificos por tipo
4. El array de bloques se agrega al resultado del job y se envia via SSE
5. `SmartMessage.jsx` recibe los bloques y renderiza el componente correcto para cada tipo
6. Si no hay bloques (mensajes antiguos), se usa `formatMessage()` como fallback

### Tipos de bloque semantico

| Tipo | Componente | Origen |
|------|-----------|--------|
| `text_block` | TextBlock | Parrafos, headers, listas markdown |
| `data_table` | DataTable | Tablas markdown → sortable/filtrable |
| `metric_block` | MetricBlock | Metricas detectadas (CPU 85%, RAM 2048 MB) |
| `finding` | Finding | Advertencias, errores, hallazgos con severidad |
| `question_prompt` | QuestionPrompt | Preguntas → botones/select interactivos |
| `recommendation` | Recommendation | Recomendaciones con prioridad y accion |
| `code_block` | CodeBlock | Bloques de codigo con copy/ejecutar |
| `summary_card` | SummaryCard | Seccion Sintesis → resumen ejecutivo |
| `execution_step` | ExecutionStep | Comandos ejecutados con output |

### Asistente IA contextual

Cada bloque puede solicitar explicacion/analisis via `POST /api/agent/:connectionId/explain`. El asistente usa Claude Haiku con el contexto del bloque y la sesion para responder preguntas como: que significa, por que importa, como resolver, generar comando.

### Auto-tagging

El parser detecta automaticamente tags por contenido: linux, windows, seguridad, rendimiento, almacenamiento, red, servicios, updates, error, warning.

## Seguridad

- **Cifrado de credenciales:** AES-256-GCM con master key derivada via PBKDF2-SHA512 (600K iteraciones)
- **Keychain macOS:** Opcion de almacenar master key en Keychain del sistema para auto-unlock
- **Deteccion de comandos destructivos:** Regex pattern en ai.js advierte antes de rm -rf, mkfs, etc.
- **Perfiles de aprobacion:** Reglas basadas en regex para auto-aprobar ciertos tipos de comandos
- **Sanitizacion de logs:** Middleware redacta passwords, tokens, API keys de los logs

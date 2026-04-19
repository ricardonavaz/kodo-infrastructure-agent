# Referencia de API

**Base URL:** `http://localhost:3001/api`
**Content-Type:** `application/json`
**Limite de body:** 10MB

---

## Health Check

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/health` | Estado del servidor |

**Respuesta:** `{ status: "ok", name: "Kodo Infrastructure Agent" }`

---

## Conexiones (`/connections`)

### Listar conexiones
```
GET /connections?search=&environment=&tags=&status=&favorite=&group_id=
```
**Query params:** Todos opcionales. `search` busca en name, host, tags, description. `favorite` acepta `1` o `true`.
**Respuesta:** `[{ id, name, host, port, username, auth_type, os_type, environment, tags, description, notes, is_favorite, status, last_connection_at, last_validation_result, created_at }]`

### Obtener conexion
```
GET /connections/:id
```
**Respuesta:** Objeto conexion | **404** si no existe

### Crear conexion
```
POST /connections
```
**Body:**
| Campo | Tipo | Requerido | Default |
|-------|------|-----------|---------|
| name | string | Si | — |
| host | string | Si | — |
| username | string | Si | — |
| port | number | No | 22 |
| auth_type | string | No | "password" |
| credentials | string | No | "" |
| os_type | string | No | "linux" |
| environment | string | No | "production" |
| tags | string[] | No | [] |
| description | string | No | "" |
| is_favorite | boolean | No | false |
| key_path | string | No | "" |
| key_passphrase | string | No | "" |

**Respuesta:** Conexion creada (201) | **400** campos faltantes | **409** duplicado (mismo host+port+username)

### Actualizar conexion
```
PUT /connections/:id
```
**Body:** Mismos campos que POST, todos opcionales. Credenciales usan COALESCE (no se borran si no se envian).
**Respuesta:** Conexion actualizada | **404** no existe

### Eliminar conexion
```
DELETE /connections/:id
```
**Respuesta:** `{ success: true }` | **404** no existe

### Probar conexion
```
POST /connections/:id/test
```
**Respuesta:** `{ success: boolean, output?: string, error?: string }`
Actualiza `last_validation_result` y `status` en DB.

### Conectar a servidor
```
POST /connections/:id/connect
```
**Respuesta exitosa:**
```json
{
  "success": true,
  "message": "Conexion establecida",
  "output": "usuario@hostname",
  "host": "...", "port": 22, "username": "...",
  "sessionId": "uuid",
  "firstConnection": true,
  "briefing": "markdown...",
  "profile": { "os_family", "os_version", "package_manager", "distro" }
}
```
**Respuesta fallida:** `{ success: false, error: "...", host, port }`
- Auto-genera perfil del servidor si es primera conexion
- Crea sesion de trabajo automaticamente

### Desconectar
```
POST /connections/:id/disconnect
```
**Respuesta:** `{ success: true, message: "Desconectado", sessionSummary: "..." }`
Cierra sesion de trabajo activa con resumen.

### Estado de conexion
```
GET /connections/:id/status
```
**Respuesta:** `{ id, status: "connected" | "disconnected" }`

### Estado de todas las conexiones
```
GET /connections/status/all
```
**Respuesta:** `{ [id]: "connected" | "disconnected" }`

### Toggle favorito
```
PUT /connections/:id/favorite
```
**Respuesta:** `{ id, is_favorite: 0 | 1 }`

---

## Agente IA (`/agent`)

### Iniciar chat
```
POST /agent/:connectionId/chat
```
**Body:**
| Campo | Tipo | Requerido |
|-------|------|-----------|
| message | string | Si |
| model | string | No |
| session_id | string | No |

**Respuesta:** `{ jobId: "uuid" }`
Inicia job asincrono. Conectar a SSE para recibir eventos.

### Stream de eventos SSE
```
GET /agent/:connectionId/jobs/:jobId/stream
```
**Tipo:** Server-Sent Events (text/event-stream)
**Eventos emitidos:**
- `thinking` — `{ message, model, apiCall }`
- `ai_thinking_done` — `{ apiCall, responseTimeMs, inputTokens, outputTokens }`
- `tool_use` — `{ command, index, total, isDestructive }`
- `executing` — `{ command, server }`
- `command_result` — `{ command, exitCode, stdout, stderr, executionTimeMs }`
- `command_error` — `{ command, error }`
- `ai_text` — `{ text }`
- `ai_response` — `{ text }` (respuesta final)
- `metrics` — `{ model, inputTokens, outputTokens, responseTimeMs, totalLatencyMs, estimatedCost, apiCalls }`
- `done` — `{ response, commandResults, executions, metrics }`
- `error` — `{ message }`

### Jobs activos
```
GET /agent/:connectionId/jobs/active
```
**Respuesta:** `[{ id, status, events, created_at }]`

### Detalle de job
```
GET /agent/:connectionId/jobs/:jobId
```
**Respuesta:** `{ id, status, events, result, error, created_at }`

### Cancelar job
```
POST /agent/:connectionId/jobs/:jobId/cancel
```
**Respuesta:** `{ success: true }`

### Historial de chat
```
GET /agent/:connectionId/history
```
**Respuesta:** `[{ id, connection_id, role, content, model, tokens_input, tokens_output, response_time_ms, created_at }]`

### Ejecuciones
```
GET /agent/:connectionId/executions?limit=50&offset=0
```
**Respuesta:** `[{ id, connection_id, command, stdout, stderr, exit_code, execution_time_ms, ... }]`

### Limpiar historial
```
DELETE /agent/:connectionId/history
```
**Respuesta:** `{ success: true, deleted: number }`

### Explicacion contextual de bloque semantico
```
POST /agent/:connectionId/explain
```
**Body:**
| Campo | Tipo | Requerido |
|-------|------|-----------|
| blockType | string | Si |
| blockData | object | Si |
| action | string | No (default: "explain") |
| context | string | No |

**Acciones soportadas:** `explain`, `deepen`, `impact`, `fix`, `simplify`, `compare`
**Respuesta:** `{ explanation: string, tokens: { input, output } }`
Usa Claude Haiku para velocidad y bajo costo.

---

## Configuracion (`/settings`)

### Obtener configuracion
```
GET /settings
```
**Respuesta:** `[{ key, value }]` — Valores sensibles enmascarados (sk-ant-***...)

### Actualizar configuracion
```
PUT /settings
```
**Body:** `{ anthropic_api_key?: string, default_model?: string }`
**Respuesta:** `{ success: true }`

### Estado de master key
```
GET /settings/master-key/status
```
**Respuesta:** `{ isSetup, isUnlocked, keychainAvailable, keychainConfigured }`

### Configurar master key
```
POST /settings/master-key/setup
```
**Body:** `{ password: string (min 8), useKeychain?: boolean }`
**Respuesta:** `{ success: true }` | **400** password corta | **409** ya configurada

### Desbloquear master key
```
POST /settings/master-key/unlock
```
**Body:** `{ password: string }`
**Respuesta:** `{ success: true }` | **400** no configurada | **401** password incorrecta

### Bloquear master key
```
POST /settings/master-key/lock
```
**Respuesta:** `{ success: true }`

### Cifrar todas las credenciales
```
POST /settings/connections/encrypt-all
```
**Respuesta:** `{ success: true, encrypted: number }` | **400** master key bloqueada

---

## Grupos de Servidores (`/groups`)

### Listar grupos
```
GET /groups
```
**Respuesta:** `[{ id, name, type, description, color, member_count }]`

### Obtener grupo
```
GET /groups/:id
```
**Respuesta:** `{ id, name, type, description, color, members: [{ id, name, host, port, os_type, environment, status }] }` | **404**

### Crear grupo
```
POST /groups
```
**Body:** `{ name: string (req), type?, description?, color? }`
**Respuesta:** Grupo creado (201) | **400** name faltante | **409** nombre duplicado

### Actualizar grupo
```
PUT /groups/:id
```
**Body:** `{ name?, type?, description?, color? }`
**Respuesta:** Grupo actualizado | **404**

### Eliminar grupo
```
DELETE /groups/:id
```
**Respuesta:** `{ success: true }` | **404**

### Agregar miembro
```
POST /groups/:id/members
```
**Body:** `{ connection_id: number }`
**Respuesta:** `{ success: true }` | **400** connection_id faltante | **409** duplicado

### Remover miembro
```
DELETE /groups/:id/members/:connectionId
```
**Respuesta:** `{ success: true }`

---

## Auditoria (`/audit`)

### Listar registros
```
GET /audit?connection_id=&from=&to=&task_type=&status=&search=&limit=50&offset=0
```
**Respuesta:** `{ records: [audit_log], total: number }`

### Obtener registro
```
GET /audit/:id
```
**Respuesta:** Objeto audit_log | **404**

### Estadisticas
```
GET /audit/stats/summary
```
**Respuesta:** `{ total, successRate, avgDurationMs, modelUsage: [], taskTypes: [], byDay: [] }`

### Exportar
```
GET /audit/export/data?format=json|csv&connection_id=&from=&to=
```
**Respuesta:** CSV o JSON segun formato solicitado

---

## Playbooks (`/playbooks`)

### Listar playbooks
```
GET /playbooks?category=&system=
```
**Respuesta:** `[{ id, name, description, objective, compatible_systems, command_sequence, category, is_builtin, ... }]`

### Obtener playbook
```
GET /playbooks/:id
```
**Respuesta:** Objeto playbook | **404**

### Crear playbook
```
POST /playbooks
```
**Body:**
| Campo | Tipo | Requerido |
|-------|------|-----------|
| name | string | Si |
| description | string | No |
| objective | string | No |
| compatible_systems | string[] | No (default: ["linux"]) |
| command_sequence | object[] | No (default: []) |
| category | string | No (default: "custom") |
| preconditions | string[] | No |
| required_variables | object[] | No |
| success_criteria | string[] | No |
| rollback_commands | object[] | No |
| auditor_mode | string | No (default: "none") |
| execution_mode | string | No (default: "sequential") |
| max_sub_depth | number | No (default: 5) |

**Respuesta:** Playbook creado (201) | **400** name faltante

### Actualizar playbook
```
PUT /playbooks/:id
```
**Body:** Mismos campos opcionales
**Respuesta:** Playbook actualizado | **404** | **403** si es builtin

### Eliminar playbook
```
DELETE /playbooks/:id
```
**Respuesta:** `{ success: true }` | **404** | **403** si es builtin

### Ejecutar playbook
```
POST /playbooks/:id/execute
```
**Body:** `{ connectionId: number (req), variables?: object, executionMode?: string, auditorMode?: string }`
**Respuesta:**
```json
{
  "runId": 1,
  "playbook": "Health Check General",
  "status": "success" | "partial_failure" | "error" | "aborted",
  "steps": [{
    "name": "...", "type": "command",
    "command": "...", "stdout": "...", "stderr": "...",
    "exitCode": 0, "executionTimeMs": 150,
    "status": "success" | "failed" | "error"
  }]
}
```

### Ejecutar playbook con SSE streaming
```
POST /playbooks/:id/execute-stream
```
**Body:** Igual que execute
**Tipo:** Server-Sent Events (text/event-stream)
**Eventos:** step_start, step_result, step_error, executing, message_display, prompt_request, approval_request, auditor_verdict, playbook_start, playbook_complete, done, error, ping

### Detalle de run
```
GET /playbooks/runs/:runId
```
**Respuesta:** Objeto playbook_runs con `interactions: []` | **404**

### Interacciones de un run
```
GET /playbooks/runs/:runId/interactions
```
**Respuesta:** `[{ id, run_id, step_index, interaction_type, prompt_text, status, response, ... }]`

### Responder a interaccion
```
POST /playbooks/runs/:runId/interactions/:interactionId/respond
```
**Body:** `{ response: string }` (para prompts el valor, para approval_gate "approve" o "reject")
**Respuesta:** `{ success: true }` | **404** | **400** si ya respondida

### Historial de ejecuciones
```
GET /playbooks/:id/runs
```
**Respuesta:** `[{ id, playbook_id, connection_id, started_at, completed_at, status, variables_used, step_results }]` (limit 50)

### Generar playbook con IA
```
POST /playbooks/generate
```
**Body:** `{ objective: string (req), connectionId?: number }`
**Respuesta:** `{ playbook: {...}, metrics: { model, inputTokens, outputTokens } }`
Usa Claude Opus para generar playbook completo basado en objetivo.

---

## Scheduler (`/scheduler`)

### Listar tareas
```
GET /scheduler
```
**Respuesta:** `[{ id, name, description, cron_expression, connection_id, group_id, playbook_id, command, task_type, enabled, ... }]`

### Obtener tarea
```
GET /scheduler/:id
```
**Respuesta:** Objeto scheduled_tasks | **404**

### Crear tarea
```
POST /scheduler
```
**Body:**
| Campo | Tipo | Requerido | Default |
|-------|------|-----------|---------|
| name | string | Si | — |
| cron_expression | string | Si | — |
| description | string | No | "" |
| connection_id | number | No | null |
| group_id | number | No | null |
| playbook_id | number | No | null |
| command | string | No | null |
| task_type | string | No | "command" |
| retry_count | number | No | 0 |
| retry_delay_ms | number | No | 30000 |
| timeout_ms | number | No | 60000 |

**Respuesta:** Tarea creada (201) | **400** name o cron faltante

### Actualizar tarea
```
PUT /scheduler/:id
```
**Body:** Campos opcionales
**Respuesta:** Tarea actualizada | **404**

### Eliminar tarea
```
DELETE /scheduler/:id
```
**Respuesta:** `{ success: true }`

### Toggle habilitado/deshabilitado
```
PUT /scheduler/:id/toggle
```
**Respuesta:** `{ id, enabled: boolean }` | **404**

### Ejecutar ahora
```
POST /scheduler/:id/run-now
```
**Respuesta:** `{ success: true, message: "..." }` | **404**

### Historial de ejecuciones
```
GET /scheduler/:id/runs?limit=50&offset=0
```
**Respuesta:** `[{ task_id, started_at, completed_at, status, output, error }]`

### Templates predefinidos
```
GET /scheduler/templates/list
```
**Respuesta:** `[{ name, cron, description, command?, task_type?, playbook_hint? }]`

---

## Actualizaciones (`/updates`)

### Detectar actualizaciones
```
POST /updates/check/:connectionId
```
**Respuesta:** `{ id, osFamily, updateMechanism, pendingCount, updates: [], criticalCount, requiresReboot }` | **404** | **500**

### Estado de actualizaciones (servidor)
```
GET /updates/status/:connectionId
```
**Respuesta:** `{ pendingCount, status, ... }` o `{ pendingCount: 0, status: "unknown" }`

### Estado global
```
GET /updates/status
```
**Respuesta:** `[{ connection_id, os_family, update_mechanism, pending_count, ... }]`

### Aplicar actualizaciones
```
POST /updates/apply/:connectionId
```
**Body:** `{ updateNames?: string[], applyAll?: boolean }`
**Respuesta:** `{ success, requiresReboot, output }` | **404** | **400** sin check previo | **500**

### Historial
```
GET /updates/history/:connectionId
```
**Respuesta:** `{ checks: [], executions: [] }`

### Dashboard resumen
```
GET /updates/dashboard/summary
```
**Respuesta:** `[{ connectionId, connectionName, host, osType, lastCheck, pendingCount, criticalCount, osFamily, lastSuccess, lastFailure }]`

---

## Sesiones de Trabajo (`/sessions`)

### Iniciar sesion
```
POST /sessions/:connectionId/start
```
**Respuesta:** `{ sessionId: "uuid", existing: boolean }` | **404**

### Finalizar sesion
```
POST /sessions/:sessionId/end
```
**Respuesta:** `{ summary, duration }` | **404**

### Sesion activa
```
GET /sessions/:connectionId/active
```
**Respuesta:** Objeto work_sessions o `null`

### Historial de sesiones
```
GET /sessions/:connectionId/history
```
**Respuesta:** `[{ id, connection_id, status, started_at, ... }]` (limit 50)

### Detalle de sesion
```
GET /sessions/detail/:sessionId
```
**Respuesta:** `{ id, connection_id, ..., changelog: [] }` | **404**

---

## Perfiles de Servidor (`/profiles`)

### Listar perfiles
```
GET /profiles
```
**Respuesta:** `[{ ...server_profiles, connection_name, host }]`

### Obtener perfil
```
GET /profiles/:connectionId
```
**Respuesta:** Objeto server_profiles o `null`

### Actualizar campos manuales
```
PUT /profiles/:connectionId
```
**Body:** `{ role?, responsible?, sla_level?, custom_notes?, custom_tags?, maintenance_window?, os_family?, os_version?, distro?, shell_version? }`
**Respuesta:** Perfil actualizado | **404**

### Re-escanear servidor
```
POST /profiles/:connectionId/refresh
```
**Respuesta:** Perfil actualizado | **404** | **500**

---

## Base de Conocimiento (`/knowledge`)

### Listar entradas
```
GET /knowledge?os_family=&os_version=&category=&outcome=&source=&search=&limit=50
```
**Respuesta:** `[{ id, os_family, os_version, category, action_name, command_sequence, outcome, tags, success_count, ... }]`

### Obtener entrada
```
GET /knowledge/:id
```
**Respuesta:** Objeto knowledge_entries | **404**

### Crear entrada manual
```
POST /knowledge
```
**Body:** `{ action_name: string (req), os_family?, os_version?, category?, command_sequence?, outcome?, outcome_details?, tags? }`
**Respuesta:** Entrada creada (201) | **400**

### Actualizar entrada
```
PUT /knowledge/:id
```
**Body:** `{ action_name?, category?, outcome?, outcome_details?, resolution?, tags? }`
**Respuesta:** Entrada actualizada | **404**

### Eliminar entrada
```
DELETE /knowledge/:id
```
**Respuesta:** `{ success: true }`

### Listar documentos
```
GET /knowledge/documents/list?os_family=&category=
```
**Respuesta:** `[{ id, title, source_type, source_path, os_family, os_version, category, tags, file_size, imported_at }]`

### Importar documento (archivo)
```
POST /knowledge/documents/upload
```
**Body:** `{ filePath: string (req), title?, os_family?, os_version?, category?, tags? }`
**Respuesta:** Resultado de importacion | **400** | **500**

### Importar documento (URL)
```
POST /knowledge/documents/url
```
**Body:** `{ url: string (req), title?, os_family?, os_version?, category?, tags? }`
**Respuesta:** Resultado de importacion | **400** | **500**

### Buscar en documentos
```
POST /knowledge/documents/search
```
**Body:** `{ query: string (req), os_family? }`
**Respuesta:** Resultados de busqueda | **400**

### Eliminar documento
```
DELETE /knowledge/documents/:id
```
**Respuesta:** `{ success: true }`

---

## Perfiles de Aprobacion (`/approval`)

### Listar perfiles
```
GET /approval/profiles
```
**Respuesta:** `[{ id, name, description, connection_id, rules, is_builtin, enabled, ... }]`

### Crear perfil
```
POST /approval/profiles
```
**Body:** `{ name: string (req), description?, connection_id?, rules?: [] }`
**Respuesta:** Perfil creado (201) | **400**

### Actualizar perfil
```
PUT /approval/profiles/:id
```
**Body:** `{ name?, description?, rules? }`
**Respuesta:** Perfil actualizado | **404**

### Toggle habilitado
```
PUT /approval/profiles/:id/toggle
```
**Respuesta:** `{ id, enabled: boolean }` | **404**

### Eliminar perfil
```
DELETE /approval/profiles/:id
```
**Respuesta:** `{ success: true }` | **404** | **403** si es builtin

### Verificar comando
```
POST /approval/check
```
**Body:** `{ command: string (req), connectionId?, sessionId? }`
**Respuesta:** `{ decision: "approved" | "denied" | "manual", profile?, risk_level }`

### Log de decisiones
```
GET /approval/log?session_id=&connection_id=&limit=50
```
**Respuesta:** `[{ id, profile_id, session_id, connection_id, command, decision, risk_level, reason, created_at }]`

---

## Acciones Iniciales (`/initial-actions`)

### Obtener acciones
```
GET /initial-actions/:connectionId
```
**Respuesta:** `[{ id, connection_id, os_family, label, prompt, icon, category, sort_order, enabled }]`
Filtra por os_family del servidor y solo retorna habilitadas.

### Crear accion
```
POST /initial-actions
```
**Body:** `{ label: string (req), prompt: string (req), connection_id?, os_family?, icon?, category?, sort_order? }`
**Respuesta:** Accion creada (201) | **400**

### Eliminar accion
```
DELETE /initial-actions/:id
```
**Respuesta:** `{ success: true }`

---

## Exportacion (`/export`)

### Exportar sesion
```
GET /export/session/:sessionId?format=html|md|txt
```
**Respuesta:** HTML, Markdown o texto plano de la sesion completa

### Exportar perfil de servidor
```
GET /export/profile/:connectionId?format=html|md|txt
```
**Respuesta:** Dashboard HTML, Markdown o texto del perfil

### Exportar mensaje individual
```
POST /export/message
```
**Body:** `{ content: string (req), metrics?, serverName?, format? }`
**Respuesta:** HTML, Markdown o texto del mensaje

### Exportacion mejorada con IA
```
POST /export/enhanced
```
**Body:** `{ content: string (req), metrics?, serverName?, connectionId?, format? }`
**Respuesta:** Reporte enriquecido por Claude Haiku | **400** sin contenido o API key

---

## Seguridad (`/security`)

### Ejecutar auditoria
```
POST /security/audit/:connectionId
```
**Respuesta:** Resultado de auditoria de seguridad | **404** | **500**

### Ultimo reporte
```
GET /security/report/:connectionId
```
**Respuesta:** `{ score, lastScan, report }` o `{ score: null, message: "Sin auditorias previas" }`

### Eventos de seguridad
```
GET /security/events/:connectionId?days=7&event_type=&severity=&limit=100
```
**Respuesta:** `[{ id, connection_id, event_type, severity, details, created_at, ... }]`

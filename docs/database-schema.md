# Schema de Base de Datos

**Motor:** SQLite3 (better-sqlite3)
**Modo:** WAL (Write-Ahead Logging)
**Foreign Keys:** Habilitadas
**Ubicacion:** `server/kodo.db`

---

## Meta: schema_migrations

Tracking de migraciones aplicadas.

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| version | INTEGER PK | Numero de migracion |
| name | TEXT NOT NULL | Nombre del archivo |
| applied_at | TEXT | Timestamp de aplicacion |

---

## connections (001)

Servidores SSH registrados.

| Columna | Tipo | Default | Descripcion |
|---------|------|---------|-------------|
| id | INTEGER PK AUTO | — | ID unico |
| name | TEXT NOT NULL | — | Nombre descriptivo |
| host | TEXT NOT NULL | — | Hostname o IP |
| port | INTEGER | 22 | Puerto SSH |
| username | TEXT NOT NULL | — | Usuario SSH |
| auth_type | TEXT | 'password' | Tipo: password o key |
| credentials | TEXT | — | Password o clave privada (puede estar cifrada) |
| os_type | TEXT | 'linux' | Sistema operativo: linux o windows |
| created_at | TEXT | datetime('now') | Fecha de creacion |

**Campos agregados en migraciones posteriores:**
- `environment` TEXT DEFAULT 'production' (002)
- `tags` TEXT DEFAULT '[]' (002)
- `description` TEXT DEFAULT '' (002)
- `notes` TEXT DEFAULT '' (002)
- `is_favorite` INTEGER DEFAULT 0 (002)
- `status` TEXT DEFAULT 'unknown' (002)
- `last_connection_at` TEXT (002)
- `last_validation_result` TEXT (002)
- `key_path` TEXT DEFAULT '' (004)
- `key_passphrase` TEXT DEFAULT '' (004)
- `credentials_encrypted` INTEGER DEFAULT 0 (004)
- `preferred_model` TEXT (005)

---

## settings (001)

Configuracion global key-value.

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| key | TEXT PK | Clave de configuracion |
| value | TEXT | Valor |

**Keys conocidas:** `anthropic_api_key`, `default_model`, `master_key_hash`, `master_key_salt`

---

## chat_history (001)

Historial de conversaciones con el agente IA.

| Columna | Tipo | Default | Descripcion |
|---------|------|---------|-------------|
| id | INTEGER PK AUTO | — | ID unico |
| connection_id | INTEGER NOT NULL | — | FK → connections |
| role | TEXT NOT NULL | — | 'user' o 'assistant' |
| content | TEXT NOT NULL | — | Contenido del mensaje |
| model | TEXT | — | Modelo usado |
| tokens_input | INTEGER | 0 | Tokens de entrada |
| tokens_output | INTEGER | 0 | Tokens de salida |
| response_time_ms | INTEGER | 0 | Latencia de respuesta |
| created_at | TEXT | datetime('now') | Timestamp |

**FK:** connection_id → connections(id) ON DELETE CASCADE

---

## server_groups (003)

Grupos logicos de servidores.

| Columna | Tipo | Default | Descripcion |
|---------|------|---------|-------------|
| id | INTEGER PK AUTO | — | ID unico |
| name | TEXT NOT NULL UNIQUE | — | Nombre del grupo |
| type | TEXT | 'custom' | Tipo de grupo |
| description | TEXT | '' | Descripcion |
| color | TEXT | '#00ff41' | Color del grupo |
| created_at | TEXT | datetime('now') | Timestamp |

---

## server_group_members (003)

Relacion many-to-many entre grupos y conexiones.

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | INTEGER PK AUTO | ID unico |
| group_id | INTEGER NOT NULL | FK → server_groups |
| connection_id | INTEGER NOT NULL | FK → connections |
| added_at | TEXT | datetime('now') |

**Constraint:** UNIQUE(group_id, connection_id)
**FKs:** Ambas con ON DELETE CASCADE

---

## execution_log (006)

Registro de comandos ejecutados via SSH.

| Columna | Tipo | Default | Descripcion |
|---------|------|---------|-------------|
| id | INTEGER PK AUTO | — | ID unico |
| connection_id | INTEGER NOT NULL | — | FK → connections |
| command | TEXT NOT NULL | — | Comando ejecutado |
| stdout | TEXT | '' | Salida estandar |
| stderr | TEXT | '' | Error estandar |
| exit_code | INTEGER | — | Codigo de salida |
| started_at | TEXT | — | Inicio de ejecucion |
| completed_at | TEXT | — | Fin de ejecucion |
| execution_time_ms | INTEGER | 0 | Duracion en ms |
| connection_time_ms | INTEGER | 0 | Tiempo de conexion |
| timed_out | INTEGER | 0 | 1 si timeout |
| truncated | INTEGER | 0 | 1 si output truncado |

---

## audit_log (007)

Bitacora de tareas del agente IA.

| Columna | Tipo | Default | Descripcion |
|---------|------|---------|-------------|
| id | INTEGER PK AUTO | — | ID unico |
| connection_id | INTEGER | — | FK → connections |
| session_id | TEXT | — | ID de sesion |
| user_prompt | TEXT | — | Mensaje del usuario |
| task_type | TEXT | 'general' | Tipo de tarea |
| model_used | TEXT | — | Modelo Claude usado |
| commands_executed | TEXT | '[]' | Lista JSON de comandos |
| commands_output | TEXT | '[]' | Lista JSON de outputs |
| final_response | TEXT | — | Respuesta final del agente |
| final_status | TEXT | 'unknown' | Estado final |
| tokens_input | INTEGER | 0 | Tokens entrada total |
| tokens_output | INTEGER | 0 | Tokens salida total |
| total_latency_ms | INTEGER | 0 | Latencia total |
| estimated_cost | REAL | 0 | Costo estimado USD |
| started_at | TEXT | datetime('now') | Inicio |
| completed_at | TEXT | — | Fin |

---

## playbooks (008)

Automatizaciones reutilizables.

| Columna | Tipo | Default | Descripcion |
|---------|------|---------|-------------|
| id | INTEGER PK AUTO | — | ID unico |
| name | TEXT NOT NULL | — | Nombre del playbook |
| description | TEXT | '' | Descripcion |
| objective | TEXT | '' | Objetivo |
| compatible_systems | TEXT | '["linux"]' | OS compatibles JSON |
| preconditions | TEXT | '[]' | Precondiciones JSON |
| required_variables | TEXT | '[]' | Variables requeridas JSON |
| command_sequence | TEXT NOT NULL | '[]' | Pasos JSON: [{name, command}] |
| pre_validations | TEXT | '[]' | Validaciones previas JSON |
| success_criteria | TEXT | '[]' | Criterios de exito JSON |
| rollback_commands | TEXT | '[]' | Comandos de rollback JSON |
| error_handling | TEXT | '{}' | Manejo de errores JSON |
| required_permissions | TEXT | '[]' | Permisos requeridos JSON |
| is_builtin | INTEGER | 0 | 1 si es integrado |
| category | TEXT | 'custom' | Categoria |
| created_at | TEXT | datetime('now') | Creacion |
| updated_at | TEXT | datetime('now') | Ultima modificacion |

**Categorias:** monitoring, maintenance, diagnostic, security, deployment, configuration, custom

---

## playbook_runs (008)

Historial de ejecuciones de playbooks.

| Columna | Tipo | Default | Descripcion |
|---------|------|---------|-------------|
| id | INTEGER PK AUTO | — | ID unico |
| playbook_id | INTEGER NOT NULL | — | FK → playbooks |
| connection_id | INTEGER NOT NULL | — | FK → connections |
| started_at | TEXT | datetime('now') | Inicio |
| completed_at | TEXT | — | Fin |
| status | TEXT | 'running' | Estado: running, success, partial_failure, error |
| variables_used | TEXT | '{}' | Variables usadas JSON |
| step_results | TEXT | '[]' | Resultados por paso JSON |
| error | TEXT | — | Error si fallo |

**FKs:** playbook_id, connection_id ambas con ON DELETE CASCADE

---

## scheduled_tasks (009)

Tareas programadas con cron.

| Columna | Tipo | Default | Descripcion |
|---------|------|---------|-------------|
| id | INTEGER PK AUTO | — | ID unico |
| name | TEXT NOT NULL | — | Nombre de la tarea |
| description | TEXT | '' | Descripcion |
| cron_expression | TEXT NOT NULL | — | Expresion cron (5 campos) |
| connection_id | INTEGER | — | FK → connections |
| group_id | INTEGER | — | FK → server_groups |
| playbook_id | INTEGER | — | FK → playbooks (si task_type=playbook) |
| command | TEXT | — | Comando directo (si task_type=command) |
| task_type | TEXT | 'command' | command o playbook |
| time_window_start | TEXT | — | Hora inicio ventana |
| time_window_end | TEXT | — | Hora fin ventana |
| retry_count | INTEGER | 0 | Reintentos en fallo |
| retry_delay_ms | INTEGER | 30000 | Delay entre reintentos |
| timeout_ms | INTEGER | 60000 | Timeout por ejecucion |
| enabled | INTEGER | 1 | 1 si activa |
| last_run_at | TEXT | — | Ultima ejecucion |
| last_run_status | TEXT | — | Estado ultima ejecucion |
| created_at | TEXT | datetime('now') | Creacion |

---

## scheduled_task_runs (009)

Historial de ejecuciones de tareas programadas.

| Columna | Tipo | Default | Descripcion |
|---------|------|---------|-------------|
| id | INTEGER PK AUTO | — | ID unico |
| task_id | INTEGER NOT NULL | — | FK → scheduled_tasks |
| connection_id | INTEGER | — | FK → connections |
| started_at | TEXT | datetime('now') | Inicio |
| completed_at | TEXT | — | Fin |
| status | TEXT | 'running' | Estado |
| output | TEXT | '' | Salida del comando/playbook |
| error | TEXT | '' | Error si fallo |
| duration_ms | INTEGER | 0 | Duracion |
| retry_attempt | INTEGER | 0 | Intento actual |

---

## update_checks (010)

Deteccion de actualizaciones pendientes.

| Columna | Tipo | Default | Descripcion |
|---------|------|---------|-------------|
| id | INTEGER PK AUTO | — | ID unico |
| connection_id | INTEGER NOT NULL | — | FK → connections |
| os_family | TEXT | — | Familia de OS detectada |
| update_mechanism | TEXT | — | apt, yum, dnf, etc. |
| pending_count | INTEGER | 0 | Cantidad pendiente |
| critical_count | INTEGER | 0 | Criticas pendientes |
| updates_json | TEXT | '[]' | Lista de updates JSON |
| requires_reboot | INTEGER | 0 | 1 si requiere reinicio |
| checked_at | TEXT | datetime('now') | Fecha de check |

---

## update_executions (010)

Historial de aplicacion de actualizaciones.

| Columna | Tipo | Default | Descripcion |
|---------|------|---------|-------------|
| id | INTEGER PK AUTO | — | ID unico |
| connection_id | INTEGER NOT NULL | — | FK → connections |
| updates_applied | TEXT | '[]' | Updates aplicados JSON |
| command_used | TEXT | — | Comando ejecutado |
| output | TEXT | '' | Salida |
| success | INTEGER | 0 | 1 si exitoso |
| requires_reboot | INTEGER | 0 | 1 si requiere reinicio |
| applied_at | TEXT | datetime('now') | Fecha |

---

## active_jobs (011)

Jobs de IA en ejecucion.

| Columna | Tipo | Default | Descripcion |
|---------|------|---------|-------------|
| id | TEXT PK | — | UUID del job |
| connection_id | INTEGER NOT NULL | — | FK → connections |
| status | TEXT | 'running' | running, completed, error, cancelled |
| events | TEXT | '[]' | Eventos SSE acumulados JSON |
| result | TEXT | — | Resultado final JSON |
| error | TEXT | — | Error si fallo |
| created_at | TEXT | datetime('now') | Creacion |
| completed_at | TEXT | — | Finalizacion |

---

## work_sessions (012)

Sesiones de trabajo por conexion.

| Columna | Tipo | Default | Descripcion |
|---------|------|---------|-------------|
| id | TEXT PK | — | UUID de sesion |
| connection_id | INTEGER NOT NULL | — | FK → connections |
| status | TEXT | 'active' | active o completed |
| started_at | TEXT | datetime('now') | Inicio |
| ended_at | TEXT | — | Fin |
| summary | TEXT | '' | Resumen de la sesion |
| total_commands | INTEGER | 0 | Comandos ejecutados |
| successful_commands | INTEGER | 0 | Exitosos |
| failed_commands | INTEGER | 0 | Fallidos |
| total_duration_ms | INTEGER | 0 | Duracion total |
| changes_log | TEXT | '[]' | Log de cambios JSON |

---

## server_profiles (013)

Inventario automatico de servidores.

| Columna | Tipo | Default | Descripcion |
|---------|------|---------|-------------|
| id | INTEGER PK AUTO | — | ID unico |
| connection_id | INTEGER NOT NULL UNIQUE | — | FK → connections |
| os_family | TEXT | — | linux, debian, rhel, windows, etc. |
| os_version | TEXT | — | Version completa del OS |
| distro | TEXT | — | Distribucion especifica |
| kernel_version | TEXT | — | Version de kernel |
| arch | TEXT | — | Arquitectura (x86_64, arm64) |
| cpu_info | TEXT | — | Info de CPU |
| total_memory_mb | INTEGER | — | RAM total en MB |
| total_disk_mb | INTEGER | — | Disco total en MB |
| disk_layout | TEXT | '[]' | Layout de discos |
| package_manager | TEXT | — | Gestor de paquetes |
| init_system | TEXT | — | systemd, sysvinit, windows_services |
| installed_services | TEXT | '[]' | Servicios JSON |
| installed_packages | TEXT | '[]' | Paquetes JSON |
| open_ports | TEXT | '[]' | Puertos abiertos JSON |
| role | TEXT | '' | Rol del servidor |
| responsible | TEXT | '' | Responsable |
| sla_level | TEXT | '' | Nivel de SLA |
| custom_notes | TEXT | '' | Notas operativas |
| custom_tags | TEXT | '[]' | Tags personalizados JSON |
| maintenance_window | TEXT | '' | Ventana de mantenimiento |
| last_profiled_at | TEXT | — | Ultimo escaneo |
| created_at | TEXT | datetime('now') | Creacion |

**Campos agregados posteriormente:**
- `security_score` INTEGER (017)
- `last_security_scan` TEXT (017)

**FK:** connection_id → connections(id) ON DELETE CASCADE

---

## knowledge_entries (014)

Base de conocimiento auto-aprendida.

| Columna | Tipo | Default | Descripcion |
|---------|------|---------|-------------|
| id | INTEGER PK AUTO | — | ID unico |
| os_family | TEXT | — | Familia de OS |
| os_version | TEXT | — | Version de OS |
| category | TEXT | 'other' | Categoria de la accion |
| action_name | TEXT NOT NULL | — | Nombre de la accion |
| command_sequence | TEXT | '[]' | Comandos usados JSON |
| outcome | TEXT | — | success o failure |
| outcome_details | TEXT | '' | Detalles del resultado |
| resolution | TEXT | '' | Resolucion si fallo |
| source | TEXT | 'auto' | auto o manual |
| tags | TEXT | '[]' | Tags JSON |
| success_count | INTEGER | 0 | Veces exitosas |
| failure_count | INTEGER | 0 | Veces fallidas |
| last_used_at | TEXT | datetime('now') | Ultimo uso |
| created_at | TEXT | datetime('now') | Creacion |

---

## knowledge_documents (014)

Documentos importados a la base de conocimiento.

| Columna | Tipo | Default | Descripcion |
|---------|------|---------|-------------|
| id | INTEGER PK AUTO | — | ID unico |
| title | TEXT NOT NULL | — | Titulo |
| content | TEXT | '' | Contenido parseado |
| source_type | TEXT | — | file, url |
| source_path | TEXT | — | Ruta o URL original |
| os_family | TEXT | — | OS al que aplica |
| os_version | TEXT | — | Version de OS |
| category | TEXT | 'general' | Categoria |
| tags | TEXT | '[]' | Tags JSON |
| file_size | INTEGER | 0 | Tamano del archivo |
| imported_at | TEXT | datetime('now') | Fecha de importacion |

---

## approval_profiles (015)

Perfiles de aprobacion automatica de comandos.

| Columna | Tipo | Default | Descripcion |
|---------|------|---------|-------------|
| id | INTEGER PK AUTO | — | ID unico |
| name | TEXT NOT NULL | — | Nombre del perfil |
| description | TEXT | '' | Descripcion |
| connection_id | INTEGER | null | FK opcional → connections |
| rules | TEXT | '[]' | Reglas JSON: [{pattern, decision, risk_level}] |
| is_builtin | INTEGER | 0 | 1 si es integrado |
| enabled | INTEGER | 1 | 1 si activo |
| created_at | TEXT | datetime('now') | Creacion |

**Perfiles builtin:**
1. Solo lectura — auto-approve: ls, cat, grep, head, tail, etc.
2. Monitoreo — auto-approve: top, htop, free, df, ss, etc.
3. Mantenimiento basico — auto-approve: apt update, systemctl restart, etc.

---

## approval_log (015)

Registro de decisiones de aprobacion.

| Columna | Tipo | Default | Descripcion |
|---------|------|---------|-------------|
| id | INTEGER PK AUTO | — | ID unico |
| profile_id | INTEGER | — | Perfil que tomo la decision |
| session_id | TEXT | — | ID de sesion |
| connection_id | INTEGER | — | FK → connections |
| command | TEXT NOT NULL | — | Comando evaluado |
| decision | TEXT | — | approved, denied, manual |
| risk_level | TEXT | — | Nivel de riesgo |
| reason | TEXT | '' | Razon de la decision |
| created_at | TEXT | datetime('now') | Timestamp |

---

## initial_actions (016)

Acciones rapidas por tipo de conexion.

| Columna | Tipo | Default | Descripcion |
|---------|------|---------|-------------|
| id | INTEGER PK AUTO | — | ID unico |
| connection_id | INTEGER | null | FK → connections (null = global) |
| os_family | TEXT | 'linux' | OS al que aplica |
| label | TEXT NOT NULL | — | Texto del boton |
| prompt | TEXT NOT NULL | — | Prompt a enviar al agente |
| icon | TEXT | — | Emoji del boton |
| category | TEXT | 'general' | Categoria |
| sort_order | INTEGER | 0 | Orden de aparicion |
| enabled | INTEGER | 1 | 1 si visible |
| is_default | INTEGER | 0 | 1 si es por defecto |
| created_at | TEXT | datetime('now') | Creacion |

---

## server_events (017)

Bitacora de eventos de seguridad.

| Columna | Tipo | Default | Descripcion |
|---------|------|---------|-------------|
| id | INTEGER PK AUTO | — | ID unico |
| connection_id | INTEGER NOT NULL | — | FK → connections |
| event_type | TEXT NOT NULL | — | Tipo de evento |
| severity | TEXT | 'info' | info, warning, error, critical |
| title | TEXT | '' | Titulo del evento |
| details | TEXT | '' | Detalles |
| command_executed | TEXT | '' | Comando asociado |
| exit_code | INTEGER | — | Codigo de salida |
| created_at | TEXT | datetime('now') | Timestamp |

**Indices:**
- `idx_events_connection` ON server_events(connection_id)
- `idx_events_type` ON server_events(event_type)
- `idx_events_severity` ON server_events(severity)

---

## Columna agregada: shell_version (018)

**Tabla:** server_profiles

| Columna | Tipo | Default | Descripcion |
|---------|------|---------|-------------|
| shell_version | TEXT | '' | Version de shell: PowerShell (Windows) o Bash (Linux) |

---

## Columnas agregadas a playbooks (019)

| Columna | Tipo | Default | Descripcion |
|---------|------|---------|-------------|
| auditor_mode | TEXT | 'none' | none, audit_log, supervised |
| execution_mode | TEXT | 'sequential' | sequential, non_stop |
| max_sub_depth | INTEGER | 5 | Profundidad maxima de sub-playbooks |

---

## Columnas agregadas a playbook_runs (019)

| Columna | Tipo | Default | Descripcion |
|---------|------|---------|-------------|
| execution_mode | TEXT | 'sequential' | Modo de ejecucion usado |
| auditor_log | TEXT | '[]' | Log de decisiones del auditor JSON |
| current_step | INTEGER | 0 | Paso actual en ejecucion |
| paused_at | TEXT | null | Timestamp de pausa (si aplica) |
| paused_reason | TEXT | null | Razon de la pausa |

---

## playbook_run_interactions (019)

Interacciones pendientes durante ejecucion de playbooks (prompts, approvals, messages).

| Columna | Tipo | Default | Descripcion |
|---------|------|---------|-------------|
| id | INTEGER PK AUTO | — | ID unico |
| run_id | INTEGER NOT NULL | — | FK → playbook_runs |
| step_index | INTEGER NOT NULL | — | Indice del paso que genero la interaccion |
| interaction_type | TEXT NOT NULL | — | prompt, approval_gate, message |
| prompt_text | TEXT | '' | Texto de la pregunta/mensaje |
| title | TEXT | '' | Titulo del mensaje |
| style | TEXT | 'info' | Estilo visual: info, warning, success |
| options | TEXT | '[]' | Opciones para select JSON |
| variable_name | TEXT | '' | Variable donde guardar la respuesta |
| input_type | TEXT | 'text' | Tipo de input: text, select, confirm |
| response | TEXT | null | Respuesta del usuario |
| responded_at | TEXT | null | Timestamp de respuesta |
| status | TEXT | 'pending' | pending, responded, skipped, timed_out |
| created_at | TEXT | datetime('now') | Creacion |

**FK:** run_id → playbook_runs(id) ON DELETE CASCADE
**Indices:** idx_interactions_run(run_id), idx_interactions_status(status)

---

## Diagrama de Relaciones

```
connections (1)──────(N) chat_history
     │
     ├──(N) execution_log
     ├──(N) active_jobs
     ├──(N) work_sessions
     ├──(1) server_profiles
     ├──(N) update_checks
     ├──(N) update_executions
     ├──(N) server_events
     ├──(N) audit_log
     ├──(N) approval_log
     │
     └──(N) server_group_members (N)──(1) server_groups

playbooks (1)──(N) playbook_runs (N)──(1) connections
                       │
                       └──(N) playbook_run_interactions

scheduled_tasks (1)──(N) scheduled_task_runs
```

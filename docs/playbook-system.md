# Sistema de Playbooks

## Descripcion General

Los playbooks son automatizaciones reutilizables compuestas por pasos secuenciales que se ejecutan via SSH en un servidor. Soportan variables, validaciones previas, criterios de exito y comandos de rollback.

## Estructura de un Playbook

```json
{
  "name": "Health Check General",
  "description": "Revision completa del estado del servidor",
  "objective": "Verificar salud general: CPU, RAM, disco, uptime, servicios",
  "category": "monitoring",
  "compatible_systems": ["linux"],
  "preconditions": ["Servidor accesible via SSH", "Usuario con permisos sudo"],
  "required_variables": [
    { "name": "service_name", "description": "Nombre del servicio a verificar", "default": "nginx" }
  ],
  "command_sequence": [
    { "name": "Uptime", "command": "uptime" },
    { "name": "Uso de CPU", "command": "top -bn1 | head -5" },
    { "name": "Estado servicio", "command": "systemctl status {{service_name}}" }
  ],
  "success_criteria": ["Todos los comandos retornan exit code 0"],
  "rollback_commands": [
    { "name": "Revertir servicio", "command": "systemctl restart {{service_name}}" }
  ]
}
```

## Categorias

| Categoria | Color en UI | Uso |
|-----------|-------------|-----|
| monitoring | azul | Health checks, metricas, status |
| maintenance | ambar | Actualizaciones, limpieza, logs |
| diagnostic | morado | Consumo de recursos, debugging |
| security | rojo | Auditorias, usuarios, firewall |
| deployment | verde | Instalaciones, configuraciones |
| configuration | gris | Cambios de configuracion |
| custom | — | Creados por el usuario |

## Variables

Las variables se definen en `required_variables` y se sustituyen en los comandos usando la sintaxis `{{nombre_variable}}`.

**Definicion:**
```json
{
  "name": "log_days",
  "description": "Dias de antiguedad de logs a limpiar",
  "default": "7"
}
```

**Uso en comando:**
```
journalctl --vacuum-time={{log_days}}d
```

**Sustitucion en ejecucion:**
Al ejecutar el playbook, se envian los valores:
```json
{ "variables": { "log_days": "30", "service_name": "nginx" } }
```

## Playbooks Integrados (Built-in)

Los 8 playbooks integrados se crean automaticamente con la migracion 008 y no pueden ser modificados ni eliminados.

| # | Nombre | Categoria | Pasos | Descripcion |
|---|--------|-----------|-------|-------------|
| 1 | Health Check General | monitoring | 6 | CPU, RAM, disco, uptime, carga, servicios fallidos |
| 2 | Verificar Actualizaciones | maintenance | 3 | Detectar gestor, actualizar cache, listar pendientes |
| 3 | Aplicar Actualizaciones | maintenance | 2 | Aplicar updates, verificar si requiere reinicio |
| 4 | Limpieza de Logs | maintenance | 4 | Espacio antes/despues, rotar logs, limpiar journal |
| 5 | Diagnostico de Consumo | diagnostic | 4 | Top CPU, memoria, disco, IO activo |
| 6 | Revision de Seguridad Basica | security | 5 | Usuarios, accesos, puertos, firewall, SSH fallidos |
| 7 | Validar Conectividad | diagnostic | 4 | DNS, ping, interfaces, tabla de rutas |
| 8 | Recolectar Info Sistema | monitoring | 6 | OS, kernel, hostname, CPU, RAM, disco |

## Flujo de Ejecucion

```
1. POST /api/playbooks/:id/execute
   Body: { connectionId: 1, variables: { ... } }

2. Servidor crea registro en playbook_runs (status: 'running')

3. Para cada paso en command_sequence:
   a. Sustituir variables: {{var}} → valor
   b. Ejecutar comando via SSH (executeCommand)
   c. Registrar resultado:
      - name, command, stdout, stderr
      - exitCode, executionTimeMs
      - status: 'success' (code=0) o 'failed' (code!=0)
   d. Si error de conexion → status='error', break

4. Determinar status final:
   - Todos exitosos → 'success'
   - Al menos uno fallo pero continuo → 'partial_failure'
   - Error de conexion/excepcion → 'error'

5. Actualizar playbook_runs con status + step_results JSON

6. Retornar resultado al cliente
```

## Generacion con IA (Opus)

Endpoint: `POST /api/playbooks/generate`

Usa Claude Opus para generar playbooks completos basado en un objetivo en lenguaje natural.

**Input:**
```json
{
  "objective": "Instalar y configurar nginx como reverse proxy con SSL",
  "connectionId": 1
}
```

**Proceso:**
1. Se carga el perfil del servidor destino (OS, arch, package manager)
2. Se carga la knowledge base relevante
3. Se envia a Opus con un system prompt que exige JSON estricto
4. Opus genera: pasos, validaciones, rollback, variables, criterios de exito
5. Se parsea el JSON y se guarda como playbook custom

**System prompt incluye reglas:**
- Cada paso debe ser un comando SSH exacto y funcional
- Incluir validaciones ANTES de cada paso critico
- Incluir verificaciones DESPUES de cada paso
- Incluir comandos de ROLLBACK
- Usar el package manager correcto del servidor
- Formato JSON estricto especificado

## API de Playbooks

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | /playbooks | Listar (filtro: category, system) |
| GET | /playbooks/:id | Obtener uno |
| POST | /playbooks | Crear custom |
| PUT | /playbooks/:id | Actualizar (no builtin) |
| DELETE | /playbooks/:id | Eliminar (no builtin) |
| POST | /playbooks/:id/execute | Ejecutar |
| GET | /playbooks/:id/runs | Historial de ejecuciones |
| POST | /playbooks/generate | Generar con Opus |

## Tipos de Paso Avanzados (v1.2.0+)

Ademas de `command`, los playbooks ahora soportan 4 tipos de paso adicionales. El campo `type` en cada paso determina su comportamiento. Pasos sin `type` se tratan como `command` (backward compatible).

### command (default)
Ejecuta un comando SSH en el servidor.
```json
{ "type": "command", "name": "Verificar disco", "command": "df -h" }
```

### invoke_playbook
Invoca otro playbook como sub-paso. Las variables del padre se heredan y pueden sobrescribirse.
```json
{ "type": "invoke_playbook", "name": "Health check previo", "playbook_id": 1, "variables": { "extra": "valor" } }
```
- Profundidad maxima de recursion: 5 niveles (configurable por playbook)
- Variables del padre se heredan; las del paso sobrescriben

### message
Muestra un mensaje al operador. No pausa la ejecucion.
```json
{ "type": "message", "name": "Aviso", "title": "Preparando servidor", "text": "Se procedera a instalar...", "style": "info" }
```
- Estilos: `info`, `warning`, `success`
- Soporta markdown en el texto

### prompt
Solicita informacion al usuario. Pausa la ejecucion hasta recibir respuesta. El valor se inyecta como variable.
```json
{ "type": "prompt", "name": "Pedir servicio", "text": "Nombre del servicio a reiniciar:", "variable_name": "service_name", "input_type": "text" }
```
- `input_type`: `text`, `select`, `confirm`
- `options`: array de opciones para `select`
- Timeout: 5 minutos (configurable)
- La respuesta se guarda en `{{variable_name}}` y esta disponible para pasos posteriores

### approval_gate
Pausa la ejecucion y requiere aprobacion explicita para continuar.
```json
{ "type": "approval_gate", "name": "Confirmar actualizacion", "text": "Se aplicaran 15 actualizaciones criticas. Aprobar?" }
```
- El operador responde con `approve` o `reject`
- Si rechaza, la ejecucion se aborta con status `aborted`

## Modos de Ejecucion

### sequential (default)
Ejecuta pasos uno por uno. Los pasos interactivos (prompt, approval_gate) pausan la ejecucion y esperan respuesta del operador via la UI.

### non_stop
Ejecucion continua sin pausa. Los prompts usan valores por defecto o se omiten. Los approval_gates son manejados por el agente auditor si esta configurado.

## Agente Auditor IA

Un segundo agente Claude (Haiku) puede supervisar la ejecucion evaluando cada paso.

### Modos del auditor

| Modo | Comportamiento |
|------|---------------|
| none | Sin supervision. Default |
| audit_log | El auditor evalua cada paso pero solo registra. No detiene la ejecucion |
| supervised | El auditor puede detener la ejecucion si detecta riesgo alto |

### Que evalua el auditor

Para cada paso `command` ejecutado:
- Exit code y output esperado
- Indicios de problemas de seguridad o estabilidad
- Riesgo del proximo paso
- Si es seguro continuar

### Verdicts del auditor

| Verdict | Accion |
|---------|--------|
| continue | Seguir con el siguiente paso |
| warn | Registrar advertencia, seguir ejecutando |
| halt | En modo `supervised`: pausar y crear approval_gate para el operador |

### Configuracion

Desde el editor de playbooks:
- **Modo auditor**: none / audit_log / supervised
- **Modo ejecucion**: sequential / non_stop

## Editor Visual de Playbooks

La UI incluye un editor visual que permite:
- Crear y editar playbooks con drag & drop de pasos
- Seleccionar tipo de paso (command, invoke_playbook, message, prompt, approval_gate)
- Configurar cada tipo con formularios especificos
- Reordenar pasos arrastrando
- Configurar auditor_mode y execution_mode
- Vista expandida con iconos por tipo de paso

## API Extendida

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | /playbooks/:id/execute-stream | Ejecutar con SSE streaming |
| GET | /playbooks/runs/:runId | Detalle de run con interacciones |
| GET | /playbooks/runs/:runId/interactions | Interacciones de un run |
| POST | /playbooks/runs/:runId/interactions/:id/respond | Responder a interaccion |

## Limitaciones Actuales

- Los pasos se ejecutan secuencialmente (no hay paralelismo entre pasos)
- No hay soporte para pasos condicionales (if/else)
- No hay timeout por paso individual (solo el global de SSH: 30s)
- Los playbooks builtin son solo para Linux
- El auditor usa Haiku por defecto (no configurable por playbook aun)

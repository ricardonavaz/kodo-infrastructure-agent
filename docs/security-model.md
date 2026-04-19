# Modelo de Seguridad

## Vision General

Kodo maneja credenciales SSH sensibles y ejecuta comandos en servidores remotos. El modelo de seguridad se basa en:

1. **Cifrado de credenciales** en reposo (AES-256-GCM)
2. **Deteccion de comandos destructivos** antes de ejecutar
3. **Perfiles de aprobacion** basados en reglas
4. **Auditoria completa** de todas las acciones
5. **Sanitizacion de logs** para evitar filtrar datos sensibles

---

## 1. Cifrado de Credenciales

### Algoritmo

- **Key Derivation:** PBKDF2-SHA512, 600,000 iteraciones
- **Cifrado:** AES-256-GCM (cifrado autenticado)
- **IV:** 16 bytes aleatorios por operacion de cifrado
- **Auth Tag:** 16 bytes, verificacion de integridad

### Flujo

```
Password del usuario
    ↓
PBKDF2-SHA512 (600K iter, salt aleatorio)
    ↓
Key de 32 bytes (AES-256)
    ↓
AES-256-GCM (IV unico por cifrado)
    ↓
Ciphertext + Auth Tag + IV
    ↓
Base64 → almacenado en DB
```

### Almacenamiento

| Dato | Tabla | Campo |
|------|-------|-------|
| Hash de verificacion | settings | master_key_hash |
| Salt | settings | master_key_salt |
| Credenciales cifradas | connections | credentials |
| Key passphrase cifrada | connections | key_passphrase |
| Flag de cifrado | connections | credentials_encrypted |

### Integracion con Keychain macOS

El servicio `crypto.js` puede almacenar la master key derivada en el Keychain del sistema:
- Usa el comando `security` de macOS
- Servicio: `kodo-infra-agent`
- Cuenta: `master-key`
- Permite auto-unlock al iniciar sin ingresar password

---

## 2. Deteccion de Comandos Destructivos

### Pattern Regex (ai.js)

El agente IA tiene un regex hardcoded que detecta comandos potencialmente destructivos tanto para Linux como Windows:

**Linux:**
- `rm -rf` — Eliminacion recursiva forzada
- `mkfs` — Formateo de filesystem
- `dd if=` — Escritura directa a disco
- `drop table/database` — Eliminacion de DB
- `truncate table` — Vaciado de tabla
- `fdisk` — Particionado de disco
- `shutdown`, `reboot`, `init 0`, `poweroff` — Apagado/reinicio
- `systemctl stop/disable` — Detencion de servicios
- `kill -9`, `pkill` — Terminacion de procesos
- `wipefs` — Limpieza de firmas de filesystem

**Windows (PowerShell):**
- `Remove-Item -Recurse` — Eliminacion recursiva
- `Stop-Service` — Detencion de servicios
- `Disable-NetAdapter` — Deshabilitacion de red
- `Clear-Disk` — Limpieza de disco
- `Format-Volume` — Formateo de volumen
- `Restart-Computer` — Reinicio
- `Stop-Computer` — Apagado

### Comportamiento

1. Antes de ejecutar cada comando, se evalua contra `DESTRUCTIVE_PATTERN`
2. Si match → se emite evento SSE con `isDestructive: true`
3. La IA advierte al usuario en su respuesta
4. El comando SI se ejecuta (la advertencia es informativa, no bloqueante)

---

## 3. Perfiles de Aprobacion

### Arquitectura

Los perfiles de aprobacion son un sistema de reglas basadas en regex que deciden si un comando generado por la IA debe ejecutarse automaticamente, rechazarse, o requerir revision manual.

### Perfiles Built-in

| Perfil | Decision | Patrones |
|--------|----------|----------|
| Solo lectura | approved | ls, cat, grep, head, tail, find, wc, file, stat, du, df, whoami, id, hostname, uname, date, uptime, which, type, echo, pwd |
| Monitoreo | approved | top, htop, free, vmstat, iostat, sar, ss, netstat, ps, pgrep, lsof, nproc, lscpu, lsblk, lsusb, dmesg |
| Mantenimiento basico | approved | apt update/upgrade, yum update, dnf update, systemctl restart/reload, logrotate, journalctl, service restart |

### Evaluacion

```
Comando generado por IA
    ↓
¿Algun perfil activo tiene regla que matchea?
    ├── Si → ¿Decision?
    │       ├── approved → Ejecutar
    │       ├── denied → Rechazar
    │       └── manual → Ejecutar con advertencia
    └── No → Ejecutar (no hay regla aplicable)
    ↓
Registrar decision en approval_log
```

---

## 4. Auditoria

### Tablas de auditoria

| Tabla | Que registra |
|-------|-------------|
| `execution_log` | Cada comando SSH ejecutado: comando, output, exit code, timing |
| `audit_log` | Cada tarea del agente IA: prompt, comandos, respuesta, modelo, tokens, costo |
| `approval_log` | Cada decision de aprobacion: comando, decision, perfil, riesgo |
| `server_events` | Eventos de seguridad: tipo, severidad, titulo, detalles |
| `chat_history` | Historial completo de conversaciones |
| `work_sessions` | Sesiones con resumen, contadores de exito/fallo |

### Estadisticas de auditoria

`GET /api/audit/stats/summary` retorna:
- Total de tareas ejecutadas
- Tasa de exito
- Duracion promedio
- Uso por modelo
- Tipos de tarea
- Actividad por dia

### Exportacion

`GET /api/audit/export/data?format=csv|json` permite exportar el log completo para analisis externo.

---

## 5. Sanitizacion de Logs

### Middleware (middleware/sanitize.js)

El middleware de sanitizacion redacta automaticamente valores sensibles de los logs del servidor:

**Claves redactadas:**
- password
- credentials
- secret
- token
- api_key
- apiKey
- private_key

**Reemplazo:** El valor se reemplaza con `[REDACTED]` en los logs.

---

## 6. Auditoria de Seguridad de Servidores

### Endpoint

`POST /api/security/audit/:connectionId`

### Que evalua

El servicio `security.js` ejecuta una serie de comandos SSH para evaluar:
- Usuarios con shell activa
- Puertos abiertos
- Configuracion de firewall
- Intentos de acceso fallidos
- Permisos de archivos criticos
- Configuracion SSH

### Resultado

- Score de 0 a 100
- Lista de hallazgos con severidad
- Recomendaciones

### Eventos de seguridad

`GET /api/security/events/:connectionId` retorna la bitacora de eventos con filtros por tipo, severidad y rango de fechas.

---

## Consideraciones de Despliegue

### Lo que Kodo NO tiene

- **Autenticacion de usuarios:** No hay login ni roles. Es una herramienta local/interna
- **Rate limiting HTTP:** No hay limite de requests al API
- **HTTPS nativo:** Requiere reverse proxy para SSL
- **Audit trail inmutable:** Los registros pueden eliminarse

### Recomendaciones

1. Desplegar detras de un reverse proxy con HTTPS (nginx, caddy)
2. Restringir acceso al puerto 3001 via firewall
3. Configurar master key para cifrar todas las credenciales
4. Revisar periodicamente el audit log
5. Usar perfiles de aprobacion para limitar comandos automaticos
6. No exponer Kodo a internet publico

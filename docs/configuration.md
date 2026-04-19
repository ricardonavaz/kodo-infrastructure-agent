# Configuracion

## Settings del Sistema

La configuracion se almacena en la tabla `settings` de SQLite como pares key-value. Se gestiona desde la UI (Settings) o via API (`/api/settings`).

### API Key de Anthropic

**Requerido** para todas las funciones de IA (chat, generacion de playbooks, exportacion mejorada).

```
Key: anthropic_api_key
Valor: sk-ant-api03-...
```

Obtener en: https://console.anthropic.com/

### Modelo por defecto

```
Key: default_model
Valor: claude-sonnet-4-20250514 (default)
```

**Modelos disponibles:**

| Modelo | ID | Uso | Costo (input/output per 1K tokens) |
|--------|-----|-----|-----------------------------------|
| Haiku 4.5 | claude-haiku-4-5-20251001 | Consultas rapidas, monitoreo | $0.001 / $0.005 |
| Sonnet 4 | claude-sonnet-4-20250514 | Tareas complejas, modificaciones | $0.003 / $0.015 |
| Opus 4 | claude-opus-4-20250514 | Generacion de playbooks, planificacion | $0.015 / $0.075 |

### Seleccion automatica de modelo

El `model-router.js` selecciona el modelo basandose en:

- **Haiku:** Default para consultas generales y monitoreo
- **Sonnet:** Cuando el mensaje supera 150 caracteres o contiene keywords de sistema (install, configure, deploy, etc.)
- **Opus:** Solo para generacion de playbooks via `/api/playbooks/generate`

El usuario puede hacer override manual desde el `ModelSelector` en la UI.

---

## Sistema de Cifrado (Master Key)

### Que protege

Las credenciales SSH (passwords y claves privadas) almacenadas en la tabla `connections` se cifran con AES-256-GCM usando una master key derivada.

### Como funciona

1. **Setup:** El usuario configura una password (min 8 chars) via UI o `POST /api/settings/master-key/setup`
2. **Derivacion:** La password se procesa con PBKDF2-SHA512 (600,000 iteraciones) + salt aleatorio
3. **Cifrado:** Cada credencial se cifra individualmente con AES-256-GCM (IV unico por cifrado + authentication tag)
4. **Almacenamiento:** El hash de verificacion y salt se guardan en `settings` (`master_key_hash`, `master_key_salt`)
5. **Unlock:** Al iniciar la app, el usuario desbloquea con su password. La key derivada se mantiene en memoria

### Keychain de macOS

Si `useKeychain: true` al configurar la master key:
- La master key derivada se almacena en el Keychain del sistema
- En el siguiente inicio, se intenta auto-unlock desde Keychain
- Elimina la necesidad de ingresar password cada vez

### Cifrado de credenciales existentes

```
POST /api/settings/connections/encrypt-all
```

Cifra todas las credenciales que estan en texto plano. Requiere master key desbloqueada.

### Estados de la master key

| Estado | Descripcion | Operaciones permitidas |
|--------|-------------|----------------------|
| No configurada | Sin master key | Solo credenciales en texto plano |
| Bloqueada | Configurada pero no desbloqueada | No se pueden usar credenciales cifradas |
| Desbloqueada | Key en memoria | Todas las operaciones disponibles |

---

## Perfiles de Aprobacion

Sistema de reglas para auto-aprobar o rechazar comandos SSH generados por la IA.

### Perfiles integrados

| Perfil | Decision | Comandos cubiertos |
|--------|----------|-------------------|
| Solo lectura | auto-approve | ls, cat, grep, head, tail, find, wc, file, stat, du, df |
| Monitoreo | auto-approve | top, htop, free, vmstat, iostat, ss, netstat, ps, uptime |
| Mantenimiento basico | auto-approve | apt update, systemctl restart, logrotate, journalctl |

### Reglas personalizadas

Cada perfil contiene un array de reglas:
```json
{
  "rules": [
    {
      "pattern": "^ls|^cat|^grep",
      "decision": "approved",
      "risk_level": "low"
    },
    {
      "pattern": "rm -rf|mkfs|dd if=",
      "decision": "denied",
      "risk_level": "critical"
    }
  ]
}
```

- `pattern`: Regex que se evalua contra el comando
- `decision`: `approved`, `denied`, o `manual`
- `risk_level`: `low`, `medium`, `high`, `critical`

### Flujo de aprobacion

1. La IA genera un comando via tool-use
2. Antes de ejecutar, se evalua contra todos los perfiles activos
3. Si algun perfil lo aprueba → se ejecuta
4. Si algun perfil lo deniega → se rechaza
5. Si ninguno aplica → se ejecuta con advertencia (decision: manual)
6. Toda decision se registra en `approval_log`

---

## Deteccion de Comandos Destructivos

Independiente de los perfiles de aprobacion, el agente IA tiene un regex hardcoded que detecta comandos peligrosos:

```regex
rm -rf | mkfs | dd if= | drop (table|database) | truncate table |
format | fdisk | shutdown | reboot | init 0 | poweroff |
systemctl (stop|disable) | kill -9 | pkill | wipefs |
Remove-Item -Recurse | Stop-Service | Disable-NetAdapter |
Clear-Disk | Format-Volume | Restart-Computer | Stop-Computer
```

Estos comandos generan un evento `isDestructive: true` en el stream SSE y la IA advierte al usuario antes de ejecutar.

---

## Configuracion del Servidor Express

| Parametro | Valor | Ubicacion |
|-----------|-------|-----------|
| Puerto | 3001 (o `process.env.PORT`) | server/index.js |
| CORS | Todos los origenes | server/index.js |
| Body limit | 10MB JSON | server/index.js |
| DB path | server/kodo.db | server/db.js |
| DB WAL mode | Habilitado | server/db.js |
| Foreign keys | Habilitadas | server/db.js |
| SSH timeout | 10s conexion, 30s comando | server/services/ssh.js |
| SSH output limit | 100KB max stdout/stderr | server/services/ssh.js |
| Scheduler poll | Cada 60 segundos | server/services/scheduler.js |
| Backup retention | Ultimos 5 | server/db.js |

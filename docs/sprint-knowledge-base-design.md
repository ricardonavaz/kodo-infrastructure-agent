# Sprint K1 — Server Knowledge Base v1

**Creado:** 24 de abril de 2026
**Estado:** Diseño (no implementación)
**Prioridad:** Alta (feature diferenciadora del producto)
**Estimado:** 55-75 horas de trabajo (2-3 semanas a full-time solo)

---

## Origen del concepto

Durante el Sprint B0, Ricardo detectó que el agente hace recomendaciones genéricas sin entender el contexto operacional real del servidor. Ejemplos concretos observados:

**Caso 1 — Antivirus:**
- El agente ve "Windows Defender Real-Time Protection: OFF"
- Recomienda habilitarlo urgentemente
- **No considera:** McAfee Endpoint Security está instalado y consume 406 MB de RAM (visible en los procesos). Dos AVs con protección en tiempo real causan conflictos — desactivar uno es práctica estándar. La recomendación del agente es incorrecta.

**Caso 2 — Puerto RDP:**
- El agente ve "Puerto 3389 LISTENING"
- Recomienda restringir a red interna o bloquear
- **No considera:** las reglas del firewall de Windows ya filtran por perfil (Public/Private/Domain). RDP puede estar escuchando pero bloqueado desde internet. Recomendación basada en síntoma, no en contexto completo.

**Patrón común:** el agente razona con hechos aislados sin entender el contexto operacional. Ve un síntoma y propone fix sin preguntar "¿por qué está así?".

## Idea de Ricardo (texto literal)

> *"Yo lo que quisiera es que esta base de conocimiento por servidor se arme y se enriquezca de manera espontánea, y pudiera ser el primer assessment cuando uno trae un servidor nuevo o hacer un reassessment, debe incluir 'encontré todas estas cosas', y que armemos ese contexto perfecto."*

Esta idea es la base del Sprint K1.

---

## Concepto central

**Onboarding inteligente del servidor.**

Cuando se agrega un servidor nuevo a Kōdo, en lugar de quedar "listo para chat" con contexto vacío, **el agente ejecuta automáticamente un assessment profundo de solo lectura**. Descubre el entorno operacional y construye un "Perfil Operacional del Servidor" estructurado. Ese perfil:

1. Se guarda asociado al servidor
2. Se incluye en el contexto de cada conversación futura
3. Se puede enriquecer durante conversaciones normales (cuando el usuario confirma configuraciones intencionales)
4. Se puede reevaluar cuando hay cambios grandes

---

## Por qué esto es la feature clave

### 1. Elimina el problema raíz

El agente deja de recomendar cosas genéricas porque tiene contexto real. No dice "habilita Defender" cuando sabe que McAfee es el AV primario por política corporativa.

### 2. Cero fricción para el usuario

El conocimiento se construye ejecutando comandos reales de descubrimiento — es literalmente el trabajo que Kōdo sabe hacer. El usuario no tiene que llenar formularios ni recordar configuraciones.

### 3. Diferenciación fundamental vs competencia

Cualquier chatbot con IA puede ejecutar comandos. Muy pocos tienen **memoria operacional estructurada** del entorno del cliente. Este es el moat del producto.

### 4. Abre features posteriores enormes

- **Detección de drift:** "algo cambió desde el último assessment"
- **Comparación entre servidores:** "Fiducia y AV Securities tienen configuraciones divergentes de seguridad"
- **Benchmark contra baselines:** "Fiducia está 73% alineado con CIS Benchmark Windows Server 2019"
- **Reportes ejecutivos:** sobre postura del parque completo
- **Playbooks contextuales:** playbooks que se adaptan al perfil del servidor

### 5. Es vendible

La propuesta de valor cambia de:
- Antes: "Kōdo es un chat con IA que ejecuta comandos en tus servidores"
- Después: "Kōdo aprende tu infraestructura y mejora con cada conversación"

---

## Estructura de datos — ServerProfile

```typescript
interface ServerProfile {
  // Identificación
  server_id: string;              // "fiducia-main"
  server_name: string;            // "Fiducia"
  
  // Sistema operativo
  os: {
    family: string;               // "Windows" | "Linux" | "macOS"
    version: string;              // "Server 2019 Standard"
    edition: string;
    build: string;                // "17763"
    architecture: string;         // "x64"
  };
  
  // Hardware
  hardware: {
    cpu: {
      model: string;
      physical_cores: number;
      logical_threads: number;
      max_frequency_ghz: number;
    };
    memory: {
      total_gb: number;
      dimms?: number;
    };
    disks: Array<{
      mount: string;
      size_gb: number;
      type?: string;              // "SSD" | "HDD"
    }>;
    virtualization?: {
      hypervisor: string;         // "VMware" | "Hyper-V" | "KVM" | "bare-metal"
      vendor?: string;
    };
  };
  
  // Stack de software detectado
  software_stack: {
    antivirus: Array<{
      product: string;            // "McAfee Endpoint Security"
      version: string;
      status: "active" | "inactive" | "partial";
      realtime_enabled: boolean;
      is_primary: boolean;        // Cuál es el AV "oficial" según el contexto
    }>;
    web_server?: {
      product: string;            // "IIS" | "nginx" | "Apache"
      version: string;
    };
    database?: {
      product: string;            // "SQL Server" | "MySQL" | "PostgreSQL"
      version: string;
      instance_count: number;
    };
    runtime: Array<{
      name: string;               // ".NET" | "Java" | "Node" | "Python"
      versions: string[];
    }>;
    containers?: {
      docker_version?: string;
      k8s?: { version: string; role: string };
    };
    custom_apps: Array<{
      name: string;
      detected_by: string;        // "service" | "process" | "installed"
    }>;
  };
  
  // Postura de seguridad
  security_posture: {
    firewall: {
      profiles: Array<{
        name: "Public" | "Private" | "Domain";
        enabled: boolean;
        default_inbound: "allow" | "block";
        default_outbound: "allow" | "block";
      }>;
      total_rules: number;
      notable_rules: Array<{
        name: string;
        direction: "inbound" | "outbound";
        action: "allow" | "block";
        profiles: string[];
      }>;
    };
    exposed_ports: Array<{
      port: number;
      protocol: "tcp" | "udp";
      service: string;            // "RDP" | "SSH" | "HTTP"
      listening_on: string;       // "0.0.0.0" | "127.0.0.1" | "192.168.x.x"
      accessible_from_networks: Array<"Public" | "Private" | "Domain">;
      // Puerto efectivamente expuesto a internet = Public + accessible
    }>;
    auth: {
      local_users: Array<{
        name: string;
        enabled: boolean;
        last_login?: string;
        in_admin_group: boolean;
      }>;
      ad_joined: boolean;
      domain?: string;
      service_accounts: string[];
    };
    patches: {
      last_cumulative: string;
      pending_reboots: boolean;
      critical_pending: number;
    };
  };
  
  // Contexto operacional (provided by user, not auto-discovered)
  operational_context: {
    environment: "production" | "staging" | "development" | "unknown";
    patch_window?: string;        // "1st Tuesday 2AM-6AM"
    business_hours?: string;      // "Mon-Fri 8AM-6PM EST"
    contacts: Array<{
      role: string;               // "Owner" | "Backup" | "Escalation"
      name: string;
      email?: string;
    }>;
    runbooks: string[];           // URLs or document references
    tags: string[];               // "db-primary", "customer-facing", "pci-scope"
  };
  
  // Configuraciones intencionales — LO MÁS IMPORTANTE
  // Aquí se registran las decisiones que NO son "errores" aunque parezcan
  intentional_configurations: Array<{
    what: string;                 // "Real-Time Protection OFF en Windows Defender"
    why: string;                  // "McAfee Endpoint Security es el AV corporativo primario"
    confirmed_by: string;         // "user" | "auto-detected" | "policy"
    confirmed_at: string;         // ISO timestamp
    confidence: "high" | "medium" | "low";
    
    // Reglas de supresión para recomendaciones futuras
    do_not_recommend: string[];   // ["enable windows defender realtime", "install additional AV"]
    
    // Si el usuario cambia de opinión
    can_be_overridden: boolean;
  }>;
  
  // Metadatos del perfil
  meta: {
    created_at: string;
    last_assessment: string;
    assessment_version: number;   // Se incrementa cada reassessment
    next_scheduled_reassessment?: string;
    assessment_duration_seconds: number;
    commands_executed: number;
  };
}
```

---

## Flow 1 — Onboarding inicial (primer assessment)

1. **Usuario agrega servidor** con credenciales SSH o WinRM en la UI de Kōdo.

2. **Kōdo pregunta:**
   > *"Voy a hacer un assessment inicial de este servidor. Durará 3-5 minutos y ejecutará ~25 comandos de solo lectura para descubrir el entorno. No modifico nada. ¿Procedo?"*

3. **Usuario acepta.**

4. **Agente ejecuta assessment por fases** (ver sección "Assessment Engine" abajo).

5. **Agente presenta progreso en vivo:**
   > *"Descubriendo OS... Windows Server 2019 Standard ✓"*
   > *"Identificando hardware... 16 cores, 64 GB RAM ✓"*
   > *"Mapeando servicios... 122 activos, 5 detenidos ✓"*
   > *"Analizando firewall... 317 reglas en 3 perfiles ✓"*
   > *"Identificando AV... McAfee Endpoint Security + Windows Defender (parcial) ✓"*

6. **Claude (el modelo) sintetiza el perfil:**
   - Construye el JSON estructurado de `ServerProfile`
   - Genera narrativa en español para el usuario
   - **Identifica configuraciones que podrían ser intencionales** y formula preguntas:

   > *"Detecté dos antivirus: McAfee Endpoint Security (activo con Real-Time Protection) y Windows Defender (activo pero Real-Time Protection deshabilitado). Típicamente cuando hay dos AVs, uno es primario y el otro se desactiva intencionalmente para evitar conflictos.*
   > 
   > *¿Puedo asumir que McAfee es el AV primario y que Windows Defender está intencionalmente parcial?"*
   > 
   > *[Sí, es correcto] [No, corregir configuración] [Explicar más]*

7. **Usuario confirma** o edita configuraciones.

8. **Perfil se guarda** en base de datos.

9. **Se activa para futuras conversaciones.**

## Flow 2 — Conversación normal (post-onboarding)

1. **Usuario hace pregunta sobre el servidor** (ej: "hay problemas de seguridad?")

2. **Backend carga `ServerProfile`** y lo inyecta en el system prompt del agente antes de procesar el mensaje.

3. **Agente razona con contexto completo.** En lugar de recomendar genéricamente, considera `intentional_configurations`:

   - Si ve "Windows Defender RTP OFF", NO lo reporta como problema (sabe que es intencional)
   - Si ve "Puerto 3389 LISTENING", consulta si hay regla de intentional_configuration — si hay, lo menciona como "configurado según política" en vez de recomendación de cerrar

4. **Recomendaciones son informadas:** se enfocan en cosas que sí son anomalías, no en configuraciones conocidas.

5. **Si el agente descubre algo nuevo relevante** (proceso nuevo, servicio nuevo, configuración cambiada), propone actualizar el perfil:

   > *"Detecté un nuevo servicio 'CustomApp-Backup' ejecutándose. ¿Quieres que lo agregue al perfil de Fiducia como aplicación instalada?"*

## Flow 3 — Reassessment explícito

1. **Usuario pide reassessment:** "reevalúa Fiducia".

2. **Agente corre el mismo assessment** del onboarding.

3. **Compara con perfil anterior** y produce un **diff estructurado**:

   ```
   Cambios detectados desde el último assessment (hace 45 días):
   
   ➕ Nuevos servicios activos (3):
     - WinRM-Agent-v2 (¿legítimo?)
     - PostgreSQL-15 (¿nuevo servicio?)
     - AcmeBackup-Daemon (¿instalación reciente?)
   
   ➖ Servicios removidos (1):
     - LegacyFTP (esperado, estaba en backlog de deprecation)
   
   📈 Uso de recursos:
     - RAM: 42GB → 58GB (+38%)
     - Disco C: 355GB → 371GB (+4.5%)
     - Usuarios activos: 17 → 22 (+5)
   
   🔄 Configuraciones cambiadas:
     - UAC: ConsentPromptBehaviorAdmin 5 → 2 (menos restrictivo)
     - Firewall Public Profile: 3 reglas nuevas permitidas
   ```

4. **Usuario confirma cuáles cambios son intencionales.**

5. **Perfil se actualiza** (versión 2, 3, etc.)

## Flow 4 — Enriquecimiento orgánico

Durante conversaciones normales, el usuario puede decir cosas como:

> *"No, no cierres el puerto 3389. Está expuesto a propósito porque nuestra VPN corporativa filtra por IP."*

El agente reconoce este tipo de afirmaciones y propone:

> *"Entendido. ¿Agrego esto como configuración intencional del perfil de Fiducia? Así no lo recomiendo cerrar en el futuro."*
> *[Sí, agregar] [No, solo ignorar por ahora]*

Si el usuario acepta, se agrega una entrada a `intentional_configurations`.

---

## Assessment Engine — diseño por OS

### Windows (Server 2012+ / 10+)

**Fase 1 — Identidad (5 comandos):**
```powershell
Get-ComputerInfo | Select OsName, OsVersion, OsBuildNumber, CsName, CsDomain
Get-CimInstance Win32_OperatingSystem | Select LastBootUpTime, LocalDateTime
whoami /groups
```

**Fase 2 — Hardware (3 comandos):**
```powershell
Get-CimInstance Win32_Processor | Select Name, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed
Get-CimInstance Win32_ComputerSystem | Select TotalPhysicalMemory, Manufacturer, Model
Get-PSDrive -PSProvider FileSystem | Select Name, Used, Free
```

**Fase 3 — Servicios y procesos (3 comandos):**
```powershell
Get-Service | Where-Object Status -eq 'Running' | Select Name, DisplayName, StartType
Get-Service | Where-Object {$_.Status -eq 'Stopped' -and $_.StartType -eq 'Automatic'}
Get-Process | Sort-Object CPU -Descending | Select -First 15 Name, CPU, WorkingSet, Id
```

**Fase 4 — Red y firewall (5 comandos):**
```powershell
Get-NetFirewallProfile | Select Name, Enabled, DefaultInboundAction, DefaultOutboundAction
Get-NetFirewallRule -Direction Inbound -Enabled True | Measure-Object | Select Count
Get-NetTCPConnection -State Listen | Select LocalPort, RemoteAddress, OwningProcess
Get-NetIPAddress | Select InterfaceAlias, IPAddress, PrefixLength
Test-NetConnection 8.8.8.8 -InformationLevel Quiet
```

**Fase 5 — Seguridad (5 comandos):**
```powershell
Get-MpPreference | Select DisableRealtimeMonitoring, DisableBehaviorMonitoring
Get-WmiObject -Namespace "root\SecurityCenter2" -Class AntiVirusProduct
Get-LocalUser | Select Name, Enabled, LastLogon
Get-LocalGroupMember -Group "Administrators"
Get-WmiObject Win32_OSRecoveryConfiguration
```

**Fase 6 — Software y parches (3 comandos):**
```powershell
Get-WmiObject -Class Win32_Product | Select Name, Version | Sort Name
Get-HotFix | Sort InstalledOn -Descending | Select -First 20
Get-WindowsFeature | Where-Object InstallState -eq 'Installed'
```

### Linux (Ubuntu/Debian/RHEL/CentOS)

**Fase 1 — Identidad:**
```bash
uname -a
cat /etc/os-release
hostnamectl
uptime
last -F | head -5
```

**Fase 2 — Hardware:**
```bash
lscpu
free -h
df -h
lsblk
```

**Fase 3 — Servicios y procesos:**
```bash
systemctl list-units --state=running --no-pager --type=service
systemctl list-unit-files --state=enabled --no-pager --type=service
ps aux --sort=-%cpu | head -20
```

**Fase 4 — Red y firewall:**
```bash
ss -tlnp
# Firewall detection
iptables -L -n 2>/dev/null || ufw status 2>/dev/null || firewall-cmd --list-all 2>/dev/null
ip addr
```

**Fase 5 — Seguridad:**
```bash
cat /etc/passwd | awk -F: '$7!~/nologin|false/ {print $1, $3, $7}'
getent group sudo wheel
lastlog | head
```

**Fase 6 — Software y parches:**
```bash
# Debian/Ubuntu
dpkg -l | grep "^ii" | wc -l && dpkg -l | head -30

# RHEL/CentOS
rpm -qa | wc -l && rpm -qa --last | head -30

# Updates pending
apt list --upgradable 2>/dev/null | head -20 || yum check-update 2>/dev/null | head -20
```

### Sintesis por Claude

Después de ejecutar todos los comandos, Claude toma la información cruda y:

1. **Estructura el JSON de `ServerProfile`**
2. **Genera narrativa en español** para el usuario
3. **Identifica ambigüedades** que requieren confirmación (ej: "detecté 2 AVs, ¿cuál es primario?")
4. **Formula preguntas abiertas** sobre contexto operacional (ej: "¿Este servidor es producción o staging?")
5. **Sugiere configuraciones intencionales** basadas en patrones detectados

---

## Complejidad real — breakdown de trabajo

| Componente | Estimado |
|---|---|
| 1. Schema de `ServerProfile` (diseño de datos) | 4h |
| 2. Storage en SQLite (tabla + relaciones + migración) | 2h |
| 3. Assessment Engine (ejecución por fases, parsing outputs) | 10-14h |
| 4. Generator de `ServerProfile` (prompts para Claude, parsing respuestas) | 6h |
| 5. UI de onboarding (wizard que guía assessment con progreso) | 10-14h |
| 6. UI de visualización/edición del perfil | 8-10h |
| 7. Integración en system prompt del agente | 3h |
| 8. Reassessment flow + diff + UI de diff | 8-10h |
| 9. Enriquecimiento orgánico (detectar afirmaciones, proponer agregar) | 4-6h |
| 10. Tests (assessment engine, diff, integración) | 8-12h |
| 11. Polish y edge cases (errores de conexión, comandos que fallan, etc.) | 5-10h |
| **Total** | **68-91 horas** |

Reservando buffer para imprevistos: **Ajustar a 55-75 horas efectivas sobre sprints de 2-3 semanas.**

---

## Ubicación en el roadmap

### Post-B0 priorización propuesta:

1. **Terminar Sprint B0** (H4, H1, H2/H3/H7 pendientes)
2. **Resolver arq-14** (fetches crudos pendientes)
3. **Sprint K1 — Server Knowledge Base v1** ← aquí
4. B1 Adapter RRL Schema v1.1
5. C1-C3 Bloques visuales avanzados (ahora infinitamente más valiosos con Knowledge Base)
6. B3 Sentinel v1
7. Otros sprints según evolucione

**Razón del orden:** los bloques visuales avanzados (C1-C3) se vuelven muchísimo más valiosos cuando tienen datos del Knowledge Base para visualizar. Gráficos de "cambios de postura de seguridad en los últimos 30 días" requieren Knowledge Base. Hacer C1-C3 antes de K1 es construir la vitrina antes de tener productos.

---

## Decisiones de diseño diferidas

Cosas que intencionalmente NO se deciden en este documento y se resuelven al iniciar la implementación:

### 1. Política de almacenamiento de comandos ejecutados

¿Se guarda cada comando del assessment en audit log? ¿Solo el resultado estructurado? Implicaciones de compliance y debugging vs espacio en disco.

### 2. Frecuencia de reassessment automático

¿Se programa reassessment automático cada 30 días? ¿Se dispara por eventos (reinicio del servidor, cambios detectados)? ¿Solo manual?

### 3. Manejo de servidores multi-tenant / clusters

¿Cómo se maneja un servidor que es nodo de un cluster? ¿Perfil por nodo o por cluster? ¿Relaciones entre perfiles?

### 4. Versionamiento del schema de `ServerProfile`

Cuando la estructura evolucione, ¿cómo se migran perfiles existentes? ¿Se guarda versión del schema en cada perfil?

### 5. Privacidad y compartición

¿Los perfiles se comparten entre usuarios del mismo tenant? ¿Hay perfiles "template" para tipos comunes de servidor?

### 6. Integración con sistemas externos

¿Sincronización con CMDB corporativo? ¿Exportación a Ansible/Chef? ¿Import de perfiles existentes?

### 7. Baseline comparison

¿Se pueden definir "perfiles baseline" (ej: "Standard Web Server") y comparar servidores reales contra ellos?

---

## Integración con otras ideas de producto

### Con Sprint Playbooks (Idea 1 del backlog general)

Los playbooks se vuelven contextuales al perfil:
- `@seguridad-basica` se adapta: si AV primario es McAfee, no sugiere configurar Defender
- `@limpieza-disco` conoce la política de patch window y no ejecuta durante horas de negocio

### Con Sprint Sesiones (Idea 2 del backlog general)

Cada sesión graba no solo comandos, sino **cambios al Knowledge Base**:
- "En esta sesión, Ricardo confirmó 2 configuraciones intencionales nuevas"
- "El perfil de Fiducia se actualizó de v3 a v4 durante esta sesión"

Los reportes de sesión incluyen contexto del perfil para dar sentido a las acciones ejecutadas.

### Con C1-C3 Bloques visuales avanzados

Nuevos tipos de bloques habilitados por Knowledge Base:
- **`profile_diff` block**: visualización de cambios entre assessments
- **`security_posture` block**: heatmap de estado de seguridad del parque completo
- **`drift_timeline` block**: línea de tiempo de cambios detectados
- **`compliance_score` block**: alineación con baselines (CIS, NIST)

---

## Riesgos y mitigaciones

### Riesgo 1: Assessment tarda mucho en servidores grandes

**Mitigación:** fases ejecutan en paralelo cuando es seguro. Timeout por comando (30s max). Abort gracioso si toma más de 10 minutos.

### Riesgo 2: Comandos de descubrimiento fallan por permisos

**Mitigación:** documentar requisitos de permisos antes del onboarding. Manejar fallos por comando con notas en el perfil ("no se pudo verificar X por falta de permisos").

### Riesgo 3: Usuario cambia algo externamente y perfil se vuelve obsoleto

**Mitigación:** detección de drift proactiva durante conversaciones. Sugerir reassessment cuando se detectan discrepancias grandes.

### Riesgo 4: Perfil crece demasiado y sobrepasa context window del modelo

**Mitigación:** comprimir el perfil para el system prompt (solo secciones relevantes según la conversación). Full profile solo se carga cuando el usuario lo pide explícitamente.

### Riesgo 5: Sobreajuste a configuraciones intencionales lleva a ignorar problemas reales

**Mitigación:** marcadores de confianza en `intentional_configurations`. Revisión periódica sugerida al usuario ("has marcado X como intencional hace 6 meses, ¿sigue siendo correcto?").

---

## Métricas de éxito del Sprint K1

Cuando se complete K1, debemos poder afirmar:

1. **Precisión:** >90% de las recomendaciones del agente son relevantes (no rechazadas por "ya sé que eso es intencional").

2. **Adopción:** 100% de servidores nuevos se onboarding con assessment automático.

3. **Enriquecimiento:** al menos 3 `intentional_configurations` promedio por servidor después de 2 semanas de uso.

4. **Confiabilidad:** assessment completa exitosamente en >95% de los servidores soportados.

5. **Performance:** onboarding completo en <5 minutos para servidores típicos.

---

## Notas finales

Este Sprint K1 es el momento donde Kōdo deja de ser "un chat con IA que ejecuta comandos" y se convierte en **una plataforma de operaciones de infraestructura con memoria**.

Las ideas de Playbooks (Idea 1) y Sesiones (Idea 2) son features útiles. Knowledge Base es **la razón por la cual alguien elegiría Kōdo sobre las alternativas genéricas**.

La implementación debe hacerse con cuidado. Los perfiles generados son el activo más valioso del usuario — errores en schema o pérdida de datos destruirían confianza. Por eso el estimado es generoso (55-75 horas) y se recomienda hacerlo después de tener Sprint B0 cerrado y el producto en estado "presentable".

---

**Última actualización:** 24 de abril de 2026
**Próxima revisión:** al terminar Sprint B0 + arq-14

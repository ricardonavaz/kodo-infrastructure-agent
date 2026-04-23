# Backlog de Ideas de Producto

**Creado:** 19 de abril de 2026, 7:04pm Miami
**Contexto:** Durante la sesión de arranque del Sprint B0, Ricardo generó visión de producto adicional al ver la app en vivo. Capturamos las ideas aquí para no perderlas, manteniendo disciplina sobre el sprint actual.

**Regla:** Las ideas aquí NO entran al sprint actual. Se evalúan al cierre de cada sprint para priorización del siguiente.

---

## Mapeo al plan existente

Antes de agregar ideas nuevas, confirmamos qué ya estaba cubierto:

| Observación de Ricardo | Estado en plan | Acción |
|---|---|---|
| "Interfaz más rica con gráficos avanzados" | C1-C3 RRL (ya planeado) | Sin cambio. Se ejecuta post-B0 y B1. |
| "Botones intuitivos" | Sprint B0 H2, H3, H4, H6 | Sin cambio. Es lo próximo a ejecutar. |
| "Playbooks con `@nombre`" | Parcial: existe `feat/quick-playbook-execution` en stash | Expandir concepto. Ver Idea 1 abajo. |

---

## Ideas nuevas capturadas

### Idea 1 — Sintaxis `@nombre` para invocar playbooks

**Propuesta:**
Permitir al usuario invocar playbooks predefinidos con una sintaxis estilo mención. Ejemplo:

```
Usuario: ejecuta @chequeo-linux
Usuario: luego de que todo esté perfecto y actualizado, instalemos nginx
```

**Valor:**
- Reduce fricción: el usuario no tiene que explicar qué quiere cada vez.
- Crea biblioteca reutilizable de operaciones comunes.
- Permite encadenamiento conversacional natural ("después de @chequeo-linux, haz X").
- Abre camino para playbooks compartidos entre usuarios del equipo / tenants.

**Requisitos técnicos (alto nivel):**
- Tokenizer que detecta `@nombre` en el input del usuario.
- Registry de playbooks (tabla en BD, con nombre, descripción, pasos, permisos).
- Parser que expande `@nombre` al contenido del playbook antes de pasar a Claude.
- UI de autocompletado al escribir `@` (similar a menciones en Slack/Discord).
- Gestión CRUD de playbooks (panel admin).

**Relación con trabajo existente:**
El stash `feat/quick-playbook-execution` ya tiene playbooks en QuickActions + ejecución inline en terminal + PlaybookManager con servidor pre-seleccionado. El sistema `@nombre` es una capa encima: toma los playbooks que ya existen y permite invocarlos conversacionalmente, no solo desde botones.

**Estimado:** 3-5 días después de reconciliar stash.

**Prioridad sugerida:** ALTA. Es feature diferenciador del producto. Ningún competidor directo lo tiene.

**Decisión:** Evaluar después de B0 cuando se revise el stash.

---

### Idea 2 — Sesiones explícitas (nuevo concepto de producto)

**Propuesta:**
Convertir cada interacción con un servidor en una "sesión" explícita con lifecycle formal:

1. **Inicio explícito:** botón "Iniciar sesión" al conectar a un servidor.
2. **Prompt de grabación:** al iniciar, preguntar "¿Quieres que grabe esta sesión?" con opciones SÍ / NO / Solo resumen.
3. **Grabación activa:** si el usuario acepta, se registra cada comando, output, decisión.
4. **Terminación manual:** botón "Terminar sesión" visible durante la sesión activa.
5. **Auto-terminación:** la sesión termina automáticamente al desconectar del servidor.
6. **Reporte final:** al terminar, si la sesión fue grabada, se genera reporte detallado con:
   - Resumen ejecutivo en lenguaje natural
   - Timeline de acciones ejecutadas
   - Métricas (comandos ejecutados, tiempo total, cambios realizados)
   - Gráficos si aplica (recursos monitoreados durante la sesión)
   - Diff antes/después si hubo cambios de configuración
   - Exportable como PDF, HTML, Markdown

**Valor:**
- Audit trail formal para compliance.
- Reportes compartibles con stakeholders no-técnicos ("mira lo que hicimos este jueves").
- Sensación de "trabajo terminado" — el reporte final es el cierre psicológico.
- Permite reanudar conversaciones con contexto: "cuando empecé la sesión dije X".
- Base para facturación por sesión en Enterprise.

**Requisitos técnicos (alto nivel):**
- Tabla `sessions` en BD con lifecycle (started_at, ended_at, recorded, summary).
- Eventos de inicio/fin integrados con conexión SSH existente.
- UI de prompt de grabación al iniciar.
- Generador de reportes (probablemente pasada adicional a Haiku al cierre).
- Dashboard de sesiones históricas.
- Integraciones: exportar a PDF, compartir por email, guardar en storage.

**Estimado:** 5-7 días.

**Prioridad sugerida:** ALTA. Completa el "ciclo de trabajo" del usuario. Hoy las conversaciones son abiertas y nunca se "cierran" — el usuario no tiene sensación de logro.

**Relación con otros sprints:**
- Requiere C1-C3 (bloques visuales) para que los reportes tengan gráficos.
- Requiere A4 (ledger de costos) para que los reportes muestren costo real.
- Puede aprovechar B3 (Sentinel v1) si Sentinel genera reportes en formato RRL.

**Decisión:** Evaluar post-B0/B1 como candidato a sprint dedicado "Sprint Sesiones".

---

## Observación arquitectural

Estas dos ideas (playbooks `@nombre` y sesiones explícitas) tienen algo en común: **elevan Kōdo de "chat con IA que controla servidores" a "plataforma de operaciones de infraestructura"**.

Un chat es conversacional. Una plataforma tiene:
- Primitivas reusables (playbooks)
- Lifecycle explícito (sesiones)
- Registro formal (audit log)
- Entregables (reportes)
- Administración (panel)

Esta elevación es consistente con la arquitectura de marca KŌDO (plataforma de agentes especializados, no chatbot). Ricardo instintivamente está pidiendo los features que **construyen la plataforma real**, no solo capas de UI.

---

## Disciplina sobre estas ideas

Estas ideas NO entran al sprint B0.
Estas ideas NO se codifican hoy.
Estas ideas se revisitan al cierre de cada sprint para priorización del siguiente.

El objetivo de este documento es **liberar la cabeza de Ricardo** — las ideas están seguras, no se van a perder, y no tienen que estar compitiendo por atención mental mientras ejecutamos B0.

---

## Revisión programada

**Próxima revisión de este documento:** al cierre del Sprint B0.

En ese momento decidiremos el orden de los próximos 3 sprints considerando:
- Backlog original (B1 RRL adapter, B2 bloques nuevos, B3 Sentinel v1, C1-C3 bloques visuales, A4 ledger, A5 model registry)
- Ideas nuevas capturadas aquí (Sprint Playbooks, Sprint Sesiones)
- Aprendizajes del Sprint B0

---

## Hallazgos arquitecturales detectados durante B0

### Hallazgo arq-1 (MEDIO): routes/agent.js tiene side effects al importarse

- **Detectado:** Sprint B0, fix H8 (19 abril 2026)
- **Comportamiento:** server/routes/agent.js abre conexion a DB, limpia
  zombie jobs y instancia Router al ser importado. Esto significa que
  cualquier modulo que importe algo de agent.js (por ejemplo, los tests
  de detectTaskType) ejecuta esos side effects.
- **Impacto:** los tests funcionaron porque la DB existe y la tabla
  active_jobs tambien, pero acopla tests a presencia de DB innecesariamente.
- **Fix sugerido:** extraer funciones puras (detectTaskType y similares)
  a services/model-router.js. routes/agent.js solo deberia tener handlers
  de Express, no logica reutilizable.
- **Prioridad:** Media. No bloqueante, pero se vuelve mas costoso de
  arreglar con cada modulo nuevo que dependa de agent.js.
- **Estimado:** 1-2 horas de refactor.

### Hallazgo arq-2 (BAJA): orden de filas de TASK_PATTERNS produce clasificaciones contraintuitivas

- **Detectado:** Sprint B0, fix H8 (19 abril 2026)
- **Comportamiento:** "revisar firewall" → diagnostic (por revis en
  fila 1) en lugar de security (firewall en fila 5). El primer match
  gana, no el mas especifico.
- **Casos confirmados problematicos hoy:**
  - "revisar firewall" → diagnostic (intent posible: security)
  - Probablemente otros con palabras de multiples categorias
- **Fix sugerido:** dos opciones a evaluar:
  1. Reordenar filas para que las mas especificas (security) vayan
     antes que las generales (diagnostic).
  2. Usar scoring: contar matches por taskType y elegir el de mas
     coincidencias. Mas robusto pero mas complejo.
- **Prioridad:** Baja. El comportamiento actual es funcional, no
  catastrofico. Optimizacion de UX, no fix de bug.
- **Estimado:** 30 minutos para opcion 1, 2-3 horas para opcion 2.

---

**Última actualización:** 22 abril 2026 (agregados hallazgos arq-1, arq-2 durante fix H8)

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

### Hallazgo arq-3 (MEDIO): CSS muerto en Recommendation y SummaryCard por inline styles

- **Detectado:** Sprint B0, fix H6 (19 abril 2026)
- **Comportamiento:** Recommendation.jsx (linea 26) y SummaryCard.jsx
  (lineas 24-25) usan style={{...}} inline para colores de priority/
  status. El CSS de clase para estos badges
  (.sb-priority-badge.high/.medium/.low en index.css:3663-3665) existe
  pero nunca se aplica porque el inline style gana en especificidad.
- **Impacto:** funciona visualmente (los inline styles pintan), pero
  tenemos CSS muerto y patron inconsistente con Finding (que va a usar
  data-attributes despues del fix H6). Tres componentes, tres tecnicas
  distintas: data-attribute, inline style, inline style.
- **Fix sugerido:** unificar los 3 componentes al mismo patron
  (data-attribute + CSS) post-H6.
- **Prioridad:** Media. Funcional pero deuda de mantenimiento.
- **Estimado:** 1-2 horas.

### Hallazgo arq-4 (ALTA): cero infraestructura de tests del frontend

- **Detectado:** Sprint B0, fix H6 (19 abril 2026)
- **Comportamiento:** No existe Vitest, Jest, ni React Testing Library
  en /client. No hay archivos *.test.*, no hay carpeta __tests__ en
  client/src/. El backend tiene 163 tests; el frontend tiene 0.
- **Impacto:** los bugs visuales (como H6) viven sin deteccion hasta
  que un humano los ve manualmente. Los proximos sprints UX van a
  estar parcialmente ciegos sin esta infra. Cualquier cambio CSS
  puede romper otros componentes sin que nadie lo detecte hasta
  produccion.
- **Fix sugerido:** instalar Vitest + React Testing Library +
  @testing-library/jest-dom. Configurar un primer test por componente
  critico (Finding, QuestionPrompt, Recommendation, SummaryCard,
  TextBlock).
- **Prioridad:** ALTA. Bloqueador para Sprint B0+ con confianza.
- **Estimado:** 4-6 horas para setup + 5-10 tests iniciales por
  componente.

### Hallazgo arq-5 (MEDIO): semantica de colores inconsistente entre componentes

- **Detectado:** Sprint B0, fix H6 (19 abril 2026)
- **Comportamiento:** El token --amber significa "high" en Finding,
  "medium" en Recommendation, "warning" en SummaryCard. El mismo
  color visual comunica conceptos distintos segun el componente.
- **Impacto:** confusion para el usuario. Un usuario que aprende
  "amarillo = high" en Finding va a interpretar mal el "amarillo =
  medium" de Recommendation.
- **Fix sugerido:** definir un sistema de tokens semanticos (no por
  color sino por significado): --severity-low, --severity-medium,
  --severity-high, --severity-critical. Mapear cada componente al
  mismo token segun su semantica real.
- **Prioridad:** Media. Refactor visual de impacto pero no bloqueante.
- **Estimado:** 2-3 horas (tokens + actualizacion de los 3
  componentes).

### Hallazgo arq-6 (MEDIO): Recommendation priority siempre 'medium' (bug del parser)

- **Detectado:** Sprint B0, verificacion visual de H6 (23 abril 2026)
- **Comportamiento:** Todos los bloques Recommendation reciben
  priority='medium' sin importar el contenido real de la
  recomendacion del modelo. El parser semantico no extrae
  correctamente el priority del output de Claude.
- **Ya documentado:** bug #3 en docs/semantic-parser-bugs.md. Este
  hallazgo solo lo refleja en backlog arquitectural para visibilidad.
- **Impacto:** todas las recomendaciones se pintan naranja (token
  --sev-high-bg), perdiendo la senal visual de urgencia real. El
  usuario no puede priorizar de un vistazo.
- **Fix sugerido:** ver docs/semantic-parser-bugs.md bug #3.
- **Prioridad:** Media. Bloqueador para que el mapping semantico
  AAA de H6 tenga valor real. Sin este fix, el esfuerzo visual
  solo comunica "todo es medium".
- **Estimado:** ver semantic-parser-bugs.md.

### Hallazgo arq-7 (BAJA): "Riesgo: low" sin badge propio en Recommendation

- **Detectado:** Sprint B0, verificacion visual de H6 (23 abril 2026)
- **Comportamiento:** El campo `risk` de Recommendation se renderiza
  como texto plano con label "Riesgo:" prefijo (Recommendation.jsx
  lineas ~34-37). Los valores "low"/"medium"/"high" no tienen
  tratamiento visual distintivo. Ademas esta mal alineado con el
  badge de priority.
- **Impacto:** confusion visual. El usuario ve dos conceptos de
  severidad (priority + risk) pero solo uno tiene senal visual.
  Ademas priority dice "Alta"/"Media"/"Baja" pero risk dice
  "low"/"medium"/"high" sin traducir.
- **Fix sugerido:** agregar badge a risk usando los mismos tokens
  --sev-*-bg (risk "high" → critical-bg, etc). Traducir labels.
  Alinear con el badge de priority en el layout del header.
- **Prioridad:** Baja. No bloqueante, mejora de coherencia visual.
- **Estimado:** 1 hora.

### Hallazgo arq-8 (MEDIO): Width unbounded en cards Finding y Recommendation

- **Detectado:** Sprint B0, verificacion visual de H6 (23 abril 2026)
- **Comportamiento:** Los contenedores `.sb-finding` y
  `.sb-recommendation` (index.css ~3462 y ~3665) no tienen
  `max-width` ni padding horizontal del padre, asi que cuando la
  ventana del chat es ancha las cards se estiran a 100% del
  disponible.
- **Impacto:** a resoluciones >1440px las cards se ven
  desproporcionadas, el texto se rompe en lineas muy largas y la
  densidad visual se degrada. En mobile (<768px) probablemente
  funciona bien por el viewport, pero desktop wide no esta
  considerado.
- **Fix sugerido:** agregar `max-width` sensato (~720-800px) al
  contenedor padre del chat o directamente a las cards. Verificar
  interaccion con el layout del chat (flex/grid del parent).
- **Prioridad:** Media. Afecta ergonomia de lectura en pantallas
  grandes, que es el escenario real de uso (operador en estacion de
  trabajo).
- **Estimado:** 1-2 horas (depende de donde este el constraint
  correcto del layout).

### Hallazgo arq-9 (BAJA): formatMessage no soporta links markdown

- **Detectado:** Sprint B0, analisis de H5 (23 abril 2026)
- **Comportamiento:** formatMessage() en client/src/utils/formatMessage.jsx
  no procesa links [texto](url). Claude a veces emite URLs en este
  formato que aparecerian como texto literal.
- **Tambien faltan:** strikethrough (~~texto~~), listas anidadas,
  blockquotes (> texto).
- **Impacto:** si una respuesta del modelo incluye un link con sintaxis
  markdown, el usuario ve el texto con asteriscos/corchetes crudos.
- **Fix sugerido:** extender formatMessage con regex para links.
  Strikethrough, nested lists, blockquotes son nice-to-have.
- **Prioridad:** Baja. Claude tiende a emitir URLs planas mas que
  markdown-wrapped, asi que el impacto diario es minimo.
- **Estimado:** 30 min para links, 2 horas para todos los adds.

### Hallazgo arq-10 (CRITICO): boton "Reporte IA" devuelve error de autenticacion

- **Detectado:** Sprint B0, verificacion visual de H5 (24 abril 2026)
- **Comportamiento:** Al hacer click en "Reporte IA" desde un mensaje
  de respuesta del agente, la app devuelve:
  {"error":"Token de autenticacion requerido"}
- **Impacto:** funcionalidad critica rota. Los usuarios clickean una
  feature prometida y reciben error. Destruye confianza.
- **Causa raiz hipotetizada (a confirmar):** el endpoint de generacion
  de reporte IA requiere autenticacion pero el cliente no esta
  enviando el token JWT (o similar) en el request. Posibles causas:
  1. Header Authorization no incluido en el fetch del boton.
  2. Token expirado y no se renovo.
  3. Endpoint cambio pero el cliente no se actualizo.
  4. CORS o configuracion de cookies.
- **Fix sugerido:** investigar el request que dispara el boton
  Reporte IA, verificar que incluya el token JWT del usuario actual,
  y que el endpoint lo valide correctamente.
- **Prioridad:** CRITICO. Bug funcional, no cosmetico.
- **Estimado:** 1-2 horas (diagnostico + fix).

### Hallazgo arq-11 (ALTO): botones export HTML/MD/TXT sin claridad de funcion

- **Detectado:** Sprint B0, verificacion visual de H5 (24 abril 2026)
- **Comportamiento:** Los tres botones HTML, MD y TXT en el footer
  de cada mensaje no tienen tooltip ni label descriptivo que explique
  que hace cada uno. El usuario no sabe si son para exportar, imprimir,
  copiar, o visualizar en otro formato.
- **Impacto:** feature que existe pero no se usa por falta de
  descubribilidad. Confusion visual.
- **Fix sugerido:** opciones a evaluar:
  1. Agregar tooltip descriptivo (hover) a cada boton.
  2. Consolidar en un solo boton "Exportar" con dropdown de formatos.
  3. Texto descriptivo en el boton (ej: "Copiar como HTML" en
     lugar de solo "HTML").
- **Prioridad:** Alta. UX confusa en feature user-facing.
- **Estimado:** 1 hora (decision de diseno + implementacion).

### Hallazgo arq-12 (ALTO): botones HTML/MD/TXT ademas podrian no estar funcionando

- **Detectado:** Sprint B0, verificacion visual de H5 (24 abril 2026)
- **Comportamiento reportado por Ricardo:** "no funcionan bien".
  Necesita diagnostico especifico para entender que esta mal
  exactamente (no hacen nada al click / hacen algo incorrecto /
  producen error silencioso).
- **Impacto:** funcionalidad prometida pero rota.
- **Fix sugerido:** diagnostico con DevTools abierto al hacer click
  en cada boton. Investigar handlers onClick, endpoints que llaman,
  y output real.
- **Relacion con arq-11:** probablemente mismo componente. Arreglar
  ambos en la misma sesion tiene sentido.
- **Prioridad:** Alta. Bug funcional.
- **Estimado:** 1-2 horas (depende del diagnostico).

### Hallazgo arq-13 (MEDIO): formatMessage no procesa bold inline dentro de celdas de tabla

- **Detectado:** Sprint B0, verificacion visual de H5 (24 abril 2026)
- **Comportamiento:** En client/src/utils/formatMessage.jsx, el
  parser de tablas GFM (| col | col |) correctamente identifica la
  estructura de la tabla pero NO ejecuta inlineFormat sobre el
  contenido de cada celda. Los **bold**, *italic* y `code` dentro
  de celdas aparecen como texto literal con los delimitadores
  visibles.
- **Evidencia:** reportes de auditoria de Kodo frecuentemente emiten
  tablas con nombres de procesos o parametros en bold dentro de
  celdas (ej: "| **EXCEL** | 27166.28 | 233.47 |"). Todos aparecen
  con asteriscos.
- **Impacto:** alto en visual. Tablas son una de las estructuras
  visuales mas usadas en reportes de auditoria. Degrada la calidad
  del render.
- **Fix sugerido:** extender el parser de tablas de formatMessage
  para pasar cada celda por inlineFormat antes de renderizarla.
  Estimado: 5-10 lineas de cambio + tests dirigidos para casos edge
  (celdas con code inline, celdas con combinaciones).
- **Prioridad:** Media. No bloqueante pero altamente visible. Su
  fix destraba calidad visual del 100% de outputs del modelo que
  incluyan tablas con bold.
- **Estimado:** 30-45 minutos (cambio + tests).

### Hallazgo arq-14 (ALTO): fetches crudos sin Authorization en multiples componentes

- **Detectado:** Sprint B0, durante fix arq-10/arq-12 (24 abril 2026)
- **Comportamiento:** El grep de fetch crudo en client/src/ durante
  el fix de Terminal.jsx revelo 7 llamadas adicionales a fetch()
  sin incluir Authorization header:

  1. client/src/hooks/useApi.js:213 - executePlaybookStream
     - Endpoint: POST /api/playbooks/.../execute-stream con streaming
     - Impacto: si el endpoint requiere auth (probable), ejecucion
       de playbooks esta rota.

  2. client/src/components/Settings.jsx:23,51,72,89,96 - 5 endpoints
     de configuracion:
     - /api/settings/master-key/status
     - /api/settings/master-key/setup
     - /api/settings/master-key/unlock
     - /api/settings/master-key/lock
     - /api/settings/connections/encrypt-all
     - Impacto: funcionalidad de master-key y cifrado masivo
       probablemente rota. Requiere verificar si estos endpoints
       estan en skip-list del middleware de auth o tienen auth
       custom.

  3. client/src/components/LoginPage.jsx:52 - cambio de password
     post-login:
     - Endpoint: POST /api/auth/password
     - Segun routes/auth.js:6-11, este endpoint SI requiere auth.
     - Impacto: cambio de password despues del primer login esta
       roto. Bug confirmado.

- **Fix sugerido:** Usar authorizedFetch (ya creado en useApi.js)
  o migrar a api.X donde aplique. Mismo patron que arq-10/12.

- **Prioridad:** ALTO. Al menos un bug confirmado (cambio de
  password) y 2 grupos de bugs altamente probables (playbooks,
  master-key). Estos tocan features user-facing.

- **Estimado:** 1-2 horas (probar cada uno, aplicar
  authorizedFetch, verificar visualmente).

- **Nota:** podria revelar mas endpoints con problemas si el
  testing destapa casos edge.

---

**Última actualización:** 24 abril 2026 (agregados hallazgos arq-9, arq-10, arq-11, arq-12, arq-13, arq-14 durante H5 y fix arq-10/12)

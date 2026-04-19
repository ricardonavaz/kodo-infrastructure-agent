# Diagnostico del Sistema de Respuestas Semanticas y Exportacion IA — Kodo

**Fecha:** 2026-04-19  
**Proyecto:** Kodo Infrastructure Agent (SuSSH)  
**Archivos revisados:** 20  
**Lineas de codigo analizadas:** ~2,639  

---

## 1. Parser de Respuestas Semanticas

### Ubicacion

- **Archivo:** `server/services/semantic-parser.js` (430 lineas)
- **Exporta:** `parseSemanticBlocks(text, executions)`

### Invocacion

Se invoca unicamente en `server/routes/agent.js` linea 206, despues de que el chat con Claude completa:

```javascript
// agent.js:204-208
try {
  const { blocks, tags } = parseSemanticBlocks(result.response, result.executions);
  result.blocks = blocks;
  result.tags = tags;
} catch { /* parsing non-critical, continue with raw text */ }
```

Los bloques resultantes viajan al frontend via el evento SSE `done` y se almacenan en el resultado del job.

### Como decide que bloques generar

El parser opera como **maquina de estados linea por linea** (lineas 84-296). Cada linea del texto de respuesta IA se evalua contra patrones regex en orden de prioridad:

1. **Code blocks** — Detecta ` ``` ` de apertura/cierre (lineas 96-117)
2. **Tables** — Detecta lineas con `|` y separador `|---|` (lineas 121-145)
3. **Synthesis** — Regex `##.*?(Sintesis|Resumen|Summary)` captura secciones de resumen (lineas 149-170)
4. **Headers** — Patrones `#{1,4}` (lineas 174-188)
5. **Questions** — Lineas terminando en `?` con patron de pregunta (lineas 195-214)
6. **Findings** — Lineas con keywords de severidad: critico, warning, vulnerabilidad, etc. (lineas 218-242)
7. **Recommendations** — Lineas con keywords: recomendar, sugerir, accion, solucion (lineas 246-261)
8. **Metrics** — Patron dual: `label: valor unidad` o deteccion por labels conocidos (lineas 265-271)
9. **Text blocks** — Acumulador por defecto para lineas consecutivas (lineas 275-295)

Ademas, las **ejecuciones de comandos** se pre-procesan antes del texto (lineas 64-81) y generan bloques `execution_step` con el stdout/stderr/exitCode de cada comando ejecutado.

### Tipos de bloques soportados

| Tipo | Descripcion | Ejemplo de datos |
|------|-------------|------------------|
| `execution_step` | Resultado de comando SSH ejecutado | `{ command: "df -h", stdout: "...", exitCode: 0, duration: 234 }` |
| `code_block` | Bloque de codigo detectado | `{ code: "apt update && apt upgrade -y", language: "bash", executable: true }` |
| `data_table` | Tabla markdown parseada | `{ headers: ["Puerto","Estado"], rows: [["22","LISTEN"],["80","LISTEN"]], sortable: true }` |
| `summary_card` | Seccion de sintesis/resumen | `{ title: "Resumen", content: "...", status: "good", highlights: [...], stats: {...} }` |
| `metric_block` | Metricas con valores numericos | `{ metrics: [{ label: "CPU", value: "45", unit: "%", status: "good" }] }` |
| `finding` | Hallazgo con severidad | `{ title: "SSH root login habilitado", severity: "high", impact: "...", remediation: "..." }` |
| `recommendation` | Recomendacion priorizada | `{ title: "Actualizar OpenSSL", priority: "high", description: "...", command: "apt install openssl" }` |
| `question_prompt` | Pregunta al usuario | `{ question: "Deseas continuar?", options: ["Si","No"], inputType: "buttons" }` |
| `text_block` | Texto general (parrafos) | `{ content: "El servidor esta operando normalmente." }` |

### Esquema de datos de un bloque

Cada bloque tiene esta estructura base:

```javascript
{
  id: crypto.randomUUID(),      // UUID unico
  type: 'finding',               // tipo del bloque
  data: { ... },                 // datos especificos del tipo
  actions: ['copy', 'explain'],  // acciones contextuales disponibles
  metadata: {
    source: 'parsed',            // origen: 'parsed' o 'execution'
    timestamp: new Date().toISOString()
  }
}
```

### Funciones auxiliares relevantes

- **`flushMetrics(buffer)`** (linea 325): Agrupa metricas acumuladas en un solo `metric_block`
- **`parseTable(lines)`** (linea 339): Extrae headers y rows de tabla markdown
- **`extractOptions(lines)`** (linea 357): Detecta opciones de listas (-, *, 1., a))
- **`extractMetricsFromLine(line)`** (linea 375): Doble regex para pares label:valor con logica de status automatico (≥90% = critical, ≥70% = warning)
- **`detectSeverity(text)`** (linea 405): Keyword matching + deteccion de emojis (❌→critical, ⚠️→high)
- **`detectTags(text)`** (linea 424): Auto-etiquetado por tematica (linux, security, network, etc.)

---

## 2. Renderer React de Bloques

### Componente orquestador

**Archivo:** `client/src/components/SmartMessage.jsx` (52 lineas)

Recibe `blocks` (array) y un `content` (string fallback). Si hay bloques, los renderiza via un mapa de componentes:

```javascript
// SmartMessage.jsx:13-23
const COMPONENT_MAP = {
  data_table: DataTable,
  metric_block: MetricBlock,
  finding: Finding,
  question_prompt: QuestionPrompt,
  recommendation: Recommendation,
  code_block: CodeBlock,
  text_block: TextBlock,
  summary_card: SummaryCard,
  execution_step: ExecutionStep,
};
```

Si no hay bloques, cae a `formatMessage(content)` que renderiza markdown basico a React elements.

### Componentes de bloque

Todos en `client/src/blocks/` — JavaScript puro (no TypeScript).

| Componente | Archivo | Lineas | Props principales | Features |
|------------|---------|--------|-------------------|----------|
| `DataTable` | `DataTable.jsx` | 100 | `headers, rows, sortable, filterable` | Sort por columna, filtro por texto, deteccion numerica |
| `MetricBlock` | `MetricBlock.jsx` | 44 | `metrics[]` | Grid de cards con barra de progreso %, colores por status |
| `Finding` | `Finding.jsx` | 69 | `title, severity, impact, evidence, remediation` | Secciones colapsables, badge de severidad coloreado |
| `Recommendation` | `Recommendation.jsx` | 50 | `title, priority, description, command, risk_level` | Badge de prioridad, boton ejecutar comando |
| `QuestionPrompt` | `QuestionPrompt.jsx` | 108 | `question, options, inputType` | 4 modos: buttons, select, text, confirm |
| `CodeBlock` | `CodeBlock.jsx` | 42 | `code, language, executable` | Copiar, ejecutar, label de lenguaje |
| `TextBlock` | `TextBlock.jsx` | 17 | `content, format` | Markdown via formatMessage() o pre-formateado |
| `SummaryCard` | `SummaryCard.jsx` | 50 | `title, content, status, highlights, stats` | Indicador de status, lista de highlights, chips |
| `ExecutionStep` | `ExecutionStep.jsx` | 47 | `command, exitCode, duration, stdout, stderr` | Colapsable si >10 lineas, color por exit code |

### Componentes de soporte

| Componente | Archivo | Lineas | Funcion |
|------------|---------|--------|---------|
| `BlockAssistant` | `client/src/components/BlockAssistant.jsx` | 64 | Modal que solicita explicacion IA de un bloque via `/agent/:id/explain` |
| `ContextActions` | `client/src/components/ContextActions.jsx` | 41 | Menu contextual de 3 puntos con acciones por bloque |

### Formatter legacy

**Archivo:** `client/src/utils/formatMessage.jsx` (142 lineas)

Convierte markdown a elementos React linea por linea. Soporta: code blocks, tablas, headers (h3-h6), listas ordenadas/desordenadas, negrita, italica, inline code. Se usa como fallback cuando no hay bloques semanticos.

---

## 3. Motor de Exportacion

### Ubicacion

**Archivo:** `server/routes/export.js` (384 lineas)

### Endpoints

| Metodo | Ruta | Funcion |
|--------|------|---------|
| GET | `/api/export/session/:sessionId` | Exporta reporte de sesion de trabajo |
| GET | `/api/export/profile/:connectionId` | Exporta perfil de servidor |
| POST | `/api/export/message` | Exporta mensaje individual con metricas |
| POST | `/api/export/enhanced` | Exporta con enriquecimiento por IA |

### Formatos soportados

Todos los endpoints aceptan `?format=html|md|txt`:

- **HTML**: Template profesional con CSS embebido (dark theme, responsive, print-ready). Dos templates: `DASHBOARD_TEMPLATE` (completo con header/status cards/footer) y `SIMPLE_TEMPLATE` (basico).
- **Markdown**: Texto plano con formato markdown estandar.
- **Text**: Sin formato.

### Converter Markdown → HTML enriquecido

`markdownToRichHtml(md)` (lineas 160-217) transforma markdown en HTML con:
- Indicadores de status: ✅→verde, ⚠️→ambar, ❌→rojo (con clases CSS `.st-ok/.st-warn/.st-crit`)
- Badges de prioridad: 🔴→Alta, 🟠→Media, 🟡→Baja (con clases `.pri-high/.pri-med/.pri-low`)
- Tablas markdown a `<table>` HTML
- Code blocks a `<pre><code>`
- Headers `##` a secciones con iconos (`<div class="section">`)
- Inline formatting: bold, italic, code

### Enriquecimiento por IA

**Endpoint:** `POST /api/export/enhanced` (lineas 308-382)

**Flujo:**
1. Recibe `content` (texto original), `metrics`, `serverName`, `connectionId`
2. Obtiene perfil del servidor desde la BD para contexto
3. Construye prompt en espanol pidiendo documento ejecutivo profesional con: resumen ejecutivo, tablas, indicadores de status, observaciones, recomendaciones priorizadas, sintesis
4. Invoca Claude Haiku con max_tokens 4096
5. Convierte respuesta a HTML via `markdownToRichHtml()` o devuelve markdown directo
6. Agrega cards de metricas (modelo, tokens, tiempo, costo) al HTML

**Modelo:** `claude-haiku-4-5-20251001` (linea 351)

**Prompt de enriquecimiento (lineas 330-347):** 10 reglas estrictas para transformar el contenido en documento ejecutivo. Incluye secciones obligatorias: Estado General, Analisis Detallado, Observaciones, Recomendaciones, Sintesis.

---

## 4. Puntos de Integracion del API de Anthropic

### Mapa completo de invocaciones

| # | Archivo | Linea | Modelo | max_tokens | Streaming | Prompt Cache | Tool Use | Proposito |
|---|---------|-------|--------|-----------|-----------|-------------|----------|-----------|
| 1 | `server/services/ai.js` | 224 | Dinamico (default: sonnet) | 4,096 | No (SSE manual) | No | **Si** (`execute_command`, `query_server_history`) | Chat principal con ejecucion de comandos |
| 2 | `server/services/ai.js` | 361 | Mismo que #1 | 4,096 | No | No | **Si** (continuacion tool-use loop) | Continuacion del tool-use loop |
| 3 | `server/services/auditor.js` | 86 | haiku-4-5 | 512 | No | No | No | Auditoria de pasos de playbook |
| 4 | `server/routes/agent.js` | 377 | haiku-4-5 | 1,024 | No | No | No | Explicacion contextual de bloques |
| 5 | `server/routes/directives.js` | 99 | sonnet-4 | 2,048 | No | No | No | Sugerencia de directrices de seguridad |
| 6 | `server/routes/playbooks.js` | 280 | opus-4 | 8,192 | No | No | No | Generacion de playbooks |
| 7 | `server/routes/export.js` | 351 | haiku-4-5 | 4,096 | No | No | No | Enriquecimiento de exportaciones |

### Observaciones criticas

1. **No hay prompt caching** en ninguna invocacion. El system prompt del chat (`ai.js`) incluye perfil del servidor, conocimiento, directrices y historial — candidato ideal para cache.
2. **No hay streaming nativo** de Anthropic. El sistema implementa SSE manual: el backend espera la respuesta completa de Claude y luego emite eventos al frontend. El "streaming" del chat es de *eventos de progreso* (thinking → executing → done), no de tokens.
3. **Tool use** solo existe en `ai.js` con dos herramientas: `execute_command` (ejecuta via SSH) y `query_server_history` (busca en historial). El loop maximo es 10 iteraciones (linea 354).
4. **Model router subutilizado**: `server/services/model-router.js` define patrones para Opus y Sonnet pero `selectModel()` siempre retorna Haiku (linea 15). El routing inteligente no funciona.
5. **API key se lee de la BD** en cada request (`SELECT value FROM settings WHERE key = 'anthropic_api_key'`). No hay cache en memoria.

### Costos configurados

```javascript
// ai.js:19-27
const MODEL_COSTS = {
  'claude-haiku-4-5-20251001':   { input: 0.001,  output: 0.005  },
  'claude-sonnet-4-20250514':    { input: 0.003,  output: 0.015  },
  'claude-opus-4-20250514':      { input: 0.015,  output: 0.075  },
};
```

---

## 5. Mapa de Integracion RRL

Evaluacion de cada bloque RRL Schema v1.1 contra lo que el proyecto ya implementa.

| Bloque RRL | Existe en Kodo? | Componente/Archivo | Distancia al RRL |
|------------|----------------|-------------------|------------------|
| `heading` | **Parcial** | Detectado por parser (linea 174) como parte del flujo de texto, no como bloque independiente tipado. `formatMessage.jsx` lo renderiza como `<h3>`-`<h6>`. | **Media** — Existe la deteccion pero no genera un bloque `heading` tipado. Es inline en `text_block`. |
| `paragraph` | **Si (como text_block)** | `text_block` en parser, `TextBlock.jsx` | **Baja** — Renombrar type y agregar campos (align, emphasis). |
| `keyPoint` | **No** | — | **Alta** — No existe concepto equivalente. Los findings son lo mas cercano pero son de tipo "hallazgo/problema", no "punto clave". |
| `quote` | **No** | `formatMessage.jsx` detecta `>` blockquotes pero no genera bloque semantico. | **Media** — El parser ignora blockquotes. Agregar deteccion de `>` lineas y generar bloque tipado. |
| `definition` | **No** | — | **Alta** — No hay concepto de definicion/glosario en el sistema. |
| `code` | **Si** | `code_block` en parser (linea 96), `CodeBlock.jsx` | **Baja** — Ya funciona bien. Agregar campo `runnable` (hoy es `executable`), `output` preview. |
| `kpi` | **Si (como metric_block)** | `metric_block` en parser (linea 265), `MetricBlock.jsx` | **Baja** — Conceptualmente identico. Ajustar schema a `target`, `trend`, `sparkline`. |
| `table` | **Si** | `data_table` en parser (linea 121), `DataTable.jsx` | **Baja** — Ya tiene sort y filter. Agregar paginacion y column types. |
| `comparison` | **No** | — | **Alta** — No existe bloque de comparacion lado a lado. |
| `timeline` | **No** | — | **Alta** — No hay visualizacion temporal. Las sesiones tienen historia pero no se renderizan como timeline. |
| `checklist` | **No** | — | **Media** — `summary_card` tiene `highlights` que son listas, pero no son interactivas ni tienen estado checked. |
| `chart` | **No** | — | **Alta** — No hay graficos. Las metricas son numericas pero no visuales (solo barra de progreso %). |
| `diagram` | **No** | — | **Alta** — No hay diagramas de arquitectura o flujo. |
| `choiceGroup` | **Parcial** | `question_prompt` con inputType `buttons` o `select` | **Media** — Ya existe la mecanica pero el schema difiere. Agregar multiselect, images, descriptions por opcion. |
| `actionBar` | **Parcial** | `ContextActions.jsx` genera menu de acciones por bloque | **Media** — Existe pero como menu contextual (3 puntos), no como barra de acciones explcita en el bloque. |
| `expandable` | **Parcial** | `Finding.jsx` tiene secciones colapsables (Impact, Evidence). `ExecutionStep.jsx` colapsa output largo. | **Baja** — La mecanica existe. Generalizar como bloque wrapper. |
| `decisionTree` | **No** | — | **Alta** — No hay arbol de decisiones. |
| `form` | **Parcial** | `QuestionPrompt.jsx` soporta texto libre, select, confirm | **Media** — Es un formulario de un solo campo. Para form RRL se necesitan multi-campo, validacion, submit. |
| `summary` | **Si** | `summary_card` en parser (linea 149), `SummaryCard.jsx` | **Baja** — Existe y funciona. Ajustar schema a campos RRL. |
| `references` | **No** | — | **Alta** — No hay sistema de referencias/citas. |
| `exportHint` | **No** | — | **Media** — El motor de exportacion existe (`export.js`) pero no hay bloque que indique al frontend como exportar. |

### Resumen de cobertura

- **Ya existe y cercano al RRL (ajuste menor):** 5 bloques — `paragraph`, `code`, `kpi`, `table`, `summary`
- **Parcialmente implementado (trabajo moderado):** 5 bloques — `heading`, `choiceGroup`, `actionBar`, `expandable`, `form`
- **No existe (implementacion nueva):** 11 bloques — `keyPoint`, `quote`, `definition`, `comparison`, `timeline`, `checklist`, `chart`, `diagram`, `decisionTree`, `references`, `exportHint`

---

## 6. Recomendacion de Migracion

### Estrategia: Evolucion incremental con retrocompatibilidad

El sistema actual funciona. La clave es **no romper el flujo existente** mientras se migra al schema RRL.

### Fase 1 — Schema adapter (riesgo bajo, impacto alto)

**Que:** Crear una capa de adaptacion entre el parser actual y el frontend.

1. Agregar funcion `toRRL(block)` en `semantic-parser.js` que mapee los tipos actuales a tipos RRL:
   - `text_block` → `paragraph`
   - `code_block` → `code`
   - `metric_block` → `kpi`
   - `data_table` → `table`
   - `summary_card` → `summary`
   - `finding` → `keyPoint` (con severity como emphasis)
   - `question_prompt` → `choiceGroup` o `form`
   - `recommendation` → `keyPoint` (con priority)

2. El frontend SmartMessage recibe ambos schemas (legacy + RRL) y resuelve el componente por cualquiera de los dos.

**Por que primero:** Cero riesgo de regresion. Los bloques existentes siguen funcionando. Los nuevos bloques RRL se agregan incrementalmente.

### Fase 2 — Nuevos bloques simples (riesgo bajo)

**Que:** Implementar bloques RRL que son variaciones de lo que ya existe:

1. `heading` — Extraer de text_block, generar bloque independiente
2. `quote` — Detectar `>` en parser, nuevo componente simple
3. `expandable` — Wrapper generico basado en la logica de Finding.jsx
4. `checklist` — Variante de summary highlights con estado interactivo
5. `exportHint` — Bloque metadata que el motor de exportacion consume

**Por que segundo:** Componentes simples, <50 lineas cada uno, reutilizan CSS existente.

### Fase 3 — Bloques complejos (riesgo medio)

**Que:** Bloques que requieren logica nueva:

1. `comparison` — Layout side-by-side, requiere que el parser detecte patrones comparativos
2. `timeline` — Requiere agregar timestamps a los datos existentes de sesiones
3. `form` — Extender QuestionPrompt a multi-campo
4. `actionBar` — Convertir ContextActions de menu a barra inline
5. `definition` — Detectar patrones "X: definicion" o "X es..." en respuestas

### Fase 4 — Bloques visuales (riesgo alto)

**Que:** Bloques que necesitan librerias externas:

1. `chart` — Requiere libreria de graficos (lightweight: Chart.js o uPlot). Riesgo: dependencia externa, bundle size.
2. `diagram` — Requiere renderer (Mermaid.js). Riesgo: complejidad de parsing, peso del bundle.
3. `decisionTree` — Requiere estructura de datos arborescente y renderer interactivo. Riesgo: complejidad de UX.

**Por que al final:** Estas son las que mas rompen la filosofia actual de "zero external UI frameworks". Considerar lazy-loading para no afectar el bundle base.

### Lo que consideraria riesgoso

1. **Reescribir el parser desde cero.** El parser actual es fragil (regex sobre texto libre) pero funciona para el 80% de los casos. Mejor extenderlo que reemplazarlo.
2. **Agregar TypeScript de golpe.** El proyecto completo es JS puro. Migrar a TS bloque por bloque es viable; migrar todo de una vez romperia velocidad de desarrollo.
3. **Cambiar el schema de bloques sin adapter.** Si se cambia `metric_block` → `kpi` sin capa de compatibilidad, cualquier dato en cache o en sesiones activas deja de renderizar.
4. **Agregar Chart.js/Mermaid al bundle principal.** Deben ser lazy-loaded o el bundle crece significativamente (hoy son 302KB gzip 83KB — esta ajustado).

---

## Estadisticas del diagnostico

- **Archivos leidos:** 20
- **Lineas de codigo revisadas:** ~2,639
- **Puntos de integracion Anthropic encontrados:** 7 invocaciones en 6 archivos
- **Bloques semanticos activos:** 9 tipos
- **Cobertura RRL actual:** 5/21 bloques directos + 5/21 parciales = **48% de cobertura parcial**

---

## Resumen ejecutivo

1. **El parser semantico es funcional pero fragil** — opera con regex sobre texto libre linea por linea, lo cual funciona para outputs estructurados de Claude pero puede fallar con respuestas atipicas. No hay tests unitarios.

2. **La arquitectura de bloques esta bien disenada** — el patron COMPONENT_MAP en SmartMessage con fallback a formatMessage es limpio y extensible. Agregar nuevos bloques RRL es mecanicamente simple (nuevo archivo en `blocks/`, registrar en el map).

3. **El model router esta roto** — `selectModel()` siempre retorna Haiku ignorando los patrones definidos para Opus y Sonnet. El routing inteligente documentado no funciona en la practica.

4. **No se aprovecha prompt caching ni streaming nativo** — cada request al API de Anthropic paga el costo completo del system prompt. El chat principal con su system prompt extenso (perfil + conocimiento + directrices + historial) es candidato ideal para cache, con ahorro estimado del 90% en tokens de input recurrentes.

5. **La migracion a RRL es viable sin reescritura** — el 48% del schema ya tiene cobertura parcial. Una capa adapter permitiria coexistencia de bloques legacy y RRL durante la transicion, sin romper el sistema actual.

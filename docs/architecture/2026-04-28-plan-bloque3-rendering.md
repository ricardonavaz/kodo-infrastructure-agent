# Plan Técnico — Sprint Bloque 3: Rendering Markdown Unificado (Camino A)

**Fecha:** 28 de abril de 2026 (sesión nocturna ~3 AM)
**Autor:** Ricardo Nava (founder, primer cliente) + Claude (asistente)
**Estado:** Plan técnico cerrado. Sprint B3 listo para arrancar con B3.1.
**Origen:** Bloque 2 del plan de implementación en `docs/architecture/2026-04-28-clasificacion-7-ideas.md`. Decision-Rendering ejecuta Camino A (consolidación en sistema único).

---

## Propósito de este documento

Definir el plan técnico vinculante para el sprint Bloque 3 del plan de implementación: consolidación de los dos sistemas de rendering markdown paralelos (`utils/formatMessage.jsx` y código local en `Terminal.jsx`) en un sistema único basado en la librería `marked` con sanitización vía `DOMPurify`.

Este documento es output de la sesión de diseño técnico (Bloque 2). Es **vinculante** para la implementación subsiguiente. Las decisiones técnicas aquí no son sugerencias — son compromisos.

---

## Estado actual (entrada al sprint)

### Sistemas paralelos a unificar

```
Sistema 1: client/src/utils/formatMessage.jsx       143 líneas
Sistema 2: client/src/components/Terminal.jsx       inline líneas 10-157
```

Duplicación pura. Ambos tienen funciones idénticas `inlineFormat` y `formatMessage`.

### Componentes que renderizan markdown

```
- TextBlock.jsx          → usa formatMessage de utils
- Terminal.jsx           → usa formatMessage local (eliminamos)
- DataTable.jsx          → usa inlineFormat de utils (post arq-13)
- Finding.jsx            → usa inlineFormat de utils
- Recommendation.jsx     → usa inlineFormat de utils
- SummaryCard.jsx        → usa inlineFormat de utils
- QuestionPrompt.jsx     → usa inlineFormat de utils
```

### Bugs a resolver con el sistema unificado

```
B2  >  blockquote no implementado                    → marked resuelve
B3  ** asimétrico                                    → marked parser robusto
B4  # headings                                       → marked resuelve
B5  ### headings                                     → marked resuelve
B6  Listas espaciado vertical                        → marked + CSS correcto
B7  Listas con guión                                 → marked resuelve
B8  [ACTION] markers                                 → renderer custom (mínimo)
```

**Resolución estimada por marked:** B2-B7 automáticos. B8 requiere extension custom mínima.

---

## Las 6 decisiones técnicas tomadas

### Decisión 1 — Ubicación del renderer unificado: REEMPLAZAR utils/formatMessage.jsx

El renderer unificado vive en `client/src/utils/formatMessage.jsx` reemplazando la implementación actual. Funciones locales en Terminal.jsx se eliminan. Todos los componentes importan de utils.

**Justificación:** un solo punto de verdad en filesystem. Path de imports ya existe y todos lo usan. Simplicidad sobre granularidad.

### Decisión 2 — API mantenida: COMPATIBILIDAD TOTAL

`formatMessage.jsx` mantiene exports actuales:

```javascript
export function inlineFormat(str)       // texto inline (sin <p>)
export function formatMessage(text)     // texto completo (con párrafos, tablas, etc.)
```

Cambio interno transparente. Cero modificaciones requeridas en componentes que importan estas funciones.

**Justificación:** reduce superficie de cambio. Si la implementación interna funciona, los callers no deben enterarse.

### Decisión 3 — Markers [ACTION]: RENDERER CUSTOM MÍNIMO (B8 parcial)

Implementación mínima de extension de marked para detectar patrones `[ACTION] texto` y emitir HTML con clase CSS especial. Solo visual, sin lógica de click ni interacción.

```javascript
// Conceptualmente:
marked.use({
  extensions: [{
    name: 'actionMarker',
    level: 'block',
    tokenizer(src) {
      const match = /^\[ACTION\]\s+(.+)$/.exec(src);
      if (match) return { type: 'actionMarker', raw: match[0], text: match[1] };
    },
    renderer(token) {
      return `<div class="md-action-marker">${token.text}</div>`;
    }
  }]
});
```

**Justificación:** usuario ve mejora visual inmediata en lugar de seguir viendo `[ACTION]` literal hasta P2. Implementación mínima es trabajo desechable cuando llegue P2 (sistema completo de bloques semánticos), pero el costo de descartarlo es bajo (~30 líneas).

**Decisión diferida formal:** la lógica completa de `[ACTION]` (handlers de click, integración con sistema de bloques semánticos, tracking de estado) se atiende en sprint Bloque 4 (P2 expandido).

### Decisión 4 — DataTable.jsx, Finding.jsx, etc: SIN CAMBIOS

`inlineFormat(string)` sigue existiendo como función. Internamente usa `marked.parseInline(str)` que hace solo parsing inline (sin envolver en `<p>`). Cero cambios en componentes existentes.

```javascript
export function inlineFormat(str) {
  return DOMPurify.sanitize(marked.parseInline(String(str)));
}
```

**Justificación:** `marked.parseInline` existe específicamente para este caso. Mismo patrón de uso que hoy.

### Decisión 5 — Sanitización: DOMPURIFY

Usar `DOMPurify` como capa de sanitización después de marked. Aplica tanto a `formatMessage` como a `inlineFormat`.

**Justificación:** defense in depth. KŌDO eventualmente puede tener input de usuarios (notas, configs, documentos importados). 20KB es trivial vs costo de incidente XSS. Estándar industria.

**Configuración inicial:**

```javascript
const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: [
    // Markdown estándar
    'p', 'br', 'strong', 'em', 'code', 'pre', 'blockquote',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'a',
    // Custom
    'div', 'span'
  ],
  ALLOWED_ATTR: ['href', 'class', 'title']
};
```

### Decisión 6 — Tests: COBERTURA MÍNIMA (~10-15 tests)

Smoke test del renderer + un test por feature básica. NO buscar cobertura exhaustiva del spec markdown (eso ya lo cubre marked).

**Tests planificados:**

```
1. Smoke: renderiza markdown básico sin error
2. Bold + italic + code (inline)
3. Headings (h1-h3)
4. Listas con * y con -
5. Blockquote
6. Tables markdown
7. XSS: input con <script> debe sanitizarse
8. [ACTION] marker: genera HTML con clase correcta
9. inlineFormat: texto inline sin <p> wrapper
10. inlineFormat con bold + italic combinado
11. inlineFormat con celdas que contienen markdown (caso DataTable)
12. Edge: input vacío
13. Edge: input null/undefined (debe retornar string vacío, no crash)
14. Edge: markdown malformado (** sin cerrar, etc.)
15. Custom: configuración de marked aplicada (GFM tables, etc.)
```

---

## Plan de sub-pasos del sprint

Cada sub-paso es **commit-able independientemente**. Si alguno falla, rollback con `git revert` no afecta los anteriores.

### B3.1 — Setup de dependencias e infraestructura (1-2h)

**Tareas:**
1. Instalar `marked` y `dompurify` en `client/`
2. Verificar bundle size impact con `npm run build` y comparar antes/después
3. Crear estructura inicial de imports en `formatMessage.jsx` (sin reemplazar lógica todavía, solo agregar imports)
4. Verificar que las versiones de marked y DOMPurify son compatibles con la versión de React/Vite del proyecto
5. Verificar que tests existentes siguen verdes con las nuevas dependencias instaladas

**Verificación:**
- `npm test` 61/61 frontend pasa
- Build sin errores
- Bundle size delta documentado (esperado: +50KB aproximado)

**Commit:** `chore(deps): add marked + dompurify for unified markdown rendering`

**Punto de pausa:** SÍ. Si bundle size es problema o hay incompatibilidad, paramos.

---

### B3.2 — Reescritura de formatMessage.jsx (2-3h)

**Tareas:**
1. Reescribir `inlineFormat(str)` usando `marked.parseInline` + DOMPurify
2. Reescribir `formatMessage(text)` usando `marked.parse` + DOMPurify
3. Configurar opciones de marked (GFM tables, breaks, etc.)
4. Configurar DOMPurify con tags y attrs permitidos
5. Mantener compatibilidad de exports

**Verificación:**
- Tests frontend siguen verdes (61/61)
- Componentes que importan `inlineFormat` siguen funcionando: DataTable, Finding, Recommendation, SummaryCard, QuestionPrompt
- TextBlock que importa `formatMessage` sigue funcionando

**Commit:** `refactor(rendering): rewrite formatMessage with marked + DOMPurify (resolves B2-B7)`

**Punto de pausa:** SÍ. Verificación visual obligatoria con Ricardo antes de continuar.

**Verificación visual posterior con Ricardo:**
- Tablas en pantalla de Playbooks renderizan correctamente
- Findings, Recommendations, SummaryCards renderizan correctamente
- B2 (>), B3 (** asimétrico), B4-B5 (headings), B6-B7 (listas) **deben resolverse automáticamente**

---

### B3.3 — Eliminación de duplicación en Terminal.jsx (1h)

**Tareas:**
1. Eliminar las ~140 líneas locales de `inlineFormat` y `formatMessage` en Terminal.jsx
2. Importar de `utils/formatMessage`
3. Verificar que el chat sigue renderizando correctamente

**Verificación:**
- Tests frontend verdes
- Chat renderiza markdown correctamente

**Commit:** `refactor(terminal): remove duplicated rendering, use unified utils/formatMessage`

**Punto de pausa:** SÍ. Verificación visual del chat antes de continuar.

---

### B3.4 — Renderer custom para [ACTION] markers (1-2h)

**Tareas:**
1. Crear extension de marked que detecte `[ACTION] texto` al inicio de párrafo
2. Genera HTML: `<div class="md-action-marker">texto</div>`
3. Estilizar con CSS para verse como badge/bloque destacado (estilo definido en mid-sprint)
4. Verificar que NO interfiere con texto normal que mencione "[ACTION]" en otro contexto

**Verificación:**
- `[ACTION] Configurar Swap (Recomendado)` se ve como bloque destacado
- Texto normal sin marker se renderiza normal
- `[ACTION]` en medio de párrafo (no al inicio) NO se procesa como marker

**Commit:** `feat(rendering): add minimal [ACTION] marker visual styling (B8 partial)`

**Punto de pausa:** SÍ. Verificación visual del marker.

---

### B3.5 — Tests del sistema unificado (1-2h)

**Tareas:**
1. Crear archivo de tests `client/src/utils/__tests__/formatMessage.test.jsx`
2. Implementar los 10-15 tests definidos en Decisión 6
3. Ejecutar `npm test` y verificar que todos pasan
4. Verificar que no hay regresión en tests existentes

**Verificación:**
- Tests nuevos: 10-15/10-15 pasan
- Tests totales frontend: 71-76/71-76 pasan (61 existentes + 10-15 nuevos)

**Commit:** `test(rendering): add coverage for unified markdown system`

---

### B3.6 — Verificación visual + ajustes (1-2h)

**Tareas:**
1. Ricardo prueba en uso real con casos diversos:
   - Pantalla de Playbooks: ejecutar varios playbooks distintos
   - Chat con servidores múltiples
   - Reportes ejecutivos generados
2. Identificar bugs nuevos descubiertos durante uso
3. Aplicar fixes menores
4. Capturar al inbox bugs no críticos para futura sesión

**Posibles ajustes esperados:**
- CSS de listas necesita refinar espaciado (B6 puede no resolverse 100% con marked solo)
- Configuración de marked puede necesitar tweaks (smartypants, breaks, etc.)
- DOMPurify puede ser agresivo con algún tag legítimo

**Commits:** uno o varios `fix(rendering): adjust [encontrados]`

---

### B3.7 — Documentación + commit final (30 min)

**Tareas:**
1. Actualizar este documento con resultado real del sprint
2. Marcar bugs B2-B8 como RESUELTOS en `docs/architecture/2026-04-28-clasificacion-7-ideas.md`
3. Marcar bugs en `docs/inbox/2026-04-27-ideas.md` IDEA #2 y IDEA #5 como cerrados

**Commit:** `docs(architecture): mark rendering bugs B2-B8 resolved per Block 3 sprint`

---

## Cronograma estimado

A 20h/semana, sprint completo:

```
Día 1: B3.1 + B3.2          3-5h
Día 2: B3.3 + B3.4          2-3h
Día 3: B3.5 + B3.6 + B3.7   2.5-4.5h
                            ─────
Total                        8-14h
```

Puede hacerse en menos días con tiempo concentrado.

---

## Riesgos identificados

### Riesgo 1 — Bundle size

**Descripción:** marked + dompurify suman aproximadamente 50KB adicionales.

**Severidad:** baja. KŌDO no es app pública con métricas de Web Vitals críticas. Es herramienta de operación.

**Mitigación:** medir en B3.1 con `npm run build`. Si es problema, evaluar imports parciales de marked.

### Riesgo 2 — Comportamiento diferente a regex actuales

**Descripción:** marked puede renderizar de manera distinta a las regex existentes en casos específicos (anidación de listas, código con triple backtick, etc.).

**Severidad:** media. Puede causar regresión visual en componentes específicos.

**Mitigación:** verificación visual obligatoria en B3.2 con Ricardo. Configuración explícita de marked para mimetizar comportamiento actual donde sea importante.

### Riesgo 3 — Componentes con expectativa de HTML específico

**Descripción:** si DataTable.jsx esperaba `<strong>` y marked emite `<b>`, hay rupturas. CSS puede asumir clases específicas.

**Severidad:** media. Puede causar bugs visuales sutiles.

**Mitigación:** marked emite `<strong>` por defecto (mismo que regex actuales). Verificar con tests.

### Riesgo 4 — DOMPurify agresivo con HTML válido

**Descripción:** DOMPurify puede eliminar atributos legítimos si la configuración es muy estricta.

**Severidad:** media. Puede romper renderización de tablas con clases CSS específicas.

**Mitigación:** configuración explícita de tags y attrs permitidos. Tests específicos para verificar que no se eliminan atributos legítimos.

### Riesgo 5 — Regresión en bugs ya resueltos

**Descripción:** arq-13 (DataTable cells) está resuelto. El nuevo sistema podría regresarlo.

**Severidad:** alta si ocurre. Bug ya resuelto vuelve a aparecer.

**Mitigación:** verificación visual específica de DataTable en B3.2.

---

## Estrategia de rollback

**Disposición explícita de Ricardo:** "si no sale bien, hacemos rollback".

Cada sub-paso es commit-able independientemente. Estrategias de rollback por escenario:

**Si falla B3.1:** `git revert` del commit. Volvemos al estado anterior. Reevaluamos si seguir con regex o intentar con otra librería.

**Si falla B3.2:** `git revert` solo del B3.2. B3.1 (deps instaladas) puede quedar — no afecta funcionalidad.

**Si falla B3.3, B3.4, etc:** rollback del sub-paso específico. Los anteriores se mantienen.

**Si falla todo el approach (marked no funciona como esperamos):** rollback completo a commit anterior a B3.1. Reabrir sesión de Bloque 2 para reconsiderar (regex custom o librería alternativa como markdown-it).

---

## Decisiones diferidas a mid-sprint

### Configuración exacta de marked

Decisión en B3.2 cuando veamos comportamiento real. Opciones a considerar:

```javascript
{
  gfm: true,           // GitHub Flavored Markdown (tables, strikethrough, etc.)
  breaks: false,       // Saltos de línea como <br> (depende de comportamiento del agente)
  smartypants: false,  // Conversión automática de quotes y dashes
  pedantic: false,     // Strict spec adherence
  // ...
}
```

### Estilo CSS del [ACTION] marker

Decisión en B3.4 con feedback visual. Probable: badge con color de acento, tipografía bold, padding generoso, border-radius.

### Manejo de markdown malformado

Decisión en B3.5 según casos edge encontrados. marked es robusto pero el agente puede emitir cosas raras.

---

## Después del sprint

Cuando Bloque 3 esté completo:

1. **Bloque 4 (P2 expandido) puede arrancar.** El sistema de rendering está unificado y robusto.
2. **`[ACTION]` markers se reemplazan en P2** con sistema de bloques semánticos completo (Recommendation, Finding, etc. — algunos ya existen, otros nuevos).
3. **Bugs B2-B8 cerrados formalmente** en clasificación.

---

**Última actualización:** 28 abril 2026, sesión nocturna ~3 AM. Plan técnico vinculante para sprint Bloque 3. Próximo paso: B3.1 (setup de dependencias).

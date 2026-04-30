# Cierre del Sprint Bloque 3 — Rendering Markdown Unificado

**Fecha de cierre:** 29 abril 2026
**Bloque del plan vinculante:** Bloque 3 de 11
**Estimado original:** 12-21h (~1 semana)
**Estimado real:** ~25-30h distribuidas en sesiones del 24-29 abril
**Estado:** COMPLETO

## Contexto inicial

El sprint Bloque 3 fue definido en el documento estrategico vinculante del 28 abril (`docs/architecture/2026-04-28-clasificacion-7-ideas.md`) como respuesta a la decision arquitectural D4: "Rendering Camino A consolidar".

El sprint nacio de la observacion de que el sistema de rendering del cliente (formatMessage.jsx + componentes de display) tenia inconsistencias acumuladas que afectaban la experiencia del operador:

- Cards con bullets no procesaban markdown correctamente
- Tablas con bold en celdas mostraban asteriscos literales
- Headings con `#` aparecian sin procesar
- Listas con guion no se convertian a bullets
- Codigo inline se renderizaba inconsistentemente
- ASCII tables del agente quedaban como texto plano
- El panel "En Vivo" lateral mostraba markdown crudo en previews

Estos sintomas se habian acumulado durante el desarrollo previo del producto y consolidarse en un sprint dedicado fue la decision correcta para no arrastrarlos al siguiente bloque.

## Sub-pasos planeados vs ejecutados

El sprint tenia 7 sub-pasos planeados originalmente. Durante la ejecucion, las realidades tecnicas obligaron a ajustes:

| Sub-paso | Descripcion original                       | Estado    | Notas                                                |
| -------- | ------------------------------------------ | --------- | ---------------------------------------------------- |
| B3.1     | Setup de dependencias (marked + DOMPurify) | COMPLETO  | Ejecutado limpiamente (b4184b7)                      |
| B3.2     | Reescritura de formatMessage.jsx           | COMPLETO  | Mayor refactor del sprint (0ef7734)                  |
| B3.3     | Eliminar duplicacion de Terminal.jsx       | COMPLETO  | 160 lineas de codigo muerto removidas (3c9d08c)      |
| B3.4     | Custom [ACTION:] marker renderer minimo    | EXPANDIDO | Crecio a sub-feature mayor (5efc2b0)                 |
| B3.5     | (No estaba en plan original)               | EMERGENTE | Refactor sistemico de ExecutionPanel (5f611c5)       |
| B3.6     | Verificacion visual + ajustes              | ORGANICO  | Cubierto durante todo el sprint via testing iterativo|
| B3.7     | Documentacion + commit final               | ESTE DOC  | Cierre formal del sprint                             |

## Cronologia condensada del sprint

### Dia 1 (24-25 abril) — Diseño tecnico

Sesion arquitectural produjo el plan tecnico de Bloque 3 con 6 decisiones tecnicas + 7 sub-pasos. Documento vinculante: `docs/architecture/2026-04-28-plan-bloque3-rendering.md`.

Decisiones nucleares: usar marked como parser, DOMPurify como sanitizador, camino sistemico (no parche por componente), API string return + dangerouslySetInnerHTML.

### Dia 2-3 (26-27 abril) — Implementacion B3.1, B3.2, B3.3

B3.1 instalo marked@18.0.2 + dompurify@3.4.1. Setup limpio.

B3.2 reescribio formatMessage.jsx completo. De funcion con regex manuales a sistema marked + sanitize + extension custom. Contrato cambio (string return + dangerouslySetInnerHTML) con corrigida durante implementacion del documento de plan original que decia "compatibilidad cero".

B3.3 elimino 160 lineas de codigo muerto en Terminal.jsx que duplicaban logica de formatMessage. Refactor limpio post-B3.2.

### Dia 4-5 (28-29 abril) — B3.4 expandido + B3.5 emergente

B3.4 originalmente era "renderer custom minimo" para [ACTION:] markers. Durante implementacion crecio a sub-feature mayor: pildoras inline clickeables + modal de confirmacion + integracion con flujo de chatStream. Fue decision consciente de Ricardo escalar el scope porque la UX correcta requeria mas que un renderer minimo.

B3.5 emergio durante implementacion de B3.4 cuando se descubrio que el ExecutionPanel.jsx (panel lateral "En Vivo") rendeaba markdown crudo. Aplicacion de los principios de B3.2 al panel lateral fue refactor sistemico con tres categorias de eventos (MARKDOWN, SHELL, ESTRUCTURA), preview asimetrico (stripMarkdown en headers, formatMessage en expanded), jerarquia visual (border-left + opacity por importancia).

### Dia 5 madrugada (29 abril) — Diagnostico bug pre-existente + Fix C

Durante verificacion visual de B3.4, Ricardo observo comportamiento erratico: pildoras y botones verdes NO aparecian primera vez, solo despues de cambiar de servidor y volver. Diagnostico tecnico profundo (7 investigaciones por Claude Code) revelo que NO era bug de B3.4 sino bug arquitectural pre-existente desde B3.2.

Causa: server emite event.data.blocks en done event, pero getHistory NO los persiste. Cliente bifurca render basado en presencia de blocks. Path bloques estaba subdesarrollado y suprimia features.

Fix C aplicado: forzar blocks=null en cliente en case 'done'. Workaround temporal documentado en IDEA #11. Resolucion definitiva diferida a Bloque 4.

### Dia 5 mañana (29 abril) — Captura de hallazgos + cierre

Capturas estructuradas al inbox:
- IDEA #9: Knowledge Base reingenieria (capturada antes pero relevante al sprint)
- IDEA #10: Panel "En Vivo" pierde historial (captura)
- IDEA #11: Blocks vs markdown rendering divergence (workaround Fix C)
- IDEA #12: SENSEI agente cognitivo (musa estrategica capturada)
- IDEA #13: Bug funcional ALTA, agente comunica autonomia que no tiene
- IDEA #14: Hallazgos UX menores durante B3.4

CLAUDE.md actualizado al plan vinculante de 11 bloques. Sprint Bloque 3 formalmente cerrado con este documento.

## Decisiones tecnicas tomadas durante el sprint

### D-Sprint-1: Marked como parser markdown

Eleccion sobre alternativas (markdown-it, remark, custom regex). Razones:
- Mantenido activamente
- API extensible via marked.use con custom extensions
- Tamaño razonable (~30KB minified)
- Soporta tablas, code blocks, blockquotes nativamente

### D-Sprint-2: DOMPurify como sanitizador

Eleccion sobre alternativas (sanitize-html, custom). Razones:
- Estandar de facto para XSS prevention
- Configuracion declarativa via ALLOWED_TAGS/ALLOWED_ATTR
- Hook system para customizacion (afterSanitizeAttributes)
- Tamaño razonable y trustworthy

### D-Sprint-3: API string return + dangerouslySetInnerHTML

Cambio del contrato original donde formatMessage devolvia React elements. Nuevo contrato: string HTML procesado + sanitizado. Razones:
- Simplifica integracion con MarkedExtensions
- Reduce overhead de re-renders
- Compatible con event delegation para clicks en elementos generados

Trade-off aceptado: requiere disciplina con sanitize config para evitar XSS.

### D-Sprint-4: Refactor sistemico vs parche por componente

Decision arquitectural critica. Plan original era "fix por componente". Durante B3.2 se decidio refactor sistemico: una sola fuente de verdad (formatMessage.jsx) consumida por todos los componentes que renderean texto del agente.

Beneficio: cambios futuros tocan un solo lugar. Bug descubierto en uno ayuda a todos.

Costo: refactor mas largo de lo planeado. Pero pago intereses futuros.

### D-Sprint-5: Custom marked extensions para [ACTION:] markers

En B3.4 se introdujo extension custom de marked para detectar [ACTION:] markers (block-level e inline). Pattern matching + custom renderer que emite HTML de pildora.

Decision sobre alternativas (post-procesamiento del HTML, regex en cliente). Marked extensions son el patron correcto para extender el parser sin romper el flow.

### D-Sprint-6: Modal React custom para confirmacion de actions

Sobre alternativas (window.confirm nativo, libreria de modales). Custom React permite:
- 3 botones diferenciados (Cancelar / Editar / Enviar)
- ESC + click overlay como cancel
- Animaciones slide-up + fade-in
- Integracion con ciclo de vida del componente

### D-Sprint-7: Fix C como workaround temporal documentado

Decision pragmatica. Bug arquitectural mayor descubierto al final del sprint (blocks vs markdown). Resolucion definitiva requiere Bloque 4 (P2 expandido, 50-70h). Fix C es 1 linea de codigo + comentario que mantiene UX funcional hasta Bloque 4.

Decision documentada formalmente en IDEA #11 con recordatorio explicito de revertir Fix C cuando Bloque 4 inicie.

## Hallazgos diferidos al cierre del sprint

Capturados al inbox como IDEAs, NO atacados durante el sprint:

| Hallazgo                          | Severidad | IDEA  | Destino propuesto                |
| --------------------------------- | --------- | ----- | -------------------------------- |
| Knowledge Base reingenieria       | -         | #9    | Sesion arquitectural dedicada    |
| Panel "En Vivo" pierde historial  | ALTA      | #10   | Bloque 5 (P1 Sesion Operativa)   |
| Blocks vs markdown divergence     | -         | #11   | Bloque 4 (P2 expandido) + Fix C  |
| SENSEI agente cognitivo           | -         | #12   | Sesion arquitectural dedicada    |
| Agente comunica autonomia falsa   | ALTA      | #13   | Bloque 6 (P6) o SENSEI           |
| Botones overflow + pildoras lateral| MEDIA/BAJA| #14   | Bloque 10 (Sistema de Diseño)    |

## Metricas del sprint

### Commits y merges

Commits y merges durante el sprint (orden cronologico):

| Hash    | Descripcion                                          |
| ------- | ---------------------------------------------------- |
| b4184b7 | B3.1 Setup deps                                      |
| 0ef7734 | B3.2 formatMessage rewrite                           |
| 4015062 | B3.3 Terminal.jsx duplication removal                |
| 3c9d08c | B3.3 merge                                           |
| 3c5d790 | B3.5 ExecutionPanel refactor                         |
| 5f611c5 | B3.5 merge                                           |
| 12d6127 | IDEA #9 capture                                      |
| 0fda8f6 | IDEA #9 merge                                        |
| 19de83a | IDEA #10 capture                                     |
| de9724f | IDEA #10 merge                                       |
| 6496512 | IDEA #11 capture                                     |
| ea00b62 | IDEA #11 merge                                       |
| 349fbd2 | B3.4 + Fix C                                         |
| 5efc2b0 | B3.4 merge                                           |

(Sesion 29 abril dia)

| Hash    | Descripcion                                          |
| ------- | ---------------------------------------------------- |
| a9b8dc7 | CLAUDE.md update to vinculante 11-block plan         |
| 6a0d5a0 | CLAUDE.md update merge                               |
| 649fd4d | IDEA #12 SENSEI capture                              |
| f0b18d7 | IDEA #12 merge                                       |
| 6dd27e4 | IDEA #13 capture                                     |
| e03ae6c | IDEA #13 merge                                       |
| e8a486a | IDEA #14 capture                                     |
| e1a9142 | IDEA #14 merge                                       |
| (Este commit) | B3.7 cierre sprint Bloque 3                    |

### Codigo

| Metrica               | Antes del sprint | Despues del sprint | Delta              |
| --------------------- | ---------------- | ------------------ | ------------------ |
| Bundle JS             | ~340 KB          | 373.45 KB          | +33 KB (+0.2 gzip) |
| Bundle CSS            | ~50 KB           | 64.06 KB           | +14 KB (+1.5 gzip) |
| Tests frontend        | 50               | 61                 | +11                |
| Tests backend         | 163              | 163                | sin cambio         |
| Lineas formatMessage  | ~80              | ~150               | +70 (refactor)     |

### Documentacion

| Documento                                         | Lineas  |
| ------------------------------------------------- | ------- |
| 2026-04-28-plan-bloque3-rendering.md              | 409     |
| Inbox 27-abril-ideas.md (al inicio del sprint)    | ~700    |
| Inbox 27-abril-ideas.md (al cierre del sprint)    | 1875    |
| Este documento de cierre                          | (este)  |

## Lecciones de proceso documentadas

### Leccion 1: Refactor sistemico paga intereses

B3.2 podria haber sido parche por componente (mas rapido inicialmente). Optar por refactor sistemico (una sola fuente de verdad) tomo mas tiempo en el momento pero hizo que B3.5 fuera implementable en horas en lugar de dias.

Aplicabilidad futura: cuando se enfrente decision parche vs sistemico en codigo compartido, considerar costo de mantenimiento futuro.

### Leccion 2: Bugs erraticos requieren diagnostico profundo, no fix improvisado

Bug de pildoras "primera vez no aparecen" inicialmente parecia race condition o cache. Diagnostico improvisado habria producido fix incorrecto. Las 7 investigaciones de Claude Code revelaron que era bug arquitectural pre-existente.

Aplicabilidad futura: cuando un bug parece erratico, invertir en diagnostico profundo antes de fix. La causa rara vez es lo obvio.

### Leccion 3: Cache HMR de Vite enmascara cambios profundos

Durante verificacion visual de B3.2 y B3.5, los cambios no aparecian en el browser despite hard refresh. Reinicio completo de servicios fue necesario para confirmar funcionamiento.

Aplicabilidad futura: cuando refactor toca shared utilities, verificacion visual requiere reinicio completo de servicios, no solo hard refresh.

### Leccion 4: Workarounds bien documentados son aceptables

Fix C es workaround. Pero esta documentado en IDEA #11 con causa raiz, opciones de resolucion definitiva, recordatorio explicito de revertir cuando se inicie Bloque 4.

Aplicabilidad futura: cuando solucion definitiva requiere mas trabajo del disponible, workaround documentado con plan de resolucion es mejor que postergar la feature completa.

### Leccion 5: Captura disciplinada al inbox previene perdida de contexto

6 IDEAs capturadas durante el sprint (#9, #10, #11, #12, #13, #14). Sin esa disciplina, varias decisiones arquitecturales mayores se habrian perdido en el ruido del trabajo diario.

Aplicabilidad futura: capturar tangencialmente al inbox cuando aparezcan ideas o bugs, no esperar al final del sprint.

### Leccion 6: Estimados fueron optimistas pero el rango sirvio

Plan original: 12-21h. Real: ~25-30h. Sobrepaso de ~50% sobre el extremo alto del rango. El rango cubrio mejor que el estimado puntual habria hecho.

Aplicabilidad futura: mantener estimados con rangos honestos. Sobrepasos del 50% son comunes cuando aparecen sub-features emergentes (B3.5) o bugs estructurales (Fix C).

### Leccion 7: Decision sobre escalar scope debe ser consciente

B3.4 originalmente era "renderer minimo". Crecio a feature mayor con modal + flujo. Esa decision se tomo conscientemente con autorizacion de Ricardo despues de articular trade-offs.

Aplicabilidad futura: si durante implementacion el scope crece, hacer la decision explicita de escalar o postergar, no escalar implicitamente.

## Estado del plan vinculante post-sprint

| #   | Bloque                                              | Estado pre-sprint | Estado post-sprint  |
| --- | --------------------------------------------------- | ----------------- | ------------------- |
| 1   | P7.1 cross-server feed contamination                | COMPLETO          | COMPLETO            |
| 2   | Decision-Rendering Camino A                         | COMPLETO          | COMPLETO            |
| 3   | Sprint rendering markdown unificado                 | EN CURSO          | COMPLETO (este)     |
| 4   | P2 expandido completo                               | PENDIENTE         | PENDIENTE           |
| 5-11| Resto del plan                                      | PENDIENTE         | PENDIENTE           |

## Recordatorios criticos para Bloque 4 (P2 expandido)

Cuando se inicie Bloque 4, leer estos en orden:

1. **IDEA #11 completa** — entender el bug arquitectural blocks vs markdown
2. **Decision A/B/C de IDEA #11** — decidir camino de resolucion (recomendacion sin compromiso: Opcion A "completar path bloques")
3. **Si A elegido: REVERTIR Fix C** en Terminal.jsx case 'done'. Cambiar `blocks: null` por `blocks: event.data.blocks || null` y completar el path bloques con todos los componentes faltantes.
4. **Auditar semantic-parser server-side** — el parser que genera blocks tiene historial de outputs inconsistentes (ver `docs/semantic-parser-bugs.md` si existe)
5. **Persistir blocks en DB** — actualmente getHistory no los retorna. Migracion de schema necesaria.
6. **Definir contrato formal de blocks** — schema, tipos, validation
7. **Considerar IDEA #5** — bugs B11/B16/B17 viven en path bloques y se resolveran junto con P2 expandido

## Cierre formal

Sprint Bloque 3 cerrado el 29 abril 2026.

Sub-pasos B3.1 a B3.6 completos. B3.7 es este documento.

Bloque 4 habilitado para inicio cuando Ricardo decida.

Decisiones arquitecturales del sprint preservadas en este documento + en las 6 IDEAs capturadas + en los commits con mensajes detallados.

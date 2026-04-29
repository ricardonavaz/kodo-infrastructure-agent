# CLAUDE.md — Notas para Claude Code

## Como leer este archivo

Este archivo es la guia operacional para Claude Code trabajando en KODO
Infrastructure Agent. Lee este archivo COMPLETO antes de cada sesion. Si
hay conflicto entre instrucciones, prevalece el plan estrategico vinculante
del 28 abril.

## Plan estrategico vinculante

El plan vinculante actual esta en:

`docs/architecture/2026-04-28-clasificacion-7-ideas.md`

Ese documento procesa 32 items de 7 IDEAs estrategicas, cierra 5 decisiones
arquitecturales, y define 11 bloques secuenciales con estimados (7-12 meses
a MVP a 20h/semana).

NO improvisar orden de trabajo. NO comenzar bloques fuera de orden sin
autorizacion explicita de Ricardo. Siempre consultar ese plan + estado
actual del sprint en curso antes de proponer trabajo.

## Plan de 11 bloques con estado actual

| #   | Bloque                                              | Estimado          | Estado       |
| --- | --------------------------------------------------- | ----------------- | ------------ |
| 1   | P7.1 — Bug cross-server feed contamination          | 2-4h              | COMPLETO     |
| 2   | Decision-Rendering (Camino A) sesion tecnica        | 1h                | COMPLETO     |
| 3   | Sprint rendering markdown unificado                 | 12-21h (1 sem)    | EN CURSO 6/7 |
| 4   | P2 expandido completo                               | 50-70h (3 sem)    | PENDIENTE    |
| 5   | P1 — Sesion Operativa                               | 15-25h (1.5 sem)  | PENDIENTE    |
| 6   | P6 — Comportamiento Agentico + Modo Didactico       | 30-50h (2 sem)    | PENDIENTE    |
| 7   | P3 + P4 Multi-Servidor + Pantalla Consolidada       | 30h (1.5 sem)     | PENDIENTE    |
| 8   | P7-NEW Connection Management                        | 30h (1.5 sem)     | PENDIENTE    |
| 9   | P5 Tareas Programadas + LearnOps                    | 80-100h (5 sem)   | PENDIENTE    |
| 10  | Sistema de Diseño completo                          | 160-320h (8 sem)  | PENDIENTE    |
| 11  | P3.1 Reporte Premium ejecutivo                      | 120-200h (5 sem)  | PENDIENTE    |

## Sprint Bloque 3 — estado detallado

| Sub-paso | Descripcion                                | Estado    | Commit  |
| -------- | ------------------------------------------ | --------- | ------- |
| B3.1     | Setup deps (marked + DOMPurify)            | COMPLETO  | b4184b7 |
| B3.2     | Reescritura formatMessage.jsx              | COMPLETO  | 0ef7734 |
| B3.3     | Eliminar duplicacion Terminal.jsx          | COMPLETO  | 3c9d08c |
| B3.4     | ACTION pills + modal + Fix C               | COMPLETO  | 5efc2b0 |
| B3.5     | Refactor sistemico ExecutionPanel          | COMPLETO  | 5f611c5 |
| B3.6     | Verificacion visual                        | COMPLETO  | (cubierto durante sprint) |
| B3.7     | Documentacion de cierre del sprint         | PENDIENTE | -       |

## Inbox estrategico

`docs/inbox/2026-04-27-ideas.md` contiene IDEAs estrategicas con decisiones
arquitecturales diferidas. Al 29 abril hay 11 IDEAs capturadas. Consultar
antes de tomar decisiones que puedan colisionar.

### IDEAs criticas

**IDEA #11 — blocks vs markdown rendering divergence:**
Cuando se inicie Bloque 4 (P2 expandido), REVERTIR Fix C en
Terminal.jsx case 'done' del handleStreamEvent. Fix C es workaround
temporal documentado.

**IDEA #9 — Knowledge Base / LearnOps reingenieria:**
Insight estrategico fundamental sobre como el sistema de KB de KODO debe
funcionar. Reframe parcial del scope de IDEA #4 (LearnOps). Decision
arquitectural mayor diferida.

**IDEA #10 — Panel "En Vivo" pierde historial:**
Bug funcional + decision arquitectural sobre semantica En Vivo vs
Historial. Pertenece a Bloque 5 (P1 Sesion Operativa).

## Bugs activos pendientes de captura

Bugs identificados en sesion 29 abril madrugada, pendientes de captura
formal al inbox:

1. Bug B — Agente comunica autonomia que no tiene
   ("reconectando automaticamente..." cuando NO reconecta)
   Severidad: ALTA. Fix futuro en Bloque 6 (P6) via prompts/playbooks/KB.

2. Bug C — Botones Acciones Sugeridas overflow ancho del feed
   Severidad: MEDIA. Fix CSS trivial 15-30 min.

3. Hallazgo — Pildoras [ACTION:] aparecen en panel lateral expandido pero
   no son clickeables (no hay handler de event delegation alli).
   Severidad: BAJA. Decision arquitectural diferida.

## Decisiones arquitecturales vinculantes (28 abril)

D1 — P2 expandido completo (50-70h, NO dividido en sub-fases)
D2 — Crear Primitiva 7: Connection Management (~30h)
D3 — Sistema de Diseño antes de continuar primitivas P3+ (160-320h, 4-8 sem
     dedicadas) — Camino C hibrido: shadcn/ui + Lucide + tokens KODO
D4 — Rendering Camino A consolidar (B3 completara)
D5 — Orden de 11 bloques confirmado

## Reglas operacionales del repo

- Nunca commit directo a main — siempre rama nueva con formato
  `rrl/paso-{id}-{slug}`
- Nunca `git commit` ni `git push` sin autorizacion explicita de Ricardo
- Despues de un commit + merge a main exitoso, eliminar la rama local y
  remota como parte del cleanup
- Tests backend con `node:test` (no Jest/Vitest), corren con `npm test`
  desde `server/`
- Tests frontend con vitest desde `client/`
- Sin nuevas dependencias sin permiso explicito
- JS puro (no TypeScript)
- Despues de refactor que toca shared utilities, verificacion visual
  requiere reinicio completo de servicios (no solo hard refresh) por
  posible cache HMR

## Disciplina de proceso

- Subpasos: analisis -> implementacion -> verificacion visual -> commit
  -> merge
- Captura tangencial automatica al inbox cuando aparecen ideas o bugs
  durante el trabajo
- Documentacion como infraestructura: cada decision arquitectural mayor
  produce documento en docs/architecture/
- Estimados honestos (rangos, no numeros unicos)
- Ricardo decide pivotes, no Claude Code

## Tono y comunicacion

- Sin emojis en commits, codigo, ni comunicacion tecnica
- Comunicacion directa, sin halagos ni adulaciones
- Cuando hay conflicto entre opciones, articularlo claramente y pedir
  decision en lugar de improvisar
- Cuando se identifica un bug, primero diagnosticar profundamente antes
  de proponer fix

## Plan tactico anterior (REFERENCIA HISTORICA - PARCIALMENTE OBSOLETO)

El plan A1/A2/A3 (Model router, Prompt caching, Tests del parser semantico)
y B1/B2/C1/C2/C3 (Adapter legacy, RRL Schema v1.1, Hipertexto, Mermaid,
bloques visuales) era valido antes del 28 abril. La spec RRL sigue vigente
como referencia de "que construir", pero el orden lo dicta ahora el plan
de 11 bloques.

Items potencialmente recuperables del plan tactico viejo:
- Tests al parser semantico (A3) -> probablemente parte de Bloque 4 P2 expandido
- RRL Schema v1.1 -> contrato de blocks definido en Bloque 4
- Hipertexto + Mermaid + bloques visuales (C1-C3) -> distribuido en Bloques 4
  y 11

## Cronotipo del operador

Ricardo opera con cronotipo nocturno (productivo desde 14:00 hasta madrugada).
NO equivale a fatiga. Recalibrar logica de horarios — no asumir que noche =
dormir.

## Estado de salud del proyecto

- Tests: 163 backend / 61 frontend / 224 total
- Bundle frontend: 373.45 KB JS / 64.06 KB CSS
- Inbox: 11 IDEAs estrategicas capturadas
- Documentacion: plan vinculante 28 abril + plan tecnico Bloque 3 +
  funcionalidad central
- Working tree limpio salvo client/docs/ (preexistente untracked)

## Ultimos commits relevantes

5efc2b0 Merge B3.4 + Fix C
349fbd2 feat(action-buttons): pills + modal + Fix C (B3.4)
ea00b62 Merge IDEA #11
6496512 docs(inbox): IDEA #11
de9724f Merge IDEA #10
19de83a docs(inbox): IDEA #10
0fda8f6 Merge IDEA #9
12d6127 docs(inbox): IDEA #9
5f611c5 Merge B3.5
3c5d790 refactor(execution-panel): B3.5
3c9d08c Merge B3.3
4015062 refactor(terminal): B3.3
10dcb22 fix(connections): cross-server feed contamination (Bloque 1)

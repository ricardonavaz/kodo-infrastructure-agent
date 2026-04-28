# Clasificación Estratégica de las 7 IDEAs del 27 Abril + Decisiones Arquitecturales

**Fecha:** 28 de abril de 2026 (sesión nocturna 12:30-2:30 AM)
**Autor:** Ricardo Nava (founder, primer cliente) + Claude (asistente)
**Estado:** Decisiones arquitecturales cerradas. Vinculante para próximos 7-12 meses del proyecto.
**Origen:** Sesión conversacional de clasificación de las 7 IDEAs capturadas en `docs/inbox/2026-04-27-ideas.md` (757 líneas, sin procesar).

---

## Propósito de este documento

Procesar formalmente las 7 IDEAs estratégicas capturadas durante el 27 abril (32 items individuales), clasificarlas en buckets accionables, y derivar decisiones arquitecturales mayores que definen el rumbo de KŌDO Infrastructure Agent para los próximos 7-12 meses.

Este documento es **vinculante** para el diseño técnico subsiguiente. Las decisiones aquí no son sugerencias — son compromisos que determinan qué se construye, en qué orden, y qué se difiere a fases posteriores.

---

## Resumen ejecutivo

Las 7 IDEAs del inbox del 27 abril revelaron tres tipos de inputs:

1. **Bugs concretos** (visuales, funcionales, arquitecturales)
2. **Features mayores** (Modo Didáctico, LearnOps, Reporte Premium)
3. **Decisiones arquitecturales pendientes** (Sistema de Rendering, Sistema de Diseño)

La clasificación se cerró con **5 decisiones arquitecturales** que definen el plan de implementación. La más impactante: D3 (abordar Sistema de Diseño antes de continuar primitivas P3+) extiende el cronograma a 7-12 meses pero asegura calidad visual aspirada.

---

## Inventario clasificado: 32 items en 8 buckets

### Bucket 1 — Bug-Bloqueante (1 item)

Bug funcional crítico que viola principios fundamentales de las primitivas. Prerequisito para que P1 y P3 funcionen correctamente. **Atender PRIMERO.**

- **P7.1** — Cross-server feed contamination (eventos de un servidor aparecen en feed de otro)

### Bucket 2 — Bug-Pulido (8 items)

Bugs visuales que afectan presentación pero no funcionalidad. Se atienden en sprint dedicado de rendering, NO bug por bug.

- **B2** — `>` verde sin contexto (blockquote no consume carácter)
- **B3** — `**` asimétrico, asterisco suelto al final
- **B4** — `#` headings no procesados
- **B5** — `###` headings no procesados (también referenciado como B15)
- **B6** — Listas con espaciado vertical excesivo
- **B7** — Listas con guión no convertidas a bullets
- **B9** — ASCII tables del agente no convertidas (probable: prompt fix)
- **B11** — Mala alineación de etiquetas en cards de acciones
- **B12** — Confusión semántica MEDIA + low en cards

### Bucket 3 — P2-Expansion (8 items)

Items que entran en el scope expandido de P2 (Playbook Formalizado). Refuerzan persistencia, output detallado, CRUD completo, y comunicación de acciones.

- **P1.1** — Historial guardar resultado detallado (no solo estado)
- **P1.2** — Mostrar diagnóstico/salida/warnings/decisiones/hallazgos
- **P1.7** — ID de playbook visible (`PB-{cat}-{slug}-{nro}`)
- **P1.8** — Editar/duplicar/modificar playbooks (CRUD completo)
- **P1.11** — Reporte final SIEMPRE obligatorio
- **P1.13** — Bitácora operacional verbosa, auditable
- **B8** — Markers `[ACTION]` no procesados como bloques de acción
- **B10** — Cards "Acciones Completadas" sin contenido legible

### Bucket 4 — P5-Expansion (5 items)

Items que entran en el scope de P5 (Tareas Programadas) cuando se construya. NO se trabajan antes.

- **P1.3** — Mejorar UX creación tareas programadas
- **P1.4** — Botón IA para configurar tareas
- **P1.5** — Cron visual/asistido
- **P1.9** — Comportamiento configurable ante warnings/preguntas/acciones (8 opciones)
- **P1.12** — Notificaciones email/WhatsApp/webhook/internas (7 canales)

### Bucket 5 — Primitiva-Nueva (1 item, justifica P7)

Item que NO encaja en P1-P6 originales y justifica formalizar Primitiva 7.

- **P1.6** — Editar/duplicar/deshabilitar conexiones a servidores → **Justifica P7 — Gestión de Conexiones**

### Bucket 6 — Modo-Operacion (3 items)

Extensiones ortogonales de primitivas existentes. NO son primitivas nuevas.

- **P1.10** — IA que sugiera/ejecute acciones bajo reglas (extiende P6)
- **P4.1** — Modo Didáctico (extiende P6 con eje pedagógico)
- **P4.2** — Modo LearnOps (extiende P1 con análisis post-cierre + generación de playbook). Sustancial: 64-96h.

### Bucket 7 — Decision-Arquitectural (6 items)

Items que requieren decisión mayor antes de implementar. Cuatro de ellos (B13/B14/B16/B17) son síntomas que se resuelven con la decisión arquitectural correspondiente.

- **Decision-Rendering** — Sistema rendering markdown unificado (3 caminos posibles)
- **P6.1** — Sistema de Diseño completo (3 caminos posibles)
- **B13** — Sistema colores incoherente entre badges (resuelto por Sistema de Diseño)
- **B14** — Iconografía menú lateral pobre (resuelto por Sistema de Diseño)
- **B16** — Falta jerarquía visual en stream (resuelto por Sistema de Diseño)
- **B17** — Densidad informacional excesiva (resuelto por Sistema de Diseño)

### Bucket 8 — Aspiracional (2 items)

Visión a futuro post-MVP. Dependen de primitivas implementadas y Sistema de Diseño definido.

- **P3.1** — Sistema completo de generación de reportes premium (7 elementos)
- **P4.3** — Replay Inteligente (sub-feature de LearnOps, ejecutar sesión aprendida en otro servidor)

---

## Las 5 decisiones arquitecturales

### Decisión 1 — Scope de P2: EXPANDIDO COMPLETO

**Decisión:** P2 (Playbook Formalizado) se ejecuta como bloque único expandido, NO se divide en P2-core + P2.5-expansion.

**Scope final de P2:**

Originalmente:
- Schema additions (identidad formal `PB-{cat}-{slug}-{nro}`)
- Migración de los 11 playbooks existentes
- Validación compatibilidad bloqueo duro
- Política builtins
- Frontend forms y badges
- Tool `run_playbook` en chat
- Tests de regresión

Más expansión (Bucket 3 — 8 items):
- Persistencia detallada de runs (P1.1, P1.13)
- Output detallado en historial mostrando diagnóstico/salida/warnings/decisiones/hallazgos (P1.2)
- ID de playbook visible en UI (P1.7)
- CRUD completo de playbooks: editar, duplicar, modificar (P1.8)
- Reporte final obligatorio al cerrar run (P1.11)
- Procesamiento de markers `[ACTION]` como bloques de acción (B8)
- Cards de Acciones Completadas con contenido legible y diferenciado (B10)

**Estimado realista de P2 expandido:** 50-70h (2.5-3.5 semanas a 20h/semana).

**Justificación de no dividir:** los items van juntos arquitecturalmente. Persistencia detallada, output en historial, CRUD, y reporte final son una unidad coherente. Separar crearía fronteras artificiales que complican el diseño y la implementación. Mejor un sprint sostenido que dos sprints fragmentados.

### Decisión 2 — Crear Primitiva 7 (Connection Management): SÍ

**Decisión:** Formalizar Primitiva 7 — Gestión de Conexiones como primitiva propia con diseño funcional dedicado.

**Justificación:**

Las conexiones a servidores son el activo más fundamental de KŌDO. Sin conexiones no hay agente operando. El mensaje original de Ricardo del 27 abril fue explícito: *"deberían poder revisarse, editarse, duplicarse, deshabilitarse, reactivarse y modificarse de forma controlada, manteniendo trazabilidad de cambios y evitando afectar tareas programadas existentes sin advertencia previa."*

Sin tratamiento formal, esto quedaría como configuración ad-hoc fragmentada. Tratarlo como Primitiva 7 le da el rigor de diseño funcional que merece.

**Scope inicial de P7 (a articular en sesión dedicada futura):**

- CRUD completo de conexiones
- Estados de conexión: activa, inactiva, deshabilitada
- Trazabilidad de cambios (audit log)
- Validación de impacto antes de modificar (especialmente vs Tareas Programadas existentes)
- Posible: agrupación de conexiones (clientes, entornos, ambientes)
- Posible: tags/etiquetas para filtrado en Sesión Multi-Servidor (P3)

**Estimado preliminar:** ~30h (~1.5 semanas).

**Implicación para documento existente:** `docs/architecture/2026-04-26-funcionalidad-central.md` debe actualizarse en sesión futura para incluir P7 como séptima primitiva. El documento original quedó con 6, ahora son 7.

### Decisión 3 — Cuándo abordar Sistema de Diseño: ANTES DE CONTINUAR PRIMITIVAS P3+

**Decisión:** Pausar primitivas funcionales nuevas (P3, P5, P7-NEW, etc.) después de tener P1+P2+P6 implementadas, abordar Sistema de Diseño completo, y solo entonces continuar primitivas.

**Esta es la decisión más impactante de las 5.** Extiende el cronograma significativamente pero asegura calidad visual aspirada.

**Justificación:**

- Tener P1+P2 implementadas da feedback real sobre qué componentes UI necesitan diseño
- Es prematuro construir más primitivas con UI inconsistente — cada nueva primitiva hereda los problemas de diseño actuales
- El reporte premium aspirado (IDEA #3) requiere Sistema de Diseño definido para alcanzar calidad
- Sistema de Diseño aborda 4 bugs visuales (B13/B14/B16/B17) sistémicamente en lugar de fix por fix

**Implicación temporal:**

Después de P1+P2+P6 funcionando, hay pausa de 4-8 semanas dedicada exclusivamente a Sistema de Diseño antes de continuar con P3, P4, P5, P7-NEW, etc. Durante esa pausa NO hay primitivas nuevas funcionando para el operador.

**Ricardo confirmó esta decisión consciente** al validar que el uso real actual (sesión 26h+ en AV Securities WEB con UI funcional pero imperfecta) es aceptable durante la fase de construcción.

### Decisión 4 — Sistema de Rendering Markdown: CAMINO A (CONSOLIDAR)

**Decisión:** Consolidar todo el rendering markdown en UN sistema con cobertura completa. Eliminar la duplicación entre `formatMessage.jsx` (utils) y `Terminal.jsx` (local).

**Justificación:**

- Es el camino con menos deuda técnica futura
- Los 8 bugs actuales (B2-B9 + B15) son síntomas de la divergencia entre dos sistemas paralelos, no del markdown en sí
- Estimado del refactor: 12-21h dedicadas
- Una vez consolidado, agregar features de markdown nuevas (headings, blockquotes, listas con guión, etc.) toma una vez en lugar de dos veces

**Caminos descartados:**

- Camino B (mantener dos paths con cobertura completa): perpetúa complejidad y riesgo de divergencia futura
- Camino C (agente solo usa blocks semánticos, no markdown puro): rigidez excesiva, el agente pierde flexibilidad expresiva

**Implicación:** sprint dedicado de rendering markdown que va INMEDIATAMENTE después del fix del bug cross-server (P7.1). Aborda los 8 bugs visuales más la consolidación de los dos sistemas.

### Decisión 5 — Orden de implementación final: CONFIRMADO

**Decisión:** El orden propuesto se acepta sin cambios. Se ejecuta de forma secuencial con cada bloque commit-able.

```
Bloque 1.   P7.1 — Bug cross-server feed contamination
            Estimado: 2-4h
            Justificación: Bug funcional crítico, prerequisito de P1 y P3.

Bloque 2.   Decision-Rendering (Camino A) — sesión de diseño técnico
            Estimado: 1h
            Justificación: Define cómo se va a consolidar antes de tocar código.

Bloque 3.   Sprint rendering markdown unificado (Camino A)
            Estimado: 12-21h (~1 semana)
            Justificación: Aborda los 8 bugs de rendering + consolidación de
            formatMessage.jsx y Terminal.jsx en un solo sistema.

Bloque 4.   P2 expandido completo (Decision 1)
            Estimado: 50-70h (~2.5-3.5 semanas)
            Justificación: Identidad formal + motor único + chat invocation +
            8 items de expansión (persistencia, CRUD, ID visible, reporte
            obligatorio, [ACTION] markers, cards con contenido).

Bloque 5.   P1 — Sesión Operativa
            Estimado: 15-25h (~1-1.5 semanas)
            Justificación: Contenedor donde todo lo demás vive. Una vez P2
            existe, P1 puede construirse encima.

Bloque 6.   P6 — Comportamiento Agéntico Real + Modo Didáctico
            Estimado: 30-50h (~2 semanas)
            Justificación: Atraviesa todas las primitivas. Modo Didáctico
            (P4.1) y P1.10 (IA bajo reglas) son extensiones ortogonales.

Bloque 7.   P3 + P4 — Sesión Multi-Servidor + Pantalla Consolidada
            Estimado: ~30h (~1.5 semanas)
            Justificación: Construyen sobre P1+P2 ya funcionando.

Bloque 8.   P7-NEW — Connection Management (Decision 2)
            Estimado: ~30h (~1.5 semanas)
            Justificación: Primitiva nueva formalizada en esta sesión.

Bloque 9.   P5 — Tareas Programadas + LearnOps
            Estimado: 80-100h (~4-5 semanas)
            Justificación: Tareas Programadas (P5 original ~40h) + LearnOps
            extendido (~64-96h, P4.2 del bucket 6). LearnOps es extensión
            sustancial de P1 que requiere análisis IA post-sesión.

Bloque 10.  Sistema de Diseño completo (Decision 3)
            Estimado: 160-320h (4-8 semanas dedicadas)
            Justificación: Aborda B13/B14/B16/B17 sistémicamente + define
            tipografía, colores, iconografía, espaciado, componentes
            reutilizables. Camino C híbrido: shadcn/ui + Lucide + tokens KODO.

Bloque 11.  P3.1 — Reporte Premium ejecutivo
            Estimado: 120-200h (~3-5 semanas)
            Justificación: Solo viable después de P1+Sistema de Diseño. Es
            la materialización visual de la aspiración de IDEA #3.
```

**Total realista a MVP completo: 7-12 meses a 20h/semana sostenido.**

---

## Items diferidos formalmente

Los siguientes items se difieren a fases posteriores al MVP completo:

- **P4.3** — Replay Inteligente (Bucket 8). Solo viable después de LearnOps funcionando.
- Mejoras adicionales del sistema de notificaciones más allá de email + in-app inicial (Slack, SMS, Microsoft Teams) — diferidas a post-MVP.
- Sistema de roles fino y permisos por rol (decisión diferida en diseño funcional original) — diferido a fase de equipo, hoy Ricardo es solo founder.

---

## Implicaciones para documentos existentes

Esta clasificación impacta los siguientes documentos previos:

### `docs/architecture/2026-04-26-funcionalidad-central.md` (581 líneas)

- **Pendiente:** agregar sección sobre Primitiva 7 — Gestión de Conexiones (Decision 2)
- **Pendiente:** agregar sección sobre Modos de Operación Extendidos (Modo Didáctico + LearnOps, Bucket 6)
- **Pendiente:** consolidar el orden de implementación con el plan de Bloques 1-11 de este documento

Estas actualizaciones se hacen en sesión futura dedicada, NO en este commit.

### `docs/decisions/2026-04-24-framing-proyecto.md`

- **Implicación:** la Decisión 4 original (priorización Ondas multi-OS) queda parcialmente invalidada porque el Bloque 1 fija el cronograma en primitivas, no en multi-OS. Esto ya estaba parcialmente reconocido en el insight del 26 abril.

---

## Próxima acción inmediata

**Bloque 1 — Diagnosticar y arreglar bug cross-server feed contamination (P7.1).**

Estimado: 2-4h en una sesión.

Pasos:
1. Diagnóstico de gestión de SSE conexiones por `connectionId`
2. Revisión de Terminal.jsx y manejo de feeds al cambiar servidor
3. Identificar causa raíz (probable: event listeners no limpiados al cambiar de servidor, o jobId no aislado por connectionId)
4. Aplicar fix con tests de regresión
5. Verificación visual con Ricardo en producción real

Una vez resuelto P7.1, arrancar Bloque 2 (decisión técnica de Camino A para rendering).

---

## Estado del proyecto al cerrar esta sesión

**Main esperado:** este documento commiteado a `docs/architecture/2026-04-28-clasificacion-7-ideas.md`.

**Inbox 27 abril:** 7 IDEAs procesadas formalmente. Quedan en el inbox como referencia histórica pero su contenido está clasificado y absorbido en este documento.

**Cronograma comprometido:** 7-12 meses a MVP completo con 20h/semana sostenido. Hito intermedio importante: P1+P2+P6 funcionando antes de pausar para Sistema de Diseño (estimado 4-5 meses desde hoy).

**Riesgo principal identificado:** la pausa de 4-8 semanas para Sistema de Diseño (Decisión 3) extiende el cronograma significativamente. Si durante la construcción aparecen razones para revisar esa decisión (presión externa, cambio de contexto, oportunidad comercial), se puede reabrir en sesión dedicada.

---

**Última actualización:** 28 abril 2026, sesión nocturna 12:30-2:30 AM, clasificación completa de 32 items en 8 buckets con 5 decisiones arquitecturales vinculantes. Próximo paso: Bloque 1 (bug cross-server fix).

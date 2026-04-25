# Decisiones formales — 2026-04-24

**Fecha:** Viernes 24 de abril de 2026
**Sesión:** Continuación post-cierre nocturno del 19 abril
**Contexto:** Después de implementar el sistema de inbox inteligente y procesar las ideas estratégicas capturadas durante la sesión, Ricardo y Claude formalizaron las decisiones que definen el rumbo del proyecto KŌDO en los próximos 3-4 meses.

Este documento es la primera entrada formal en `docs/decisions/`. Su propósito es preservar el contexto y razonamiento de las decisiones tomadas, no solo las decisiones mismas.

---

## Decisión 1 — Framing fundamental del proyecto

### Contexto

Durante la sesión, Ricardo aclaró tres puntos críticos que cambian cómo se debe pensar KŌDO:

1. **Ricardo es el primer cliente.** No hay clientes externos buscando product-market-fit. El proyecto nace de su necesidad operacional real.

2. **Tiene el ambiente que el producto pretende servir.** Routers, switches, VMware, múltiples sistemas operativos heterogéneos.

3. **No hay monetización primero.** El proyecto resuelve una necesidad propia que es representativa de organizaciones similares a la suya.

Texto literal de Ricardo:

> *"el primer cliente soy yo mismo, y tengo ese ambiente que se describe, routers, switches, vmware, multiple OS, etc y no hay el concepto de monetización primero, esto es un proyecto que nace de una necesidad que es la necesidad de toda organización similar a la mía."*

> *"la idea es llegar a tener un agente de infraestructura capaz de resolver cualquier situación, y mantener la infraestructura."*

### Decisión

**KŌDO se construye como una plataforma de operación de infraestructura completa**, capaz de manejar Windows, Linux, BSD, macOS, network devices (switches, routers), firewalls, hipervisores y dispositivos legacy.

**El criterio de éxito no es validación de mercado**, sino:

> *"¿Puedo gestionar mi infraestructura completa con KŌDO en lugar de saltar entre 7 herramientas distintas?"*

Cada onda de implementación debe permitir migrar una porción de la operación real de Ricardo a KŌDO. Si después de 3 meses no puede operar ningún subset de su infraestructura desde KŌDO, el proyecto está fallando.

### Implicaciones

1. **Arquitectura desde día uno debe ser correcta** para soportar multi-protocolo, multi-OS, multi-device-type. No se construyen módulos aislados que requieran rewrite cuando lleguen los siguientes tipos de activos.

2. **Las features se priorizan por su impacto en la operación real de Ricardo**, no por su atractivo de marketing.

3. **El documento de Asset Discovery Model que Ricardo escribió es referencia arquitectural**, no aspiración a largo plazo. Define el norte del producto.

### Estado

**Aceptada** — formalizada hoy. Reemplaza framing anterior de "Sprint K1 como módulo de Knowledge Base aislado" por "ondas de implementación de la visión de Asset Discovery completa".

---

## Decisión 2 — Estrategia de implementación: Opción B+C

### Contexto

Se discutieron tres opciones para abordar la implementación de la visión de Asset Discovery:

**Opción A — Sprint K1 estrecho, expandir después.**
Implementar K1 solo para Windows + Linux. Después K2 = network devices. Después K3 = BSD/macOS. Después K4 = Asset Discovery completo.

**Opción B — Reformular K1 como implementación inicial mínima de la visión completa.**
Mismo scope arquitectural que el documento de Asset Discovery, pero implementación inicial mínima. Framework estructurado para multi-protocolo y multi-device-type desde día uno; primera versión solo soporta SSH + Linux + Windows + macOS + pfSense.

**Opción C — Pausa para rediseño técnico riguroso antes de cualquier implementación.**
3-5 días dedicados a diseño técnico antes de codear: schema de BD, contratos JSON, pseudocódigo del Assessment Engine, ondas de implementación concretas.

### Decisión

**B con elementos de C.**

Concretamente:

1. Cerrar Sprint B0 + hallazgos críticos pendientes (Bloque 1 del plan)
2. 2 semanas dedicadas a diseño técnico riguroso (Bloque 2)
3. Implementar Onda 1 con arquitectura completa pero scope estrecho (Bloque 3)

### Razonamiento

**Por qué no A:**
Implementar K1 solo para Windows + Linux y después refactorizar para network devices generaría 3-4 semanas de refactor adicional cuando lleguen los siguientes tipos de activos. Dado que Ricardo trabaja solo, ese refactor es costo desproporcionado.

**Por qué no C puro:**
1-2 semanas adicionales de diseño antes de cualquier implementación retrasa el primer entregable usable. El balance correcto es 2 semanas de diseño después de cerrar B0, no 3-5 días aislados sin contexto de cierre.

**Por qué B+C:**
Arquitectura correcta desde el primer día (B) + diseño riguroso antes de codear (C parcial) produce un primer entregable usable en 8-10 semanas que escala sin refactor a las siguientes ondas.

### Estado

**Aceptada** — formalizada hoy.

---

## Decisión 3 — Capacidad y cronograma realistas

### Contexto

Ricardo confirmó:

- **Capacidad:** 20 horas/semana sostenibles
- **Deadline externo:** ninguno (no hay inversionistas, clientes, eventos que presionen)
- **Restricción cognitiva:** sesiones efectivas de 1-3 horas, fatiga aumenta errores

### Decisión

Cronograma del proyecto a 20h/semana:

```
Semana 1-2  (semana actual + próxima): Cerrar Sprint B0 + arq críticos (~30h)
Semana 3-4: Diseño técnico riguroso (~30-40h)
Semana 5-10: Implementación Onda 1 (~100-130h)
Semana 11+: Onda 2 (Telnet switches + SSH firewalls comerciales)
Semana 14+: Onda 3 (Serial vía adaptadores ETH-to-Serial)
```

**Primer entregable usable (Onda 1 completa):** aproximadamente fines de junio o principios de julio 2026.

### Validación de aceptación

Ricardo aceptó este cronograma honestamente — entiende que es 3 meses para tener el primer entregable usable, no 3 semanas. Eso es lo que se requiere a 20h/semana con arquitectura correcta.

### Estado

**Aceptada** — formalizada hoy.

---

## Decisión 4 — Priorización de tipos de activos para las Ondas

### Contexto

Ricardo identificó qué tipos de activos quiere mover a KŌDO en qué orden, basándose en lo que opera diariamente:

> *"Windows, Linux, MACos, PFSENSE.. Luego TELNET para suiches y otros, y ssh para firewalls, otros... ultimo serial via adaptadores ETH to Serial."*

### Decisión

**Onda 1 — SSH como único transporte:**
- Windows (vía OpenSSH)
- Linux (todas las distros que use)
- macOS
- pfSense (FreeBSD-based, soporta SSH)

Todos comparten transporte (SSH) pero tienen perfiles distintos, lo que ejercita el modelo de Capability Matrix y Adapters desde el principio sin complejidad de transports adicionales.

**Onda 2 — Multi-transport:**
- Telnet para switches y equipos legacy
- SSH para firewalls comerciales (FortiGate, Palo Alto, Cisco ASA, otros)

**Onda 3 — Transport físico:**
- Serial vía adaptadores ETH-to-Serial
- Casos de uso: consola de equipos sin red, recovery, equipos muy antiguos

### Razonamiento

Onda 1 maximiza el valor del esfuerzo arquitectural inicial:
- 4 tipos de activo distintos (Windows, Linux, macOS, pfSense)
- 1 solo transporte (SSH) — simplifica testing
- Todos los activos están en la operación diaria de Ricardo
- Permite validar el modelo de Asset Profile + Capability Matrix con variedad real

Onda 2 introduce complejidad de transports adicionales una vez el modelo base está probado.

Onda 3 es la última porque Serial requiere hardware adicional (adaptadores físicos) y casos de uso son menos frecuentes.

### Estado

**Aceptada** — formalizada hoy.

---

## Decisión 5 — Plan del Bloque 1: Cerrar Sprint B0 con orden Camino 3

### Contexto

El Sprint B0 tiene fixes pendientes (H4, H1, H2/H3/H7) más hallazgos arquitecturales críticos descubiertos durante el sprint (arq-16, arq-4 entre los más relevantes). Se discutieron tres caminos para ordenar el trabajo restante:

**Camino 1 — Fijar lo que ya está, después tests:** H4, H1, H2/H3/H7, arq-16, después arq-4.

**Camino 2 — Tests primero, después fixes:** arq-4, arq-16, después H4/H1/H2/H3/H7.

**Camino 3 — Atacar el más bloqueante primero:** arq-16, arq-4, después resto de B0.

### Decisión

**Camino 3.**

Orden definitivo del Bloque 1:

1. **arq-16** — playbook screen rendering bug
   - Razón: bug que afecta uso diario del producto. Prioridad alta inmediata.
   - Estimado: 1-2 horas

2. **arq-4** — instalar Vitest + React Testing Library + tests iniciales
   - Razón: prerequisito para no construir Onda 1 sobre cero infraestructura de tests del frontend.
   - Estimado: 4-6 horas

3. **H4** — question_prompt como botones clicables
   - Estimado: ~45 minutos

4. **H1** — tool_limit handling en frontend
   - Estimado: 2-3 horas

5. **H2/H3/H7** — auditoría visual + botones export con labels + jerarquía
   - Estimado: 3-4 horas en conjunto

6. **arq-15** — patrón de catch silencioso (si queda capacidad)
   - Estimado: 3-4 horas

7. **arq-17** — TXT export bug (si queda capacidad)
   - Estimado: 1-2 horas

### Razonamiento

**arq-16 primero:** Ricardo lo encuentra cada vez que usa el producto. Aprovechar la fricción real como motivación.

**arq-4 segundo:** Sin infraestructura de tests del frontend, cada cambio en Onda 1 será cambio ciego. Es prerequisito técnico, no opcional.

**Resto en orden de B0 original:** una vez resueltas las prioridades inmediatas, los fixes de B0 vienen rodados con cabeza más fresca.

### Estado

**Aceptada** — formalizada hoy. Empezamos con arq-16 en el próximo turno de trabajo.

---

## Decisión 6 — Sistema de captura inteligente de ideas

### Contexto

Ricardo articuló su necesidad de una metodología compatible con su modo cognitivo neurodivergente:

> *"Por mi forma de funcionamiento neurodivergente, mi proceso de pensamiento no siempre es lineal. Hay momentos en los que surgen más ideas y otros en los que surgen menos, pero muchas de ellas son útiles, prácticas y están directamente orientadas a mejorar el trabajo y la calidad del producto."*

> *"necesito que la dinámica de trabajo tenga la capacidad de captar, entender, analizar y organizar correctamente todo lo que voy planteando."*

### Decisión

Implementar un sistema formal de captura inteligente de ideas con:

1. Detección automática de ideas tangenciales durante el flow de ejecución
2. Captura inmediata sin interrumpir el trabajo actual
3. Clasificación multi-dimensional (dominio, tipo, urgencia)
4. Procesamiento estructurado en rituales (ligero diario, profundo semanal, emergencia cuando hay overflow)
5. Re-emergencia controlada de ideas relevantes

### Implementación

Sistema implementado y mergeado a main hoy en commit `f255270`:

- `docs/inbox/README.md` (263 líneas) — manual del sistema
- `docs/methodology/working-with-ricardo.md` (199 líneas) — protocolo operativo
- `docs/inbox/2026-04-24-ideas.md` (311 líneas) — primer inbox con pasada retroactiva de 8 ideas

### Estado

**Implementada y activa** desde este momento.

---

## Resumen ejecutivo de decisiones de hoy

| # | Decisión | Estado |
|---|----------|--------|
| 1 | Framing: Ricardo es primer cliente, plataforma de infraestructura completa | Aceptada |
| 2 | Estrategia: Opción B+C (arquitectura completa con scope inicial mínimo + diseño riguroso) | Aceptada |
| 3 | Cronograma: 20h/semana, Onda 1 productiva en ~10 semanas | Aceptada |
| 4 | Priorización ondas: 1=SSH multi-OS, 2=Telnet+SSH firewalls, 3=Serial | Aceptada |
| 5 | Bloque 1 (cierre B0): orden Camino 3 — arq-16, arq-4, después B0 restante | Aceptada |
| 6 | Sistema captura inteligente de ideas | Implementada |

---

## Próxima decisión esperada

Al completar el Bloque 2 (diseño técnico riguroso, semanas 3-4), se documentarán las decisiones técnicas específicas:

- Schema final de SQLite para Asset/Profile/Evidence/Capability
- Interfaz del Transport Engine
- Plan de Onda 1 con criterios de éxito específicos

Esas decisiones vivirán en `docs/decisions/2026-05-XX-arquitectura-onda-1.md` (fecha exacta a definir según cuándo se completen).

---

**Última actualización:** 24 abril 2026
**Decisiones formalizadas por:** Ricardo Nava (Founder) + Claude (asistente)

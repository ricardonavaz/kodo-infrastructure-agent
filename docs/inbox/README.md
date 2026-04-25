# Sistema de Inbox Inteligente — Manual

**Creado:** 24 de abril de 2026
**Propósito:** Capturar, clasificar y procesar ideas que surgen espontáneamente durante el trabajo en KŌDO, sin romper el foco de ejecución actual.

---

## Por qué existe este sistema

Ricardo tiene un modo cognitivo donde las ideas valiosas para el producto surgen frecuentemente fuera del hilo de ejecución actual. Estas ideas son típicamente prácticas, alineadas con mejoras reales del producto, y a veces más valiosas que el fix que se está ejecutando en ese momento.

El sistema tradicional de "anota en backlog si te acuerdas" falla por dos razones:
1. Las ideas se pierden cuando no se capturan inmediatamente
2. Cuando se capturan tarde, se pierde contexto y matices

Este sistema resuelve ambos problemas con captura automática inmediata + procesamiento estructurado posterior.

---

## Cómo funciona — vista de alto nivel

```
Ricardo expresa una idea (en cualquier momento)
                  |
                  v
Claude la detecta automáticamente
                  |
                  v
Captura inmediata al inbox del día
(sin interrumpir el flow actual)
                  |
                  v
Confirmación breve: "capturé eso al inbox como X"
                  |
                  v
Sigue el flow de ejecución original
                  |
                  v
[Después, en momento adecuado]
Ritual de procesamiento del inbox
                  |
                  v
Ideas se mueven a su destino correcto:
  - backlog-ideas-producto.md
  - hallazgos arquitecturales (arq-X)
  - sprint planning
  - documento de diseño dedicado
  - decisiones formales
  - archivo (si es duplicada/cubierta)
```

---

## Estructura de directorios

```
docs/
  inbox/
    README.md                          # Este documento
    YYYY-MM-DD-ideas.md                # Inbox del día actual
    archive/                           # Inboxes procesados
      YYYY-MM-DD-ideas-procesado.md
  methodology/
    working-with-ricardo.md            # Protocolo de operación
  decisions/
    YYYY-MM-DD-decisiones.md           # Decisiones formales tomadas
```

---

## Detección automática de ideas

Claude se entrena para detectar las siguientes señales que indican "esto es una idea para capturar, no parte del flow actual":

### Frases gatillo explícitas
- "Ah, también..."
- "Se me ocurre..."
- "Otra cosa..."
- "Por cierto..."
- "Oye, y..."
- "Me acabo de acordar..."
- "Pensándolo bien..."
- "Algo que noté..."
- "¿Y si...?"
- "Sería bueno..."

### Patrones de comportamiento
- Cambio de tema repentino dentro del mismo mensaje
- Observación tangencial al final de un mensaje sobre otro tema
- Comparación con otro producto sin pedir acción
- Frustración expresada que sugiere una mejora ("esto debería ser más claro")
- Pregunta retórica sobre cómo debería funcionar algo

### Tipos de contenido
- Observaciones de uso real del producto que no son sobre el bug actual
- Ideas de UX o flujo que no se están implementando ahora
- Pensamientos de arquitectura mientras se hace código tactical
- Insights sobre marketing/producto durante sesiones técnicas
- Preguntas de "¿por qué no funciona X?" que insinúan feature faltante

---

## Acción inmediata cuando se detecta una idea

Cuando Claude detecta una idea durante el flow de ejecución, hace esto en orden:

**Paso 1:** Captura textual a `docs/inbox/YYYY-MM-DD-ideas.md` con:
- Timestamp
- Texto original de Ricardo (palabras exactas)
- Contexto inmediato (qué estábamos haciendo cuando surgió)
- Tags automáticos
- Conexiones detectadas

**Paso 2:** Confirmación breve de una línea:
> *"Capturé eso al inbox como [tag]. Sigo con [tarea actual]."*

**Paso 3:** Continúa con la tarea actual sin pausar.

---

## Formato de entrada del inbox

Cada idea capturada tiene este formato:

```markdown
---
### IDEA #N — [título corto]

**Capturada:** YYYY-MM-DD HH:MM
**Contexto:** Qué estábamos haciendo cuando surgió
**Texto original:**
> "Cita textual de Ricardo, palabras exactas"

**Categorización automática:**
- Dominio: [código | ux | producto | marca | operación | negocio | arquitectura]
- Tipo: [bug | feature | refactor | decisión | pregunta | observación | insight]
- Urgencia: [crítica | alta | media | baja | contemplativa]
- Bloquea trabajo actual: [sí | no]
- Conexiones: [arq-X, sprint-Y, documento-Z, idea anterior #N]

**Mi interpretación inicial:**
[1-2 frases de qué entendí, para que Ricardo pueda corregir]

**Estado:**
- [ ] Sin procesar
- [ ] En revisión
- [ ] Procesada → destino: [cuál]

---
```

---

## Tags de dominio (definiciones)

- **código:** algo sobre implementación técnica del cliente o servidor
- **ux:** algo sobre experiencia del usuario, layout, interacción
- **producto:** algo sobre features, capabilities, propuesta de valor
- **marca:** algo sobre identidad, naming, comunicación, copy
- **operación:** algo sobre cómo Ricardo opera infraestructura real
- **negocio:** algo sobre monetización, mercado, posicionamiento
- **arquitectura:** algo sobre estructura del sistema, decisiones de diseño profundas

Una idea puede tener múltiples tags. Ej: "ejecutar playbook desde main screen con UX rica" es `producto` + `ux`.

---

## Tags de tipo (definiciones)

- **bug:** algo que está roto y debe arreglarse
- **feature:** funcionalidad nueva que no existe
- **refactor:** mejora estructural sin cambio de comportamiento
- **decisión:** algo que requiere decisión consciente antes de actuar
- **pregunta:** algo que requiere investigación o respuesta
- **observación:** información que vale registrar pero no requiere acción
- **insight:** entendimiento nuevo que afecta cómo pensamos algo

---

## Tags de urgencia (definiciones)

- **crítica:** afecta operación o credibilidad del producto, debe atenderse en próximo sprint
- **alta:** importante, debería atenderse en los próximos 2-3 sprints
- **media:** valiosa, atender cuando se alinee con otro trabajo
- **baja:** nice-to-have, atender si hay capacidad
- **contemplativa:** insight que no requiere acción inmediata, vivir como referencia

---

## Ritual de procesamiento

El inbox se procesa en momentos específicos:

### Procesamiento ligero (al final de cada sesión)
**Duración:** 5-10 minutos
**Qué se hace:**
- Revisar ideas capturadas hoy
- Confirmar que la categorización automática está correcta
- Identificar las "críticas" o "altas" que deben entrar al próximo sprint planning
- Marcar las "contemplativas" para no preocuparse

### Procesamiento profundo (semanal, propuesto)
**Duración:** 30-45 minutos
**Cuándo:** al inicio de cada semana o entre sprints
**Qué se hace:**
- Revisar todas las ideas acumuladas en `inbox/` durante la semana
- Mover las maduras a su destino:
  - `docs/backlog-ideas-producto.md` (ideas de producto/feature)
  - `docs/hallazgos-arquitecturales.md` o equivalente (arq-X)
  - `docs/decisions/YYYY-MM-DD-decisiones.md` (decisiones formales)
  - Documentos de diseño dedicados (si la idea merece su propio doc)
- Archivar inboxes ya procesados a `inbox/archive/`
- Identificar patrones (¿hay 5 ideas relacionadas que sugieren un sprint?)

### Procesamiento de emergencia (cuando crece el inbox)
**Trigger:** inbox del día tiene más de 8-10 ideas sin procesar
**Acción:** Claude propone explícitamente hacer una pasada de procesamiento antes de continuar

---

## Re-emergencia controlada

Las ideas en el inbox no son "cementerio". Cuando una se vuelve relevante, Claude la trae de vuelta proactivamente:

> *"Ricardo, antes de avanzar con esto: hace 3 días capturamos esta observación tuya sobre [X]. Es relevante ahora porque estamos por decidir [Y]. ¿La consideramos?"*

Esto previene el escenario de "capturé algo y nunca volvió a aparecer".

---

## Lo que el sistema NO hace

Para evitar abuso o burocracia:

- **No captura cada palabra que Ricardo dice.** Solo lo que tiene señales de "idea para procesar".
- **No interrumpe el flow para preguntar "¿quieres capturar esto?".** Captura silenciosamente y continúa.
- **No requiere aprobación de cada captura.** Ricardo revisa en el procesamiento.
- **No reemplaza decisiones de Ricardo.** Solo organiza información para que las decisiones sean mejores.
- **No tiene jerarquía sobre el sprint actual.** Si una idea es realmente urgente, Ricardo decide pivotar — el sistema no fuerza nada.

---

## Calibración continua

Este sistema se ajusta con el uso. Indicadores de que necesita calibración:

- **Falsos positivos:** Claude captura cosas que no eran ideas (ruido conversacional)
- **Falsos negativos:** ideas reales se pierden (Claude no las detectó)
- **Mala categorización:** tags consistentemente equivocados
- **Sobrecarga del inbox:** demasiado contenido sin procesar

Ricardo puede decir en cualquier momento:
- "Eso no era una idea, no captures así"
- "Esto sí era importante, no lo capturaste"
- "Reclasifica X como Y"

Y el sistema se ajusta.

---

## Historial de versiones

- **v1.0** — 24 abril 2026 — sistema inicial implementado

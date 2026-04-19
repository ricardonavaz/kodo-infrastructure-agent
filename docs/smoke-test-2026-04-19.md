# Smoke Test — 19 Abril 2026

## Contexto
Tests en vivo despues de merge de A1+A2+A3 a main. Version corriendo
confirmada como actualizada (tool_limit de A2 dispara correctamente).

## Hallazgos

### Hallazgo 1: tool_limit event no manejado en frontend
- Trigger: prompt "ejecuta todas las recomendaciones" despues de una
  auditoria
- Backend: correctamente emite evento tool_limit al alcanzar
  MAX_TOOL_ITERATIONS (10)
- Frontend: muestra "Error: Load failed" generico
- Prioridad: ALTA — afecta experiencia de usuario en caso comun
- Fix sugerido: agregar handler del evento tool_limit en el componente
  de chat que muestre mensaje informativo con opcion de continuar

### Hallazgo 2: Contraste pobre en botones de accion
- Ubicacion: footer del mensaje (Reporte IA, HTML, MD, TXT)
- Problema: dorado sobre negro insuficiente para legibilidad
- Prioridad: MEDIA
- Fix sugerido: revisar tokens de color del tema oscuro

### Hallazgo 3: Botones de export (HTML/MD/TXT) posiblemente no
ejecutan
- Reportado por Ricardo: "no ejecutan nada"
- Pendiente: confirmar en proximo smoke test si hay error en consola
  al click
- Prioridad: ALTA si se confirma

### Observacion: Model Router de A1
- Auditoria de seguridad uso Haiku segun metric footer del screenshot
- Hipotesis original: router enruta mal
- Hipotesis revisada: el prompt "Hazme una auditoria" puede no matchear
  patrones SONNET_PATTERNS. Verificar en siguiente sesion.

### Hallazgo 4 (CRITICO): question_prompt no renderiza opciones reales

- Trigger: prompt "revision y mantenimiento, preguntame antes de
  ejecutar cada accion"
- Observado: opciones A/B/C/PERSONALIZADO se renderizan como lista
  markdown en lugar de botones clicables
- **Causa raiz confirmada (dos bugs simultaneos):**
  1. Linea 197 de semantic-parser.js: endsWith('?') falla cuando la
     pregunta termina en "**?**" (markdown bold). La cadena termina
     literalmente en "**", no en "?". Por eso el patron no matchea y
     question_prompt nunca se genera para preguntas formateadas con
     negritas.
  2. extractOptions no tolera linea vacia entre pregunta y lista de
     opciones. Claude naturalmente genera "Responde:\n\n- SI..." pero
     extractOptions se detiene en la linea vacia. Las opciones reales
     quedan como text_block separado mientras question_prompt usa
     defaults [Si, No, Ver impacto].
  - QuestionPrompt.jsx SI renderiza botones clicables — el componente
    funciona correctamente. El bug es 100% del parser.
  - Fix estimado: 10 lineas en 2 lugares.
- Impacto en UX: el usuario tiene que escribir respuestas manualmente
  cuando el agente le ofrece elecciones claras.
- Prioridad: CRITICA — afecta el valor central del producto

### Hallazgo 5 (ALTO): asteriscos markdown visibles como texto literal

- Observado: texto como "**Recuerda:**" aparece con los asteriscos
  visibles en pantalla en lugar de renderizarse como negritas
- Ubicacion: dentro de bloques finding (title y description)
- **Causa raiz confirmada:** Los componentes Finding, Recommendation y
  SummaryCard renderizan el contenido de sus bloques como texto plano
  (sin procesar markdown). Por eso los asteriscos aparecen literales.
  Solo TextBlock.jsx usa formatMessage() para markdown — todos los
  demas componentes renderizan texto plano via `{title}` y
  `{description}` directo en JSX.
- Impacto: la interfaz se ve amateur y poco cuidada
- Prioridad: ALTA
- Fix: instalar react-markdown y wrappear el rendering de texto en
  estos 3 componentes (y auditar los demas que renderizan output del
  modelo).

### Hallazgo 6 (MEDIO): severity badge nunca se estiliza por nivel

- Observado: badge "ALTO" tiene estilo base generico (fondo tenue)
  sin color de severity
- **Causa raiz confirmada:** El JSX del severity badge emite el
  atributo data-severity="high", pero el CSS fue escrito con selectores
  de clase (.sb-severity-badge.critical). Los selectores nunca matchean
  y el badge cae al estilo default (fondo tenue generico).
- Impacto: desajuste semantico-visual. Un alto no se siente alto.
- Prioridad: MEDIA
- Fix: cambiar selectores CSS a selectores de atributo (ej:
  [data-severity="high"]) o cambiar JSX para emitir clases. Decision
  de diseno pendiente.

### Hallazgo 7 (MEDIO): jerarquia visual debil en preguntas

- Observado: "¿QUE DESEAS HACER?" como texto en verde con emoji, sin
  suficiente peso visual para ser el punto de decision
- Esperado: header grande con caja distintiva que comunique "aqui
  decides"
- Prioridad: MEDIA
- Relacionado: H4 — cuando tengamos botones, la pregunta debe verse
  como contenedor de esos botones

### Hallazgo 8: model router no detecta "mantenimiento"

- Prompt: "revision y mantenimiento, preguntame antes de ejecutar
  cada accion"
- Modelo usado: Haiku
- **Causa raiz confirmada:** La funcion detectTaskType en
  server/routes/agent.js no incluye patrones para "mantenimiento" ni
  "revision" en MAINTENANCE_PATTERNS. El prompt de Ricardo matcheo el
  default (other) y fue enrutado a Haiku.
- Fix: agregar 2-3 patrones a MAINTENANCE_PATTERNS. Este bug existia
  desde A1 pero no fue detectado en tests porque los tests de A1 no
  cubrian estos patrones en espanol.
- Nota: esto implica que los tests de A1 deberian expandirse para
  cubrir vocabulario en espanol. Agregar al backlog.
- Prioridad: MEDIA — Haiku produjo output bueno y costo $0.068 vs
  $0.205 estimado de Sonnet. Pero la intencion del routing es que
  maintenance use Sonnet.

## Observacion arquitectural: desajuste output-rendering (consolidada)

Claude genera markdown conversacional naturalmente rico: asteriscos,
flechas, negritas, emojis, descripciones largas, formato de seccion
con **titulo**. El parser actual y los componentes React tienen
capacidades limitadas:

- Parser espera formato semi-rigido para questions (endsWith ? exacto,
  opciones inmediatamente despues sin linea vacia)
- Componentes React (Finding, Recommendation, SummaryCard,
  QuestionPrompt) renderizan texto plano sin procesar markdown
- Solo TextBlock usa formatMessage() para markdown
- Estilos de severity tienen desconexion CSS/JSX (data-attribute vs
  class selector)

Causa raiz sistemica: los 9 bloques del parser son estructura. El
rendering de cada bloque es donde la calidad de UX se materializa,
y es alli donde hay deuda tecnica acumulada.

## Sprint B0 propuesto — prioridades de UX

Basado en los hallazgos 1-8, propuesta de orden de trabajo:

1. Markdown rendering en todos los componentes de bloque (fix H5)
2. Fix desconexion CSS/JSX de severity badge + tokens de color (fix H6)
3. Fix question_prompt: endsWith('?') tolerante a markdown + 
   extractOptions tolerante a lineas vacias (fix H4)
4. Manejo del evento tool_limit en frontend (fix H1)
5. Verificar/reparar funcionalidad de botones export (fix H3)
6. Agregar "mantenimiento|revision" a detectTaskType patterns (fix H8)
7. Auditoria de contraste de tema oscuro (fix H2)

### Sprint B0 — estimado refinado post-diagnostico

Con las causas raiz confirmadas, el sprint es significativamente mas
corto de lo estimado inicialmente:

- H4 (CRITICO): ~10 lineas en 2 lugares de semantic-parser.js.
  Incluye agregar tests en A3 para cubrir estos casos edge.
- H5 (ALTO): instalar react-markdown + wrappear rendering en 3+
  componentes. ~30 lineas total + npm install.
- H6 (MEDIO): 3 lineas de CSS o JSX. Trivial.
- H7 (MEDIO): diseno de tokens de jerarquia visual + implementacion.
  2-3 horas.
- H8 (MEDIO): 2 lineas en agent.js + expandir tests de A1 para cubrir
  vocabulario en espanol.
- H1 (CRITICO, original): tool_limit handling en frontend. ~50 lineas.
- H2 / H3 / contraste: audit + fixes. 1-2 horas.

**Estimado total: 2-3 dias de trabajo concentrado** (revision del
estimado original de 5-7 dias).

## Vision de producto — prioridades UX reveladas

El smoke test revela que el producto necesita un sprint urgente de
UX antes de continuar con features backend (A4 ledger, A5 model
registry). Ricardo expreso la vision:

"Quiero que estas vistas sean espectaculares. Si le pido salud y me
dice % de CPU y memoria, que me haga algun grafico. Los *** deberian
ser identificados como titulo, el ALTO deberia tener fondo rojo y
letras blancas, mas intuitivo, interesante."

Esto implica priorizar:
- B0: sprint UX critico (H1-H8) PRIMERO
- B1: adapter RRL Schema v1.1 acelerado
- C1-C3: bloques visuales avanzados (chart, diagram, comparison,
  timeline) — PROMOVIDOS en prioridad
- A4 y A5 (ledger, model registry): diferidos hasta despues de B0-C3

Backend solido sin UX rica = producto que funciona pero no se siente
profesional. Invertir en visualizacion es invertir en la percepcion
de valor.

## Acciones propuestas (no ejecutadas hoy)
- Backlog: sprint B0 UX critico (7 items priorizados arriba)
- Backlog: fix extractOptions para tolerar linea vacia + markdown rico
- Backlog: fix endsWith('?') para tolerar markdown wrapping
- Backlog: agregar formatMessage a Finding, Recommendation, SummaryCard
- Backlog: fix CSS/JSX severity badge desconexion
- Backlog: agregar "mantenimiento|revision" a detectTaskType patterns

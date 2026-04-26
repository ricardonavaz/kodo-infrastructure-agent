# Funcionalidad Central de KŌDO — Diseño Funcional de las 6 Primitivas

**Fecha:** 26 de abril de 2026
**Autor:** Ricardo Nava (founder, primer cliente) + Claude (asistente)
**Estado:** Diseño funcional cerrado. Pendiente: diseño técnico de la primera primitiva a implementar.
**Origen:** Insight estratégico capturado en `docs/inbox/2026-04-26-ideas.md` IDEA #1, donde Ricardo identificó que el trabajo táctico de cierre Sprint B0 estaba alejando al proyecto de las necesidades centrales del producto.

---

## Propósito de este documento

Articular formalmente las **6 primitivas de operación** que faltan en KŌDO actualmente, sin las cuales el producto no puede cumplir su visión de ser un agente de infraestructura capaz de resolver cualquier situación.

Este documento es **diseño funcional**, no técnico. Define QUÉ debe hacer el sistema y CÓMO debe operar desde la perspectiva del usuario. El diseño técnico (schema de BD, endpoints, componentes UI específicos) viene después y se basa en este documento.

Cada primitiva se cerró mediante sesión conversacional con Ricardo donde se respondieron preguntas operativas concretas. Las decisiones documentadas aquí son **vinculantes** para el diseño técnico subsiguiente, salvo las marcadas explícitamente como "decisión diferida".

---

## Las 6 Primitivas

1. **Sesión Operativa** — bitácora viva de intervención sobre un servidor
2. **Playbook Formalizado** — unidad ejecutable con identidad formal
3. **Sesión Multi-Servidor** — orquestación coordinada sobre N servidores
4. **Pantalla Consolidada de Resultados** — patrón de UI universal de retorno al origen
5. **Tareas Programadas** — ejecución automática y recurrente de playbooks
6. **Comportamiento Agéntico Real** — operación paso a paso con confirmación humana

---

# PRIMITIVA 1 — Sesión Operativa

## Definición

Bitácora viva de una intervención técnica sobre UN servidor, con inicio explícito, terminación manual, persistencia total de actividad con protección de secretos, y reporte ejecutivo automático al cerrar.

## Lifecycle

- **Iniciar:** manual mediante botón explícito. Antes de iniciar sesión formal, el operador no puede hacer trabajo operativo sobre el servidor (chat bloqueado o en modo lectura).
- **Trabajar:** comandos, decisiones, diagnósticos durante la sesión. Todo persiste en BD.
- **Reanudar:** automático tras desconexión. El estado "sesión abierta" persiste en BD, no en memoria. Reinicios del servidor no cierran sesiones.
- **Terminar:** manual mediante botón. Genera automáticamente reporte ejecutivo PDF.

## Características clave

- **Cardinalidad:** 1 sesión = 1 servidor. Si se trabaja con 5 servidores, son 5 sesiones (la primitiva 3 maneja el caso multi-servidor).
- **Concurrencia:** múltiples sesiones simultáneas en distintos servidores son **permitidas**. El operador puede estar en sesión activa con server-A a las 10:00 y abrir otra con server-B a las 10:15.
- **Duración:** sin límite temporal. Las sesiones pueden durar minutos, horas, días o semanas.
- **Persistencia:** total en BD (no archivos sueltos). Los 12 elementos persisten:
  1. Servidor o servidores involucrados
  2. Hora de inicio
  3. Acciones ejecutadas
  4. Comandos utilizados
  5. Respuestas obtenidas
  6. Opciones mostradas por el sistema
  7. Diagnósticos sugeridos
  8. Decisiones tomadas por el operador
  9. Problemas encontrados
  10. Soluciones aplicadas
  11. Resultado final
  12. Hora de cierre
- **Protección de secretos:** patrones como contraseñas en línea de comando, tokens, claves API se enmascaran automáticamente con `****` o `###` antes de persistir.
- **Reporte ejecutivo:** se genera automáticamente al cerrar la sesión. Formato principal **PDF**. Sin edición humana posterior. El reporte es fiel a la bitácora.
- **Sesiones interrumpidas:** se reanudan automáticamente. Al volver, el operador encuentra la sesión abierta y continúa donde quedó.
- **Pausas largas:** visibles en el reporte. Si una sesión duró 4 días pero solo 6 horas efectivas de trabajo, el reporte refleja eso con marcas como "Pausa de N horas entre HH:MM y HH:MM".
- **Acceso a historial:** las sesiones cerradas son accesibles sin necesidad de abrir sesión nueva. El operador puede navegar archivo histórico libremente.

## Decisiones diferidas para fase técnica

1. **Patrón exacto de detección de secretos.** Sugerencia inicial: regex sobre patrones comunes (`-p<algo>`, `password=`, `token=`, `key=`, `Authorization: Bearer`, etc.) más mecanismo opt-in para que el operador marque manualmente partes a enmascarar.
2. **Política de retención.** ¿Las sesiones se guardan para siempre o se purgan a los N meses? Sin decisión por ahora.
3. **Tabla separada para outputs grandes.** Outputs de comandos pueden ser >10MB. Posiblemente requiera tabla auxiliar con FK + truncamiento con marcador "output completo en archivo X".

---

# PRIMITIVA 2 — Playbook Formalizado

## Definición

Unidad ejecutable de operación con identidad formal, metadata estructurada, compatibilidad declarada, y motor de ejecución único compartido por todas las formas de invocación.

## Identidad formal

Cada playbook tiene los siguientes campos obligatorios:

- **Identificador único:** `PB-{categoría}-{slug-de-nombre}-{nro-correlativo}` generado automáticamente por el sistema. Ejemplo: `PB-MON-HEALTHCHECK-001`. El operador no escribe el ID a mano.
- **Etiqueta corta:** slug derivado del nombre, usable para referencia rápida. Ejemplo: `healthcheck-servidor`.
- **Nombre técnico:** legible en lenguaje claro. Ejemplo: "Revisión general de salud del servidor".
- **Descripción funcional:** qué hace el playbook y para qué sirve.
- **Categoría:** una de las categorías existentes (Mantenimiento, Diagnóstico, Monitoreo, Seguridad, Despliegue) o una nueva agregada vía proceso formal de extensión administrado.
- **Alcance (dos campos):**
  - `rol_destino`: tipo de activo donde aplica (servidor web, BD, router Cisco, firewall, etc.)
  - `nivel_impacto`: invasividad del playbook (solo lectura / modifica config / reinicia servicios / destructivo)
- **Compatibilidad:** lista de OS o tipos de activo soportados. Ejemplos: `[linux]`, `[linux, macos, bsd]`, `[cisco-ios]`.

## Origen del playbook

Tres orígenes posibles, todos con misma estructura formal:

- **Builtin:** vienen pre-cargados con KŌDO. Son los playbooks de referencia.
- **Custom del operador:** el operador crea playbooks propios manualmente con todos los campos requeridos.
- **Generados por IA:** el operador le pide a KŌDO un playbook que haga X, la IA produce un draft con estructura formal correcta, el operador revisa y aprueba antes de guardar.

El campo `origen` (`builtin | custom | ai-generated`) queda registrado para trazabilidad. Los tres tipos son indistinguibles en uso.

## Motor de ejecución único

**Decisión arquitectural fundamental:** existe **UN solo motor de ejecución de playbooks**. Todas las formas de invocación pasan por el mismo motor canónico:

- Invocación desde el chat
- Invocación desde la pantalla dedicada de Playbooks
- Invocación desde Tareas Programadas (cron)
- Invocación desde Sesión Multi-Servidor (orquestada)

La pantalla de Playbooks NO es un sistema paralelo. Es una UI que llama al mismo motor que el chat.

**Esto resuelve directamente el problema que Ricardo reportó:**

> *"dentro de la pantalla no funciona, fuera sí"*

La causa raíz es que hoy hay implementaciones divergentes. En la visión correcta, hay una sola implementación.

Esta decisión también elimina toda una clase futura de bugs por divergencia entre formas de invocación.

## Validación de compatibilidad

**Bloqueo duro.** Cuando el operador intenta ejecutar un playbook contra un servidor incompatible, el sistema impide la ejecución con mensaje claro: "Este playbook está marcado para Linux. Servidor seleccionado es Windows. No se puede ejecutar."

Esto previene errores costosos y evita que el operador descubra incompatibilidad solo cuando los comandos fallan en mid-execution.

## Dependencia con Asset Discovery

La validación de compatibilidad requiere conocer el OS del servidor con confianza.

- **Hoy:** el OS se declara manualmente al registrar el servidor.
- **Visión completa:** Asset Discovery detecta el OS automáticamente (documentado en `docs/sprint-knowledge-base-design.md` y mensaje de Ricardo del 24 abril).

Asset Discovery **no es prerequisito estricto** de Playbook Formalizado. La validación de compatibilidad funciona con OS declarado manualmente. Asset Discovery es mejora posterior que automatiza la detección.

## Decisiones diferidas para fase técnica

1. **Mecanismo exacto del proceso formal de extensión de categorías.** ¿Quién aprueba? ¿Cómo se solicita? Sugerencia inicial: si KŌDO tiene rol superuser/admin, ese rol aprueba.
2. **Estructura interna del playbook (pasos, comandos, lógica condicional).** Esto ya existe en KŌDO actual; mantenemos lo que funciona y solo añadimos los campos de identidad formal.
3. **Migración de playbooks existentes.** Los builtin actuales no tienen ID formal. Tendrán que migrarse al nuevo formato. Trabajo de implementación, no de diseño.

---

# PRIMITIVA 3 — Sesión Multi-Servidor

## Definición

Contenedor coordinador que orquesta N Sesiones Operativas individuales en paralelo o secuencial, con consolidación de resultados, reportes individuales más reporte ejecutivo unificado, y vista de progreso en tiempo real.

## Selección del conjunto de servidores

Tres modos disponibles, el operador elige según contexto:

- **Selección explícita:** lista de servidores con multi-select. Para casos ad-hoc.
- **Por filtro:** criterio dinámico (ej: "todos Linux producción", "todos con uptime > 30 días"). El sistema resuelve el conjunto en el momento de iniciar.
- **Por grupo predefinido:** el operador previamente crea grupos (ej: "Servidores Web", "BD Producción") y los selecciona como unidad reutilizable.

## Configuración de ejecución

El operador decide al iniciar la sesión multi-servidor:

- **Modo paralelo o secuencial** según naturaleza del playbook (lecturas vs cambios invasivos).
- **Límite de paralelismo:** si paralelo, configurable (ej: max 5 simultáneos) para evitar sobrecargar KŌDO o la red.

## Arquitectura: coordinador de N Sesiones Operativas

**Decisión fundamental:** la Sesión Multi-Servidor NO es una sesión grande con N "subsecciones". Es un **contenedor que crea y coordina N Sesiones Operativas individuales** (Primitiva 1), una por servidor.

Implicaciones:

- Reutiliza Primitiva 1 sin duplicar lógica
- Cada servidor mantiene su trazabilidad limpia en su Sesión Operativa propia
- La Sesión Multi-Servidor agrega FK a las N sesiones individuales
- El reporte consolidado se genera agregando los reportes individuales
- Si el operador quiere revisar el detalle de un servidor específico, abre su Sesión Operativa individual sin pasar por el contenedor

## Reportes generados

Al cerrar una Sesión Multi-Servidor se generan automáticamente:

- **N reportes individuales** (uno por servidor) — formato PDF, mismo formato que reporte de Sesión Operativa.
- **1 reporte ejecutivo consolidado** — formato PDF, audiencia gerencial/cliente, resumen agregado más sección por servidor.

El operador puede descargar cualquiera de los N+1 reportes según necesidad.

## Pantalla de progreso

Vista híbrida que combina overview con detalle:

- **Lista vertical visible siempre** mostrando N filas (una por servidor).
- Cada fila muestra: nombre del servidor, estado actual (esperando / ejecutando / completado / fallido), paso actual del playbook, tiempo transcurrido.
- **Click en una fila abre el detalle** del servidor específico (logs, output completo del paso actual, eventos del stream).
- El detalle se puede colapsar para volver al overview.

Permite supervisión del conjunto sin perder capacidad de drill-down cuando algo requiere atención.

## Decisiones diferidas para fase técnica

1. **Manejo de fallas durante ejecución.** Si un servidor falla a mitad de la sesión multi-servidor: ¿continuar con los demás (resilencia) / detener todo (precaución) / preguntar al operador?
2. **Política de timeout por servidor.** ¿Cuánto espera KŌDO a que un servidor responda antes de marcarlo como fallido? Sugerencia: configurable por playbook.
3. **Cancelación durante ejecución.** ¿El operador puede abortar la sesión multi-servidor a mitad de camino? Si sí, ¿qué pasa con servidores en curso (terminar lo iniciado vs interrumpir)?

---

# PRIMITIVA 4 — Pantalla Consolidada de Resultados

## Definición

No es una pantalla específica sino un **patrón de UI universal**: el resultado de una operación siempre regresa al lugar de donde se originó la solicitud, con presentación adaptada al contexto y persistencia ligada al lifecycle de la sesión activa.

## Patrón fundamental

**Regla:** "Lo que pides desde un lugar, vuelve a ese lugar."

- Solicitud desde el chat → resultado en el chat
- Solicitud desde Pantalla de Playbooks → resultado en Pantalla de Playbooks
- Solicitud desde Sesión Multi-Servidor → resultado en pantalla de Sesión Multi-Servidor
- Solicitud desde Dashboard de servidor → resultado en ese Dashboard
- Etc.

Esto elimina el síntoma reportado: *"el resultado se pierde en otra sección o queda disperso"*.

## Inventario de pantallas con capacidad de invocación

Cualquiera de estas pantallas puede originar una operación cuyo resultado debe regresar a ella:

1. Chat principal
2. Pantalla de Playbooks
3. Pantalla de Sesión Multi-Servidor
4. Dashboard de servidor individual
5. Pantalla de Tareas Programadas (al revisar resultados de una tarea que corrió)
6. Pantalla de Historial (al revisar sesiones pasadas)

**Implicación importante:** el chat principal SÍ puede invocar una Sesión Multi-Servidor. Si en el chat el operador escribe "revisa todos los servidores", la sesión multi-servidor se dispara y los resultados vuelven al chat con presentación apropiada.

## Presentación adaptada al contexto

La forma visual de los resultados depende de dónde se consumen:

- **En el chat:** narrativo + cards expandibles. El agente describe el resultado en lenguaje natural ("Revisé 5 servidores: 3 OK, 1 advertencia, 1 error") y debajo aparecen cards/componentes con detalle estructurado expandible.
- **En la Pantalla de Playbooks o Sesión Multi-Servidor:** dashboard estructurado con los 10 elementos formales (estado general, servidores exitosos/con advertencias/con errores, acciones ejecutadas, playbooks aplicados, recomendaciones, botón generar reporte, botón cerrar sesión). Tabla viva, no narrativa.
- **En Dashboard de servidor individual:** vista contextualizada al servidor específico, con resultados centrados en ese activo.
- **En Tareas Programadas o Historial:** vista de archivo histórico, formato resumen + acceso a detalle completo.

## Persistencia ligada a Sesión Operativa

Los resultados se mantienen visibles en la pantalla **mientras la Sesión Operativa esté abierta**. El operador puede:

- Navegar a otras pantallas y volver — los resultados siguen ahí
- Continuar trabajando con esos resultados como contexto activo
- Tomar decisiones basadas en lo que muestran

**Al cerrar la Sesión Operativa**, los resultados se archivan al historial accesible (la Primitiva 1 estableció que el historial es navegable sin sesión activa).

Esto da continuidad real al trabajo: resultados son contexto vivo durante la sesión, archivo permanente después.

## Decisiones diferidas para fase técnica

1. **Componentes UI específicos:** qué cards, qué dashboards, qué tablas exactamente. Trabajo de diseño técnico de frontend.
2. **Comportamiento si una operación tarda mucho:** ¿el operador puede iniciar otra solicitud mientras la primera está corriendo? ¿O cada pantalla bloquea hasta que termina la actual?
3. **Notificación cross-pantalla:** si el operador inicia una operación larga y se mueve a otra pantalla, ¿hay notificación cuando termina? Probablemente sí (toast / badge) pero el detalle se queda en la pantalla original.

---

# PRIMITIVA 5 — Tareas Programadas

## Definición

Mecanismo de ejecución automática y recurrente de Playbooks Formalizados sobre uno o más servidores, según schedule definido por el operador, con manejo configurable de notificaciones, recuperación tras downtime, y propiedad organizacional.

## Qué se programa: solo Playbooks

Una Tarea Programada es esencialmente *"ejecuta este Playbook contra este servidor (o servidores) según este schedule"*.

No hay tareas programadas de "generar reporte" o "enviar alerta" como entidades separadas. Esas son **consecuencias derivadas** de ejecutar un playbook:

- Un playbook de "revisión diaria" produce un reporte como output (consecuencia, no tarea separada)
- Un playbook de "monitoreo de servicios críticos" puede disparar una alerta si encuentra fallas (consecuencia)
- Un playbook de "limpieza de logs" no produce ni reporte ni alerta (solo bitácora)

Una Tarea Programada apunta a UN Playbook (puede ser solo-lectura como diagnóstico, o invasivo como mantenimiento). El comportamiento de notificaciones, reportes, etc. se define en la configuración de la tarea, no en el playbook mismo.

**Relación con Sesión Multi-Servidor:** las tareas programadas operan al nivel de Playbook directo, NO se envuelven en Sesión Multi-Servidor formal. Una tarea puede correr un Playbook contra 1 o N servidores (selección al crear la tarea) pero usa el motor de ejecución de playbooks directamente.

La Sesión Multi-Servidor (Primitiva 3) queda como contenedor para invocaciones manuales orquestadas.

## Especificación temporal

Dos modos disponibles:

**Modo simple (UI amigable):** opciones predefinidas legibles humanamente:
- Cada día a hora X
- Cada lunes/martes/.../domingo a hora X
- Cada 1ro del mes a hora X
- Cada N horas
- Cada N minutos

**Modo avanzado (cron crudo):** para casos no cubiertos por la UI simple, el operador puede escribir expresiones cron directamente (ej: `0 8 * * 1-5` = días hábiles a las 8 AM).

El sistema valida la expresión cron antes de guardar y muestra interpretación humana ("Esto se ejecutará: lunes a viernes a las 8:00 AM").

## Notificaciones configurables por tarea

Cada Tarea Programada se configura con su propia política de notificación. Tres niveles:

- **Solo log:** el resultado va a histórico. No hay notificación activa. El operador lo revisa cuando quiera.
- **Notificación pasiva:** los resultados generan entrada en bandeja in-app de KŌDO. El operador la ve al abrir KŌDO. Sin alerta externa.
- **Alerta activa:** según severidad de hallazgos del playbook, el sistema envía notificación por canal externo.

**Canales soportados inicialmente:**
- Email (universal, base)
- Notificación in-app dentro de KŌDO

**Canales para fases posteriores (decisión diferida):**
- Slack
- Webhook genérico
- SMS
- Microsoft Teams

## Manejo de downtime: configurable por tarea

Si KŌDO está caído cuando una tarea debía ejecutarse, cada tarea decide individualmente al ser creada:

- **Modo "ejecutar al recuperar con marca de atrasada":** al levantar KŌDO, ejecuta las tareas pendientes con notificación clara del retraso. Default razonable para tareas críticas.
- **Modo "perder y seguir":** la tarea pendiente se descarta. Solo siguen las próximas ejecuciones según schedule. Apropiado para tareas rutinarias donde ejecutar tarde no agrega valor.

Ejemplo: "limpiar logs cada lunes 8 AM" — si KŌDO levantó martes, no tiene sentido ejecutarla con retraso.

## Propiedad: nivel organización

Las Tareas Programadas pertenecen a la organización, no a usuarios individuales:

- Cualquier usuario con permisos suficientes puede ver, editar, pausar, eliminar las tareas
- Las tareas sobreviven a cambios de personal
- Hay un campo `creado_por` para trazabilidad ("¿quién creó esta tarea?") pero la propiedad es organizacional
- En contexto actual donde Ricardo es solo founder + primer cliente: las tareas son suyas en la práctica, pero el modelo permite escalar cuando se incorpore equipo

## Decisiones diferidas para fase técnica

1. **Manejo de fallas en ejecución programada.** Si la tarea corre y un servidor falla, ¿continúa con los demás? ¿Detiene? Probable: misma política que Sesión Multi-Servidor (decisión diferida también allí, hay que resolverla en ambas en paralelo).
2. **Permisos finos.** ¿Qué rol puede crear tareas programadas? ¿Cualquier admin? ¿Solo superuser? Se define cuando KŌDO tenga sistema de roles formal.
3. **Concurrencia.** Si una tarea está corriendo y llega la siguiente ejecución del mismo schedule, ¿qué pasa? Opciones: skip / cola / paralelo. Sugerencia inicial: skip con marca de "saltada por solapamiento".
4. **Edición de tareas en curso.** Si una tarea está ejecutándose y el operador la edita, ¿qué pasa? Probable: cambios aplican a próxima ejecución, la actual termina con config vieja.
5. **Pausa global.** ¿Hay forma de "pausar todas las tareas programadas" en bulk (modo mantenimiento)? Útil para upgrades de KŌDO o ventanas de cambio.
6. **Reportes de tareas multi-servidor.** Confirmar si una tarea programada que corre contra N servidores genera N reportes individuales + 1 consolidado (igual que Sesión Multi-Servidor) o solo bitácora simple.

---

# PRIMITIVA 6 — Comportamiento Agéntico Real

## Definición

Modelo de operación del agente donde, en lugar de generar reportes monolíticos con preguntas embebidas, el agente opera **paso a paso**, pausando para confirmación humana antes de cada acción significativa, ejecutando solo lo confirmado, y descubriendo dinámicamente las siguientes acciones según resultados obtenidos.

## Origen de esta primitiva

Esta primitiva surgió el 26 de abril durante el fallo de verificación visual del fix de H4. Tras tests verdes, la verificación visual mostró que el agente entrega un reporte monolítico tipo:

```
ACCIÓN 1: ...    ¿Autorizo? (S/N)
ACCIÓN 2: ...    ¿Autorizo? (S/N)
ACCIÓN 3: ...    ¿Autorizo? (S/N)
```

Todo en un solo mensaje, esperando que el operador responda múltiples cosas simultáneamente. Ricardo articuló el comportamiento correcto:

> *"Que se detenga y espere la respuesta y luego continue. y vaya aplicando o arme la lista las acciones necesarias"*

Esta primitiva captura ese comportamiento como concepto formal.

## Cuándo pausar: configurable + safety net

**Modo de operación elegido al iniciar sesión o playbook:**

- **Modo confirmación total:** el agente pausa antes de cada acción, incluso comandos solo-lectura. Útil para entrenamiento, auditoría, o cuando el operador quiere control granular.
- **Modo confirmación de cambios:** el agente ejecuta comandos solo-lectura sin pausa. Pausa solo antes de comandos que modifican estado (restart, kill, rm, edición de archivos, instalación de paquetes, etc.).
- **Modo automático:** el agente ejecuta sin pausa la mayoría de acciones. Apropiado para playbooks rutinarios bien probados.

**Safety net independiente del modo:** sin importar qué modo esté seleccionado, el agente **siempre pausa ante comandos clasificados como alto riesgo**. El operador nunca puede deshabilitar este safety net globalmente. Un comando catalogado como destructivo (ej: `rm -rf`, `DROP TABLE`, `dd if=`, formateo de discos) requiere confirmación explícita aunque el modo sea "automático".

**Pre-aprobación múltiple:** el operador puede confirmar acciones similares en lote ("sí a todas las actualizaciones de paquetes propuestas"). Aplica al grupo identificado en ese momento, no como autorización permanente.

## Anuncio del plan: híbrido

El agente al iniciar una operación compleja **anuncia el plan estimado**: "Detecté 5 acciones necesarias: A, B, C, D, E. Voy a empezar por A."

Pero advierte explícitamente: *"Este plan puede cambiar según hallazgos durante la ejecución."*

Esto da al operador:

- **Transparencia:** ve el alcance estimado del trabajo
- **Decisión informada:** puede decidir si procede con todo o aborta antes de empezar
- **Control de orden:** puede pedir reordenar prioridades

Pero el agente mantiene capacidad de **descubrimiento dinámico**: si al ejecutar acción A descubre algo nuevo, puede agregar acciones intermedias o reordenar siguiendo. Cada modificación al plan se comunica al operador antes de ejecutar.

## Mecanismo técnico: tool use loop

**Decisión arquitectural fundamental:** el agente usa el patrón estándar de tool use de Anthropic SDK para implementar las pausas.

Existirá un tool específico llamado algo como `ask_user(question, type, options?)` o `request_confirmation(action, details)`. El agente decide cuándo invocar este tool según el modo de operación, el riesgo del comando, y el contexto.

Cuando el agente invoca el tool de pausa:

- El flujo de ejecución del agente se suspende formalmente
- El frontend recibe la información necesaria para renderizar la pregunta apropiada (botones, select, input, etc.)
- El operador responde via UI
- La respuesta vuelve al agente como tool result
- El agente continúa con la información nueva

**Implicación importante:** esto reemplaza el patrón actual de KŌDO donde el agente genera markers tipo `[ACTION:]` o preguntas inline en el texto. Es un cambio arquitectural significativo, no un fix incremental.

**Implicación adicional:** el sistema de "eventos del stream" actual (que renderiza step_start, step_result, etc. en tiempo real) sigue siendo válido durante la ejecución de cada acción. La diferencia es que entre acciones hay pausas formales gestionadas por el tool use loop.

## Tipos de pausa: 5 tipos formales

El sistema soporta los siguientes tipos de input requerido:

1. **Confirmación binaria:** Sí/No simples. Ej: "¿Reinicio el servicio nginx?"
2. **Selección múltiple:** elegir una de N opciones. Ej: "¿Qué backup restauro? Lista de 3 opciones disponibles."
3. **Input libre:** texto que el operador escribe. Ej: "¿Cuál es el nombre del nuevo usuario?"
4. **Confirmación con consciencia (high-friction confirmation):** para acciones destructivas mayores. El operador debe escribir una palabra específica (ej: BORRAR, CONFIRMAR, ELIMINAR) en lugar de solo un click. Previene confirmaciones reflexivas en operaciones de alto impacto.
5. **Decisión postergada / programada:** la acción no se ejecuta ahora sino que se programa. Ej: "Esto requiere ventana de mantenimiento. ¿Programo para el sábado a las 3 AM?". Conecta directamente con Primitiva 5 (Tareas Programadas).

Cada playbook puede declarar qué tipos de pausa requiere en sus pasos conocidos de antemano. Pero el agente conserva capacidad de **insertar pausas ad-hoc** cuando detecta situaciones no previstas en el playbook (ej: encuentra un servicio inesperado que requiere decisión).

## Timeouts: sin timeout

Las pausas no tienen timeout. El agente espera indefinidamente la respuesta del operador.

Esta decisión está alineada con la decisión de Primitiva 1 (Sesión Operativa sin límite temporal). Si una sesión puede durar días o semanas, una pausa dentro de ella también puede.

**Implicaciones técnicas (decisión diferida):**

- El estado de "agente pausado esperando input" debe persistir en BD, no en memoria. Reinicios del servidor no deben perder pausas.
- Hay overhead de mantener N pausas abiertas simultáneamente en distintas sesiones. Aceptable dado el volumen esperado.
- Si el operador "olvida" una pausa por mucho tiempo, no hay degradación automática.

## Decisiones diferidas para fase técnica

1. **Clasificación de riesgo de comandos.** ¿Cómo se determina si un comando es bajo/medio/alto riesgo? Opciones: lista hardcoded de patrones / clasificación por LLM / declaración explícita en el playbook. Probablemente combinación.
2. **Granularidad del modo de operación.** ¿Se elige por sesión, por playbook, o por playbook-dentro-de-sesión? Sugerencia inicial: default por sesión, override por playbook si el playbook lo declara.
3. **Manejo de pausas durante reanudación de sesión.** Si una sesión se reanuda y tenía una pausa pendiente, ¿el agente retoma la pausa esperando respuesta o pide al operador que confirme el contexto antes de continuar?
4. **Tool design exacto.** Firma del tool, schema de respuestas, etc. Trabajo de fase técnica.

---

# Relaciones entre primitivas

Las 6 primitivas no son independientes. Existen dependencias y composiciones:

```
Sesión Operativa (P1)
    │
    ├── contiene → ejecuciones de Playbook Formalizado (P2)
    ├── compone ← Sesión Multi-Servidor (P3) crea N instancias
    └── archiva → resultados visibles vía Pantalla Consolidada (P4)

Playbook Formalizado (P2)
    │
    ├── es ejecutado por → motor único de ejecución
    ├── es invocado desde → Sesión Operativa, Sesión Multi-Servidor, Tareas Programadas, Chat
    └── usa → Comportamiento Agéntico Real (P6) para pausas

Sesión Multi-Servidor (P3)
    │
    └── coordina → N instancias de Sesión Operativa (P1)

Pantalla Consolidada de Resultados (P4)
    │
    └── es patrón aplicado a → todas las pantallas que originan operaciones

Tareas Programadas (P5)
    │
    └── invoca → Playbook Formalizado (P2) según schedule

Comportamiento Agéntico Real (P6)
    │
    └── atraviesa → todas las primitivas (es modo de operación, no entidad)
```

## Dependencias para implementación

**Primitivas independientes (pueden construirse aisladas):**
- Playbook Formalizado (P2): solo requiere refactor del modelo de playbooks actual + motor único
- Sesión Operativa (P1): puede construirse standalone con persistencia BD

**Primitivas que dependen de otras:**
- Sesión Multi-Servidor (P3) depende de Sesión Operativa (P1) y Playbook Formalizado (P2)
- Tareas Programadas (P5) depende de Playbook Formalizado (P2)
- Pantalla Consolidada (P4) es patrón, depende de las primitivas que generan resultados (P1, P2, P3, P5)
- Comportamiento Agéntico Real (P6) modifica todas las primitivas que ejecutan acciones

## Recomendación de orden de implementación

(Para discusión en próxima sesión.)

Mi sugerencia inicial:

1. **Sesión Operativa (P1)** primero — es el contenedor donde todo lo demás vive
2. **Playbook Formalizado (P2)** — refactor del modelo actual + motor único; resuelve la inconsistencia "dentro vs fuera de pantalla"
3. **Comportamiento Agéntico Real (P6)** — atraviesa todo, mejor introducirlo temprano antes de construir más sobre el patrón actual de markers
4. **Sesión Multi-Servidor (P3)** + **Pantalla Consolidada (P4)** en paralelo — ambas son consumidoras de P1 y P2
5. **Tareas Programadas (P5)** al final — requiere todo lo anterior estable

Este orden no es vinculante. La decisión final se toma con criterios concretos en próxima sesión:

- ¿Qué primitiva tiene mayor impacto en la operación diaria de Ricardo?
- ¿Qué primitiva tiene menor riesgo arquitectural?
- ¿Qué primitiva da entregable usable más rápido?

---

# Decisiones diferidas (compiladas)

Lista consolidada de decisiones diferidas a fase técnica posterior:

## Sesión Operativa (P1)
- Patrón exacto de detección de secretos
- Política de retención de sesiones cerradas
- Tabla separada para outputs grandes

## Playbook Formalizado (P2)
- Mecanismo formal de extensión de categorías
- Estructura interna (pasos, comandos, lógica condicional)
- Plan de migración de playbooks existentes

## Sesión Multi-Servidor (P3)
- Manejo de fallas durante ejecución
- Política de timeout por servidor
- Cancelación durante ejecución

## Pantalla Consolidada (P4)
- Componentes UI específicos por contexto
- Comportamiento si una operación tarda mucho
- Notificación cross-pantalla

## Tareas Programadas (P5)
- Manejo de fallas en ejecución programada
- Permisos finos (qué rol puede crear)
- Concurrencia (skip / cola / paralelo)
- Edición de tareas en curso
- Pausa global (modo mantenimiento)
- Reportes de tareas multi-servidor

## Comportamiento Agéntico Real (P6)
- Clasificación de riesgo de comandos
- Granularidad del modo de operación
- Manejo de pausas durante reanudación de sesión
- Tool design exacto

---

# Implicaciones para decisiones previas del proyecto

Este documento **invalida parcialmente** la Decisión 4 del 24 de abril (`docs/decisions/2026-04-24-framing-proyecto.md`), que priorizaba Ondas multi-OS:

- **Decisión 4 original:** Onda 1 = Linux + Windows + macOS + pfSense vía SSH
- **Implicación de este documento:** Onda 1 redefinida = primitivas de operación sobre Linux

Multi-OS sin primitivas no genera valor real. Las primitivas son el habilitador.

**Próximo paso:** producir documento `docs/decisions/2026-04-XX-redefinicion-onda-1.md` que actualice formalmente la Decisión 4 con esta nueva visión.

---

# Próximos pasos

1. **Revisar este documento** con cabeza fresca antes de avanzar a diseño técnico.
2. **Decidir orden de implementación** de las 6 primitivas con criterios concretos.
3. **Producir diseño técnico de la primera primitiva elegida** (schema BD, endpoints, componentes UI).
4. **Actualizar `docs/decisions/`** con nueva decisión que redefine Onda 1.
5. **Reanudar Sprint B0** solo si alguna parte aún tiene sentido en el nuevo framing. Probable: arq-19 (SQLite "now" bug) sigue siendo crítico porque bloquea uso real de la pantalla de Playbooks.

---

**Última actualización:** 26 abril 2026, tras sesión de diseño funcional conversacional con Ricardo.

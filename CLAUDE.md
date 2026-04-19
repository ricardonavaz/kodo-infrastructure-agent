# CLAUDE.md — Kodo Infrastructure Agent

Este archivo te da contexto persistente entre sesiones. Leelo completo
al inicio de cada sesion de trabajo en este repo.

---

## Que es Kodo

Kodo es una plataforma de gestion de infraestructura impulsada por IA
(Claude de Anthropic). Permite administrar servidores Linux y Windows
mediante lenguaje natural en espanol, a traves de conexiones SSH. La
interfaz esta en espanol con tema oscuro profesional.

Stack: Node.js 18+ (ES Modules) + Express 4.21 + React 18.3 + Vite 6
+ SQLite (better-sqlite3) + Anthropic SDK + node-ssh. Se despliega en
Windows Server con IIS como reverse proxy y NSSM como servicio.

Repo: https://github.com/ricardonavaz/kodo-infrastructure-agent

---

## Plan de trabajo actual — Stream 1 y Stream 2

Estamos ejecutando un plan paso a paso para (1) estabilizar y mejorar
el codigo actual (Stream 1) y (2) evolucionar el sistema de "respuestas
semanticas" al Rich Response Layer Schema v1.1 (Stream 2).

La spec de referencia vive en docs/rich-response-layer-spec-v1.1.md.
El diagnostico inicial del codigo vive en docs/rrl-diagnostic-report.md.

Orden del plan:

- Paso A1 — Arreglar model router (HECHO, commit fe2627c)
- Paso A2 — Activar prompt caching en ai.js (EN CURSO)
- Paso A3 — Tests al parser semantico
- Paso B1 — Adapter legacy → RRL Schema v1.1
- Paso B2 — Bloques RRL nuevos simples (heading, quote, keyPoint,
  expandable, checklist, exportHint)
- Paso C1 — Hipertexto semantico (choiceGroup y actionBar clicables
  con prompts pre-construidos)
- Paso C2 — Bloque diagram con Mermaid.js
- Paso C3 — Bloques visuales (chart, comparison, timeline)

Cada paso se trabaja en su propia rama con su propio commit. No saltes
pasos. Si un paso requiere sub-pasos (ej: A2.1, A2.2), pausa entre
ellos y espera autorizacion.

---

## Disciplinas no negociables

### Pruebas primero
El proyecto usa node:test + node:assert como framework de testing (no
instalar Jest/Vitest). Los tests del servidor viven en
`server/services/__tests__/`. Se corren con `npm test` desde `server/`.

### No improvises dependencias
El stack esta fijado. No agregues librerias sin pedirme permiso
describiendo: que hace, por que las existentes no bastan, peso en
bundle, mantenimiento activo.

### No borres codigo sin explicar
Si borras mas de 10 lineas, el commit message explica por que.

### Commits pequenos, mensajes densos
Formato: `tipo(scope): resumen`. Tipos: feat, fix, refactor, test,
docs, chore. Primera linea < 72 chars. Cuerpo explica el porque.

### Nunca expongas claves
No hay ANTHROPIC_API_KEY hardcoded. La API key se lee de la tabla
`settings` en la BD. Nunca la pongas en codigo, .env.example, tests
ni commits.

### Tipos semanticos
El proyecto es JS puro (no TypeScript). No introduzcas TypeScript
salvo autorizacion explicita. No uses `// eslint-disable` para
silenciar errores; arreglalos.

---

## Git workflow — disciplina de ramas

Reglas no negociables para commits en este repo:

1. **Nunca commits directos a `main`.** Toda tarea arranca en una rama
   nueva creada desde `main` actualizado.

2. **Nombre de rama:** `rrl/paso-{id}-{slug-corto}` para tareas del
   plan RRL (ejemplo: `rrl/paso-a2-prompt-caching`), o
   `fix/{slug}` / `feat/{slug}` / `refactor/{slug}` para cualquier
   otro trabajo.

3. **Antes de crear rama nueva:** verifica que estas en main limpio y
   actualizado. Ejecuta: `git checkout main && git pull origin main &&
   git status`. Working tree debe estar limpio.

4. **Un paso del plan = una rama = uno o varios commits dentro de la
   rama.** Nunca mezcles dos pasos del plan en la misma rama.

5. **Nunca ejecutes `git commit` ni `git push` sin autorizacion
   explicita del usuario en la conversacion.** El usuario te dira
   "autorizado para commit" o "autorizado para push". Sin esa frase,
   no ejecutas.

6. **Antes de cada commit, muestra:** el resultado de `git status`,
   el mensaje exacto del commit que vas a hacer, y la rama en la que
   estas.

7. **Merge a main:** solo el usuario lo hace. Tu trabajo termina
   cuando la rama tiene el commit pusheado y los tests pasando. No
   intentes mergear ni crear PR tu mismo salvo que el usuario te
   autorice explicitamente.

8. **Si detectas que estas por violar alguna de estas reglas** (por
   ejemplo, estas en main y el usuario te pide hacer commit): pausa,
   avisa al usuario, y propon la correccion (crear rama primero)
   antes de actuar.

---

## Protocolo de trabajo

### Al empezar una tarea
1. Lee el paso que te pidieron completo antes de tocar codigo.
2. Identifica si la spec RRL o el diagnostico aplican. Citalos si si.
3. Para tareas de codigo nuevo: escribe primero los tests (rojos),
   luego implementa hasta que pasen, luego refactoriza.
4. Para modificaciones de codigo existente: entiende que se va a
   romper antes de romperlo.

### Cuando dudas
Pregunta antes de improvisar. Es mejor perder 2 minutos preguntando
que 2 horas deshaciendo.

### Cuando hay desacuerdo con la spec o el plan
Escribe un comentario con: cita textual, por que crees que esta mal,
propuesta concreta. No cambies la spec ni el plan por tu cuenta.

---

## Anti-patrones prohibidos

- Commits directos a main.
- Instalar dependencias sin autorizacion.
- `// eslint-disable` sin comentario justificando y plan para removerlo.
- `catch { }` vacio. Siempre loguea o re-lanza.
- Silenciar errores de test borrando el test.
- Mezclar dos pasos del plan en una rama.
- Ejecutar git commit o git push sin autorizacion explicita.
- Hacer el paso siguiente antes de que el usuario autorice avanzar.

---

Fin de CLAUDE.md. Leelo al inicio de cada sesion. Ante conflicto entre
este archivo y la spec RRL: gana la spec para "que construir"; gana
este archivo para "como trabajar".

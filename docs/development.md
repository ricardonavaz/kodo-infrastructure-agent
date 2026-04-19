# Guia de Desarrollo

## Setup Local

### Prerequisitos
- Node.js >= 18.x
- npm >= 9.x
- Editor con soporte ES modules (VS Code recomendado)

### Instalacion

```bash
git clone <repo-url> SuSSH
cd SuSSH

# Dependencias del servidor
cd server && npm install

# Dependencias del cliente
cd ../client && npm install
```

### Iniciar en desarrollo

```bash
# Terminal 1: Servidor con auto-reload
cd server && node --watch index.js

# Terminal 2: Cliente Vite con HMR
cd client && npx vite
```

- Backend: http://localhost:3001
- Frontend: http://localhost:5173 (proxy a backend via vite.config.js)

---

## Convenciones del Proyecto

### Idioma

- **Todo el codigo UI, prompts de IA, mensajes de error y documentacion interna estan en espanol**
- Nombres de variables, funciones y archivos en ingles
- Comentarios en ingles (cuando existen, son minimos)

### Estilo de codigo

- ES modules (`import`/`export`, no `require`)
- Sin TypeScript (JavaScript puro)
- Sin framework CSS (CSS vanilla con custom properties)
- Sin libreria de componentes UI (React puro)
- Funciones asincronas con `async/await`
- Manejo de errores con try/catch inline

---

## Patrones del Backend

### Crear una migracion

1. Crear archivo en `server/migrations/` con prefijo numerico:
   ```
   018_nombre_descriptivo.js
   ```

2. Exportar funcion `up(db)`:
   ```js
   export function up(db) {
     // DDL con db.exec()
     db.exec(`
       CREATE TABLE IF NOT EXISTS nueva_tabla (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         campo TEXT DEFAULT '',
         created_at TEXT DEFAULT (datetime('now'))
       );
     `);

     // DML con db.prepare()
     db.prepare('INSERT INTO nueva_tabla (campo) VALUES (?)').run('valor');
   }
   ```

3. Para ALTER TABLE idempotente:
   ```js
   export function up(db) {
     const cols = [
       "ALTER TABLE tabla ADD COLUMN nueva_col TEXT DEFAULT ''",
     ];
     for (const sql of cols) {
       try { db.exec(sql); } catch { /* columna ya existe */ }
     }
   }
   ```

4. Las migraciones se aplican automaticamente al iniciar el servidor
5. Se crea backup automatico antes de aplicar
6. No existe funcion `down()` — las migraciones son forward-only

### Crear una ruta

1. Crear archivo en `server/routes/`:
   ```js
   import { Router } from 'express';
   import db from '../db.js';

   const router = Router();

   // Listar
   router.get('/', (req, res) => {
     const items = db.prepare('SELECT * FROM tabla').all();
     res.json(items);
   });

   // Obtener uno
   router.get('/:id', (req, res) => {
     const item = db.prepare('SELECT * FROM tabla WHERE id = ?').get(req.params.id);
     if (!item) return res.status(404).json({ error: 'No encontrado' });
     res.json(item);
   });

   // Crear
   router.post('/', (req, res) => {
     const { campo } = req.body;
     if (!campo) return res.status(400).json({ error: 'Campo requerido' });

     const result = db.prepare('INSERT INTO tabla (campo) VALUES (?)').run(campo);
     res.status(201).json(db.prepare('SELECT * FROM tabla WHERE id = ?').get(result.lastInsertRowid));
   });

   // Actualizar
   router.put('/:id', (req, res) => {
     const existing = db.prepare('SELECT * FROM tabla WHERE id = ?').get(req.params.id);
     if (!existing) return res.status(404).json({ error: 'No encontrado' });

     const { campo } = req.body;
     db.prepare('UPDATE tabla SET campo = ? WHERE id = ?').run(campo ?? existing.campo, req.params.id);
     res.json(db.prepare('SELECT * FROM tabla WHERE id = ?').get(req.params.id));
   });

   // Eliminar
   router.delete('/:id', (req, res) => {
     db.prepare('DELETE FROM tabla WHERE id = ?').run(req.params.id);
     res.json({ success: true });
   });

   export default router;
   ```

2. Registrar en `server/index.js`:
   ```js
   import nuevaRouter from './routes/nueva.js';
   app.use('/api/nueva', nuevaRouter);
   ```

### Patron de respuestas

| Caso | Codigo | Formato |
|------|--------|---------|
| Exito (GET) | 200 | Datos directos |
| Exito (POST crear) | 201 | Objeto creado |
| Exito (DELETE) | 200 | `{ success: true }` |
| Error de validacion | 400 | `{ error: "mensaje" }` |
| No autorizado | 401 | `{ error: "mensaje" }` |
| No permitido | 403 | `{ error: "mensaje" }` |
| No encontrado | 404 | `{ error: "mensaje" }` |
| Duplicado | 409 | `{ error: "mensaje", existing? }` |
| Error interno | 500 | `{ error: "mensaje" }` |

### Patron de SSH con credenciales cifradas

Siempre usar `prepareForSSH()` antes de operaciones SSH:
```js
function prepareForSSH(conn) {
  if (!conn) return conn;
  const prepared = { ...conn };
  if (conn.credentials_encrypted && isUnlocked()) {
    try {
      if (conn.credentials) prepared.credentials = decrypt(conn.credentials);
      if (conn.key_passphrase) prepared.key_passphrase = decrypt(conn.key_passphrase);
    } catch (e) { throw new Error('Error al descifrar: ' + e.message); }
  }
  return prepared;
}
```

---

## Patrones del Frontend

### Agregar metodo al API client

Editar `client/src/hooks/useApi.js`:

```js
export const api = {
  // ... metodos existentes ...

  // Nuevo metodo GET
  getNuevos: (params) => request(`/nueva${buildQuery(params)}`),

  // Nuevo metodo POST
  crearNuevo: (data) => request('/nueva', { method: 'POST', body: data }),

  // Nuevo metodo PUT
  actualizarNuevo: (id, data) => request(`/nueva/${id}`, { method: 'PUT', body: data }),

  // Nuevo metodo DELETE
  eliminarNuevo: (id) => request(`/nueva/${id}`, { method: 'DELETE' }),
};
```

### Crear un componente

Patron de componente modal (el mas comun en la app):

```jsx
import React, { useState, useEffect } from 'react';
import { api } from '../hooks/useApi.js';

export default function NuevoManager({ onClose, ...props }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try { setItems(await api.getNuevos()); } catch { /* ignore */ }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700 }}>
        <h3>// Titulo</h3>

        {/* Contenido */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {items.map((item) => (
            <div key={item.id} className="kb-entry">
              {/* ... */}
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
```

### Tema y CSS

Variables CSS disponibles (definidas en `client/src/index.css`):

```css
--bg-primary: #0a0e14;      /* Fondo principal */
--bg-secondary: #0d1117;    /* Fondo secundario */
--bg-tertiary: #161b22;     /* Hover/active */
--bg-hover: #1c2333;
--border: #21262d;
--text-primary: #ffffff;
--text-secondary: #c9d1d9;
--text-muted: #8b949e;
--accent: #00ff41;           /* Verde neon (principal) */
--accent-dim: #00cc33;
--accent-bg: rgba(0,255,65,0.08);
--amber: #ffb800;            /* Warning/orange */
--red: #ff4444;              /* Error */
--blue: #58a6ff;
--purple: #d2a8ff;
--font-mono: 'JetBrains Mono', monospace;
--font-sans: 'Inter', sans-serif;
```

**Clases reutilizables:**
- `.btn`, `.btn-primary`, `.btn-secondary` — Botones
- `.form-group`, `.form-row` — Formularios
- `.modal-overlay`, `.modal` — Modales
- `.modal-actions` — Acciones de modal
- `.kb-entry`, `.kb-entry-header`, `.kb-detail` — Cards expandibles
- `.metrics-chip` — Badges pequeños
- `.meta` — Texto metadata (gris, 10px)
- `.profile-grid`, `.profile-field` — Grid de datos de perfil
- `.settings-section-title` — Titulo de seccion

---

## Testing

### Verificacion manual de rutas

```bash
# Health check
curl http://localhost:3001/api/health

# Listar conexiones
curl http://localhost:3001/api/connections

# Verificar sintaxis de un archivo de ruta
node --check server/routes/nueva.js
```

### Verificacion de base de datos

```bash
# Abrir consola SQLite
sqlite3 server/kodo.db

# Listar tablas
.tables

# Ver schema de tabla
.schema server_profiles

# Consultar migraciones aplicadas
SELECT * FROM schema_migrations;
```

---

## Estructura de Archivos

```
server/
├── index.js               ← Entry point, monta routers
├── db.js                  ← SQLite init, migraciones, backups
├── routes/
│   ├── connections.js     ← CRUD servidores + connect/disconnect
│   ├── agent.js           ← Chat IA + jobs SSE
│   ├── settings.js        ← Config + master key
│   ├── groups.js          ← Grupos de servidores
│   ├── audit.js           ← Log de auditoria
│   ├── playbooks.js       ← Playbooks + generacion IA
│   ├── scheduler.js       ← Tareas cron
│   ├── updates.js         ← Gestion de actualizaciones
│   ├── sessions.js        ← Sesiones de trabajo
│   ├── profiles.js        ← Perfiles de servidor
│   ├── knowledge.js       ← Base de conocimiento
│   ├── approval.js        ← Perfiles de aprobacion
│   ├── initial-actions.js ← Acciones rapidas
│   ├── export.js          ← Exportacion HTML/MD
│   └── security.js        ← Auditoria de seguridad
├── services/
│   ├── ai.js              ← Motor de chat Claude
│   ├── ssh.js             ← Pool SSH + ejecucion
│   ├── crypto.js          ← Cifrado AES-256-GCM
│   ├── profiler.js        ← Inventario de servidores
│   ├── scheduler.js       ← Ejecucion de cron
│   ├── knowledge.js       ← Aprendizaje automatico
│   ├── model-router.js    ← Seleccion de modelo
│   ├── security.js        ← Auditoria de seguridad
│   ├── updates.js         ← Deteccion de updates
│   ├── semantic-parser.js ← Motor de parsing semantico
│   ├── playbook-executor.js ← Ejecucion avanzada de playbooks
│   └── auditor.js         ← Agente IA auditor
├── middleware/
│   └── sanitize.js        ← Redaccion de datos sensibles
├── migrations/            ← 017+ archivos de migracion
└── backups/               ← Auto-backups de DB

client/
├── src/
│   ├── App.jsx            ← Root component
│   ├── main.jsx           ← Entry point React
│   ├── index.css          ← Estilos globales
│   ├── hooks/
│   │   └── useApi.js      ← Cliente API centralizado
│   ├── utils/
│   │   └── formatMessage.js  ← Parser markdown compartido
│   └── components/
│       ├── Sidebar.jsx
│       ├── Terminal.jsx
│       ├── SplitView.jsx
│       ├── ExecutionPanel.jsx
│       ├── SmartMessage.jsx     ← Orquestador de bloques semanticos
│       ├── ContextActions.jsx   ← Menu contextual por bloque
│       ├── BlockAssistant.jsx   ← Asistente IA inline
│       ├── blocks/              ← Componentes de bloque semantico
│       │   ├── TextBlock.jsx
│       │   ├── DataTable.jsx
│       │   ├── MetricBlock.jsx
│       │   ├── Finding.jsx
│       │   ├── QuestionPrompt.jsx
│       │   ├── Recommendation.jsx
│       │   ├── CodeBlock.jsx
│       │   ├── SummaryCard.jsx
│       │   └── ExecutionStep.jsx
│       ├── ConnectionForm.jsx
│       ├── ProfileViewer.jsx
│       ├── PlaybookManager.jsx
│       ├── PlaybookEditor.jsx   ← Editor visual de playbooks
│       ├── GroupManager.jsx
│       ├── AuditLog.jsx
│       ├── KnowledgeManager.jsx
│       ├── Settings.jsx
│       ├── SessionBanner.jsx
│       ├── SearchFilter.jsx
│       ├── QuickActions.jsx
│       ├── ModelSelector.jsx
│       ├── ServerStatus.jsx
│       └── InitialActions.jsx
├── public/
├── dist/                  ← Build de produccion
├── index.html
└── vite.config.js
```

# Guia de Despliegue

## Prerequisitos

- **Node.js** >= 18.x (ES modules requerido)
- **npm** >= 9.x
- **Sistema operativo:** macOS, Linux, o Windows (servidor)
- **Red:** Acceso SSH a los servidores destino
- **API Key:** Clave de API de Anthropic (para funcionalidad IA)

## Instalacion

### 1. Clonar repositorio

```bash
git clone <repo-url> SuSSH
cd SuSSH
```

### 2. Instalar dependencias

```bash
# Dependencias del servidor
cd server
npm install

# Dependencias del cliente
cd ../client
npm install

# Dependencias raiz (generacion de documentos)
cd ..
npm install
```

### 3. Configuracion inicial

No se requiere configuracion previa. Al iniciar por primera vez:
- La base de datos SQLite se crea automaticamente (`server/kodo.db`)
- Las migraciones se aplican automaticamente
- La carpeta de backups se crea automaticamente

## Desarrollo

### Iniciar en modo desarrollo

**Terminal 1 — Servidor:**
```bash
cd server
node --watch index.js
```
El servidor inicia en `http://localhost:3001`. El flag `--watch` reinicia automaticamente al detectar cambios.

**Terminal 2 — Cliente:**
```bash
cd client
npx vite
```
El cliente Vite inicia en `http://localhost:5173` con Hot Module Replacement (HMR).

### Configuracion de Vite

El archivo `client/vite.config.js` configura el proxy al backend:
```js
server: {
  proxy: {
    '/api': 'http://localhost:3001'
  }
}
```

## Produccion

### 1. Build del frontend

```bash
cd client
npx vite build
```
Genera archivos estaticos en `client/dist/`.

### 2. Servir frontend desde Express

Para produccion, se recomienda servir los archivos estaticos desde Express:

```js
// Agregar en server/index.js antes de las rutas API
import { join } from 'path';
app.use(express.static(join(__dirname, '../client/dist')));

// Fallback para SPA routing (al final, despues de las rutas API)
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../client/dist/index.html'));
});
```

### 3. Iniciar servidor de produccion

```bash
cd server
NODE_ENV=production node index.js
```

### 4. Process Manager (recomendado)

Usar PM2 para mantener el proceso activo:

```bash
# Instalar PM2
npm install -g pm2

# Iniciar con PM2
cd server
pm2 start index.js --name kodo

# Configurar auto-inicio
pm2 startup
pm2 save

# Comandos utiles
pm2 logs kodo
pm2 restart kodo
pm2 stop kodo
pm2 monit
```

Alternativamente con systemd:

```ini
# /etc/systemd/system/kodo.service
[Unit]
Description=Kodo Infrastructure Agent
After=network.target

[Service]
Type=simple
User=kodo
WorkingDirectory=/opt/SuSSH/server
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10
Environment=PORT=3001
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable kodo
sudo systemctl start kodo
```

## Variables de Entorno

| Variable | Default | Descripcion |
|----------|---------|-------------|
| PORT | 3001 | Puerto del servidor Express |
| NODE_ENV | — | 'production' para modo produccion |

## Base de Datos

### Ubicacion
- Archivo: `server/kodo.db`
- WAL files: `server/kodo.db-shm`, `server/kodo.db-wal`

### Backups automaticos
- Se crean antes de aplicar nuevas migraciones
- Ubicacion: `server/backups/kodo-YYYY-MM-DDTHH-MM-SS.db`
- Se conservan los ultimos 5 backups
- WAL checkpoint (TRUNCATE) antes de cada backup

### Backup manual

```bash
# Checkpoint WAL primero
sqlite3 server/kodo.db "PRAGMA wal_checkpoint(TRUNCATE);"

# Copiar archivo
cp server/kodo.db server/backups/kodo-manual-$(date +%Y%m%d).db
```

### Restaurar backup

```bash
# Detener el servidor primero
pm2 stop kodo

# Restaurar
cp server/backups/kodo-2026-04-14T12-00-00.db server/kodo.db

# Reiniciar
pm2 start kodo
```

## Seguridad en Produccion

1. **CORS:** Configurar origenes permitidos (actualmente acepta todos)
2. **HTTPS:** Usar reverse proxy (nginx/caddy) con SSL
3. **Firewall:** Restringir puerto 3001 a red interna
4. **Master Key:** Configurar master key para cifrar credenciales SSH
5. **Permisos de archivo:** Restringir acceso a `kodo.db` y backups

### Ejemplo con nginx como reverse proxy

```nginx
server {
    listen 443 ssl;
    server_name kodo.internal;

    ssl_certificate /etc/ssl/certs/kodo.crt;
    ssl_certificate_key /etc/ssl/private/kodo.key;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # SSE support
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;
    }
}
```

## Troubleshooting

### Puerto en uso
El servidor mata automaticamente procesos existentes en el puerto configurado. Si persiste:
```bash
lsof -ti:3001 | xargs kill -9
```

### WAL files grandes
Los archivos `-shm` y `-wal` crecen con el uso. Para compactar:
```bash
sqlite3 server/kodo.db "PRAGMA wal_checkpoint(TRUNCATE);"
```

### Migraciones fallidas
- El servidor crea backup automatico antes de migrar
- Si una migracion falla, restaurar desde `server/backups/`
- Las migraciones son atomicas (transaccionales)

### SSH connection pool
Las conexiones SSH se mantienen en un pool en memoria. Si un servidor remoto se reinicia, la conexion pool puede quedar stale. Reconectar desde la UI limpia automaticamente.

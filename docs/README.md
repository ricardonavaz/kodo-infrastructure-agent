# Kodo Infrastructure Agent - Documentacion Tecnica

**Version:** 1.0.0
**Nombre interno:** SuSSH
**Ultima actualizacion:** 2026-04-14

---

## Descripcion

Kodo es una plataforma de administracion de infraestructura impulsada por IA (Claude/Anthropic) que permite gestionar servidores Linux y Windows mediante lenguaje natural en espanol. Proporciona conexion SSH, ejecucion de comandos automatizada, playbooks, scheduling, auditoria de seguridad, gestion de actualizaciones y una base de conocimiento auto-aprendida.

## Stack Tecnologico

| Componente | Tecnologia |
|---|---|
| Backend | Express.js (ES modules), Node.js |
| Frontend | React 18.3, Vite |
| Base de datos | SQLite3 (better-sqlite3, WAL mode) |
| IA | Anthropic Claude (Haiku/Sonnet/Opus) |
| SSH | node-ssh |
| Cifrado | AES-256-GCM, PBKDF2-SHA512 |

## Indice de Documentacion

| Documento | Descripcion |
|---|---|
| [Arquitectura](architecture.md) | Vision general del sistema, capas, flujos de datos |
| [Referencia de API](api-reference.md) | Todos los endpoints REST (~80+) |
| [Schema de Base de Datos](database-schema.md) | Tablas, columnas, relaciones |
| [Guia de Despliegue](deployment.md) | Instalacion, build, produccion |
| [Configuracion](configuration.md) | Settings, API keys, cifrado, modelos |
| [Sistema de Playbooks](playbook-system.md) | Automatizacion, pasos, variables, ejecucion |
| [Modelo de Seguridad](security-model.md) | Cifrado, aprobaciones, auditoria |
| [Desarrollo](development.md) | Setup local, convenciones, patrones |
| [Changelog](CHANGELOG.md) | Historial de cambios por version |

## Quick Start

```bash
# 1. Clonar e instalar
git clone <repo-url> SuSSH
cd SuSSH

# 2. Instalar dependencias
cd server && npm install && cd ..
cd client && npm install && cd ..

# 3. Iniciar en desarrollo
cd server && node index.js &
cd client && npx vite &

# 4. Abrir en navegador
open http://localhost:5173
```

## Estructura del Proyecto

```
SuSSH/
├── client/                    # Frontend React/Vite
│   ├── src/
│   │   ├── components/        # Componentes React (17 archivos)
│   │   ├── hooks/             # useApi.js - cliente API centralizado
│   │   ├── index.css          # Estilos globales (dark theme)
│   │   ├── App.jsx            # Componente raiz
│   │   └── main.jsx           # Entry point
│   ├── public/
│   ├── dist/                  # Build de produccion
│   ├── index.html
│   └── vite.config.js
│
├── server/                    # Backend Express.js
│   ├── routes/                # 15 routers REST
│   ├── services/              # Logica de negocio (8 servicios)
│   ├── migrations/            # Migraciones de DB (017+)
│   ├── middleware/            # Sanitizacion de logs
│   ├── backups/               # Auto-backups de DB
│   ├── db.js                  # Inicializacion SQLite + migraciones
│   ├── index.js               # Entry point Express
│   └── kodo.db                # Base de datos SQLite
│
├── docs/                      # Documentacion tecnica
├── generate-doc.js            # Generador de documentos Word
└── package.json               # Dependencias raiz (docx)
```

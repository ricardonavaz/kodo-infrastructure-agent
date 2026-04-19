const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
        ShadingType, PageNumber, PageBreak, LevelFormat, TabStopType, TabStopPosition } = require('docx');
const fs = require('fs');

const PAGE_WIDTH = 12240;
const MARGINS = { top: 1440, right: 1440, bottom: 1440, left: 1440 };
const CONTENT_WIDTH = PAGE_WIDTH - MARGINS.left - MARGINS.right; // 9360

const COLORS = {
  accent: "00CC33",
  accentDark: "008822",
  dark: "0D1117",
  darkBg: "161B22",
  border: "21262D",
  text: "333333",
  textLight: "666666",
  blue: "2E5090",
  amber: "CC8800",
  red: "CC3333",
  headerBg: "0D1117",
  headerText: "E6EDF3",
  tableBorder: "CCCCCC",
  tableHeader: "0D1117",
  tableHeaderText: "E6EDF3",
  tableStripe: "F5F5F5",
};

const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: COLORS.tableBorder };
const cellBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };

function headerCell(text, width) {
  return new TableCell({
    borders: cellBorders, width: { size: width, type: WidthType.DXA },
    shading: { fill: COLORS.tableHeader, type: ShadingType.CLEAR },
    margins: cellMargins,
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: COLORS.tableHeaderText, font: "Arial", size: 18 })] })],
  });
}

function cell(text, width, opts = {}) {
  const runs = typeof text === 'string' ? [new TextRun({ text, font: "Arial", size: 18, color: opts.color || COLORS.text, bold: opts.bold || false })] : text;
  return new TableCell({
    borders: cellBorders, width: { size: width, type: WidthType.DXA },
    shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    margins: cellMargins,
    children: [new Paragraph({ children: runs })],
  });
}

function monoCell(text, width, opts = {}) {
  return new TableCell({
    borders: cellBorders, width: { size: width, type: WidthType.DXA },
    shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    margins: cellMargins,
    children: [new Paragraph({ children: [new TextRun({ text, font: "Courier New", size: 16, color: opts.color || COLORS.text })] })],
  });
}

function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    children: [new TextRun({ text, bold: true, font: "Arial", size: 36, color: COLORS.dark })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: COLORS.accent, space: 8 } },
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 150 },
    children: [new TextRun({ text, bold: true, font: "Arial", size: 28, color: COLORS.accentDark })],
  });
}

function heading3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, font: "Arial", size: 24, color: COLORS.blue })],
  });
}

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after || 120 },
    alignment: opts.align || AlignmentType.LEFT,
    children: [new TextRun({ text, font: "Arial", size: 20, color: opts.color || COLORS.text, bold: opts.bold || false, italics: opts.italic || false })],
  });
}

function boldPara(label, text) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: label, font: "Arial", size: 20, bold: true, color: COLORS.text }),
      new TextRun({ text, font: "Arial", size: 20, color: COLORS.text }),
    ],
  });
}

function bullet(text, ref = "bullets") {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text, font: "Arial", size: 20, color: COLORS.text })],
  });
}

function numberItem(text, ref = "numbers") {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text, font: "Arial", size: 20, color: COLORS.text })],
  });
}

function emptyPara() {
  return new Paragraph({ spacing: { after: 60 }, children: [] });
}

function makeTable(headers, rows, colWidths) {
  const tableRows = [
    new TableRow({ children: headers.map((h, i) => headerCell(h, colWidths[i])) }),
    ...rows.map((row, ri) =>
      new TableRow({
        children: row.map((c, ci) => {
          if (typeof c === 'object' && c.mono) return monoCell(c.text, colWidths[ci], { shading: ri % 2 === 1 ? COLORS.tableStripe : undefined });
          const isObj = typeof c === 'object' && c !== null;
          return cell(isObj ? c.text || '' : (c || ''), colWidths[ci], { shading: ri % 2 === 1 ? COLORS.tableStripe : undefined, bold: isObj ? c.bold : false, color: isObj ? c.color : undefined });
        })
      })
    ),
  ];
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: tableRows,
  });
}

// ============ BUILD DOCUMENT ============
const children = [];

// COVER PAGE
children.push(emptyPara(), emptyPara(), emptyPara(), emptyPara(), emptyPara(), emptyPara());
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 100 },
  children: [new TextRun({ text: "KODO", font: "Courier New", size: 96, bold: true, color: COLORS.accent })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 200 },
  children: [new TextRun({ text: "INFRASTRUCTURE AGENT", font: "Arial", size: 28, color: COLORS.textLight, characterSpacing: 300 })],
}));
children.push(emptyPara());
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 60 },
  border: { top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.accent, space: 12 }, bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.accent, space: 12 } },
  children: [new TextRun({ text: "Documento Tecnico de Producto", font: "Arial", size: 24, color: COLORS.text })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 60 },
  children: [new TextRun({ text: "Especificacion Completa de Capacidades y Arquitectura", font: "Arial", size: 20, color: COLORS.textLight })],
}));
children.push(emptyPara(), emptyPara(), emptyPara());
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: `Version 1.0  |  Abril 2026`, font: "Arial", size: 20, color: COLORS.textLight })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 200 },
  children: [new TextRun({ text: "48 archivos  |  ~6,700 lineas de codigo  |  10 migraciones  |  40+ endpoints API", font: "Courier New", size: 18, color: COLORS.textLight })],
}));

// PAGE BREAK
children.push(new Paragraph({ children: [new PageBreak()] }));

// ===================== 1. VISION =====================
children.push(heading1("1. Vision del Producto"));
children.push(para("Kodo Infrastructure Agent es una consola inteligente de operacion y automatizacion de servidores, que permite conectarse por SSH a multiples servidores Linux y Windows y controlarlos con lenguaje natural en espanol. El sistema interpreta instrucciones del usuario mediante Claude (Anthropic), ejecuta los comandos SSH necesarios, y devuelve los resultados explicados."));
children.push(para("La aplicacion no se limita a enviar comandos por chat. Es una capa de orquestacion segura que integra: inventario persistente de servidores, gestion avanzada de autenticacion, chat operativo con IA, panel de ejecucion en vivo, historial auditable, procedimientos reutilizables (playbooks), automatizacion programada (scheduler), y gestion de actualizaciones del sistema."));

// ===================== 2. STACK =====================
children.push(heading1("2. Stack Tecnologico"));
children.push(makeTable(
  ["Capa", "Tecnologia", "Version"],
  [
    ["Backend", "Node.js + Express (ESModules)", "v22.15 / v4.21"],
    ["Frontend", "React + Vite", "v18.3 / v6.4"],
    ["Base de datos", "SQLite (better-sqlite3)", "v11.7"],
    ["SSH", "node-ssh", "v13.2"],
    ["AI", "@anthropic-ai/sdk", "v0.39"],
    ["Criptografia", "Node.js crypto (built-in)", "AES-256-GCM"],
    ["Estilos", "CSS puro (custom design system)", "Dark terminal theme"],
  ],
  [2200, 4800, 2360]
));
children.push(para("Sin dependencias adicionales para Phases 2-8. Todo el cifrado, scheduling y gestion de updates usa modulos nativos de Node.js.", { italic: true, color: COLORS.textLight }));

// ===================== 3. ARCHITECTURE =====================
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(heading1("3. Arquitectura por Capas"));
children.push(para("El sistema esta organizado en 6 capas claramente separadas:"));

children.push(makeTable(
  ["Capa", "Responsabilidad", "Archivos Clave"],
  [
    ["Interfaz (React)", "Componentes UI, estado, interaccion", "13 componentes JSX + CSS"],
    ["API (Express)", "Endpoints REST, validacion, routing", "8 archivos de rutas"],
    ["Dominio / Logica", "Reglas de negocio, deteccion de tareas", "routes/ + services/"],
    ["Integracion IA", "Claude API, tool_use, metricas", "services/ai.js"],
    ["Conexion Remota", "SSH pooling, timeouts, ejecucion", "services/ssh.js"],
    ["Persistencia", "SQLite, migraciones, WAL mode", "db.js + 10 migraciones"],
    ["Seguridad", "AES-256-GCM, Keychain, sanitizacion", "services/crypto.js"],
    ["Automatizacion", "Cron parser, scheduler, retries", "services/scheduler.js"],
  ],
  [2000, 4000, 3360]
));

children.push(heading2("Estructura de Carpetas"));
children.push(new Paragraph({
  spacing: { after: 200 },
  children: [new TextRun({ text:
`SuSSH/
  server/
    index.js, db.js
    routes/      (connections, agent, settings, groups, audit, playbooks, scheduler, updates)
    services/    (ai, ssh, crypto, scheduler, updates)
    middleware/  (sanitize)
    migrations/  (001 - 010)
  client/
    src/
      App.jsx, main.jsx, index.css
      components/  (13 componentes)
      hooks/       (useApi.js)`, font: "Courier New", size: 16, color: COLORS.text })],
}));

// ===================== 4. DATABASE =====================
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(heading1("4. Modelo de Datos"));
children.push(para("La base de datos SQLite contiene 12 tablas gestionadas por un sistema de migraciones versionado. Cada migracion se registra en la tabla schema_migrations y se ejecuta automaticamente al iniciar el servidor."));

children.push(heading2("4.1 Tablas del Sistema"));
children.push(makeTable(
  ["Tabla", "Proposito", "Migracion"],
  [
    ["connections", "Inventario de servidores SSH con 20 columnas", "001 + 002 + 004 + 005"],
    ["settings", "Configuracion global (API key, modelo, master key)", "001"],
    ["chat_history", "Historial de conversaciones con metricas AI", "001 + 005"],
    ["server_groups", "Grupos logicos de servidores", "003"],
    ["server_group_members", "Membresía servidores-grupos (M:N)", "003"],
    ["execution_log", "Log de comandos ejecutados con timing", "006"],
    ["audit_log", "Auditoria completa de interacciones", "007"],
    ["playbooks", "Procedimientos operativos reutilizables", "008"],
    ["playbook_runs", "Historial de ejecucion de playbooks", "008"],
    ["scheduled_tasks", "Tareas programadas con cron", "009"],
    ["scheduled_task_runs", "Historial de ejecucion del scheduler", "009"],
    ["update_checks", "Verificaciones de actualizaciones del SO", "010"],
    ["update_executions", "Historial de aplicacion de updates", "010"],
    ["schema_migrations", "Control de versiones de migraciones", "db.js"],
  ],
  [3000, 4360, 2000]
));

children.push(heading2("4.2 Columnas de connections (20 campos)"));
children.push(makeTable(
  ["Columna", "Tipo", "Descripcion"],
  [
    ["id", "INTEGER PK", "Identificador unico autoincremental"],
    ["name", "TEXT NOT NULL", "Nombre descriptivo del servidor"],
    ["host", "TEXT NOT NULL", "Hostname o direccion IP"],
    ["port", "INTEGER", "Puerto SSH (default 22)"],
    ["username", "TEXT NOT NULL", "Usuario de conexion"],
    ["auth_type", "TEXT", "Metodo: password | key"],
    ["credentials", "TEXT", "Password o clave privada (cifrable)"],
    ["credentials_encrypted", "INTEGER", "Flag de cifrado (0/1)"],
    ["key_passphrase", "TEXT", "Passphrase de la llave SSH"],
    ["key_path", "TEXT", "Ruta al archivo de llave"],
    ["os_type", "TEXT", "Sistema operativo: linux | windows"],
    ["environment", "TEXT", "Entorno: production | staging | test | dev"],
    ["tags", "TEXT (JSON)", "Etiquetas como array JSON"],
    ["description", "TEXT", "Descripcion del servidor"],
    ["notes", "TEXT", "Notas operativas"],
    ["is_favorite", "INTEGER", "Marcado como favorito (0/1)"],
    ["status", "TEXT", "ok | warning | unreachable | invalid_credentials | pending_review"],
    ["last_connection_at", "TEXT", "Timestamp de ultima conexion exitosa"],
    ["last_validation_result", "TEXT (JSON)", "Resultado de ultima prueba"],
    ["preferred_model", "TEXT", "Modelo AI preferido para este servidor"],
  ],
  [3000, 2360, 4000]
));

// ===================== 5. API =====================
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(heading1("5. API REST - Endpoints Completos"));
children.push(para("El servidor expone 40+ endpoints REST organizados en 8 routers. Todos bajo el prefijo /api."));

children.push(heading2("5.1 Conexiones (/api/connections)"));
children.push(makeTable(
  ["Metodo", "Ruta", "Funcion"],
  [
    ["GET", "/connections", "Listar con filtros (search, environment, tags, status, favorite, group_id)"],
    ["GET", "/connections/:id", "Obtener una conexion"],
    ["POST", "/connections", "Crear (con deteccion de duplicados 409)"],
    ["PUT", "/connections/:id", "Actualizar"],
    ["DELETE", "/connections/:id", "Eliminar (cierra SSH automaticamente)"],
    ["PUT", "/connections/:id/favorite", "Toggle favorito"],
    ["POST", "/connections/:id/test", "Probar conexion (persiste resultado)"],
    ["POST", "/connections/:id/connect", "Establecer sesion SSH"],
    ["POST", "/connections/:id/disconnect", "Cerrar sesion SSH"],
    ["GET", "/connections/:id/status", "Estado de conexion individual"],
    ["GET", "/connections/status/all", "Estado de todas las conexiones (batch)"],
  ],
  [1200, 3800, 4360]
));

children.push(heading2("5.2 Agente AI (/api/agent)"));
children.push(makeTable(
  ["Metodo", "Ruta", "Funcion"],
  [
    ["POST", "/agent/:id/chat", "Enviar mensaje al agente (body: {message, model?})"],
    ["GET", "/agent/:id/history", "Historial de chat con metricas"],
    ["GET", "/agent/:id/executions", "Log de comandos ejecutados (paginado)"],
    ["DELETE", "/agent/:id/history", "Limpiar historial"],
  ],
  [1200, 3800, 4360]
));

children.push(heading2("5.3 Playbooks (/api/playbooks)"));
children.push(makeTable(
  ["Metodo", "Ruta", "Funcion"],
  [
    ["GET", "/playbooks", "Listar (filtrable por category, system)"],
    ["GET", "/playbooks/:id", "Obtener detalle"],
    ["POST", "/playbooks", "Crear playbook personalizado"],
    ["PUT", "/playbooks/:id", "Actualizar (solo custom)"],
    ["DELETE", "/playbooks/:id", "Eliminar (solo custom)"],
    ["POST", "/playbooks/:id/execute", "Ejecutar (body: {connectionId, variables?})"],
    ["GET", "/playbooks/:id/runs", "Historial de ejecuciones"],
  ],
  [1200, 3800, 4360]
));

children.push(heading2("5.4 Scheduler (/api/scheduler)"));
children.push(makeTable(
  ["Metodo", "Ruta", "Funcion"],
  [
    ["GET", "/scheduler", "Listar tareas programadas"],
    ["POST", "/scheduler", "Crear tarea con expresion cron"],
    ["PUT", "/scheduler/:id", "Actualizar tarea"],
    ["DELETE", "/scheduler/:id", "Eliminar tarea"],
    ["PUT", "/scheduler/:id/toggle", "Habilitar/deshabilitar"],
    ["POST", "/scheduler/:id/run-now", "Ejecucion manual inmediata"],
    ["GET", "/scheduler/:id/runs", "Historial de corridas"],
    ["GET", "/scheduler/templates/list", "Plantillas predefinidas"],
  ],
  [1200, 3800, 4360]
));

children.push(heading2("5.5 Actualizaciones (/api/updates)"));
children.push(makeTable(
  ["Metodo", "Ruta", "Funcion"],
  [
    ["POST", "/updates/check/:id", "Detectar OS + consultar updates pendientes"],
    ["GET", "/updates/status/:id", "Ultimo check de un servidor"],
    ["GET", "/updates/status", "Status de todos los servidores"],
    ["POST", "/updates/apply/:id", "Aplicar actualizaciones (selectivas o todas)"],
    ["GET", "/updates/history/:id", "Historial de checks y ejecuciones"],
    ["GET", "/updates/dashboard/summary", "Dashboard agregado"],
  ],
  [1200, 3800, 4360]
));

children.push(heading2("5.6 Otros Routers"));
children.push(makeTable(
  ["Router", "Endpoints", "Funcion"],
  [
    ["Grupos (/api/groups)", "CRUD + miembros (7 endpoints)", "Agrupacion logica de servidores"],
    ["Auditoria (/api/audit)", "Listar, detalle, stats, export CSV (4 endpoints)", "Historial auditable de operaciones"],
    ["Configuracion (/api/settings)", "GET/PUT + master key lifecycle (7 endpoints)", "API key, modelo, cifrado"],
    ["Health (/api/health)", "GET", "Status del servidor"],
  ],
  [3200, 3160, 3000]
));

// ===================== 6. SECURITY =====================
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(heading1("6. Seguridad y Criptografia"));

children.push(heading2("6.1 Cifrado de Credenciales"));
children.push(makeTable(
  ["Parametro", "Valor"],
  [
    ["Algoritmo", "AES-256-GCM (Authenticated Encryption with Associated Data)"],
    ["Derivacion de clave", "PBKDF2-SHA512, 600,000 iteraciones"],
    ["Longitud de clave", "256 bits (32 bytes)"],
    ["IV (nonce)", "12 bytes aleatorios por cifrado"],
    ["Auth Tag", "16 bytes (integridad de datos)"],
    ["Salt", "32 bytes aleatorios por master key"],
    ["Almacenamiento", "JSON base64: {iv, data, tag}"],
  ],
  [3000, 6360]
));

children.push(heading2("6.2 Flujo de Clave Maestra"));
children.push(numberItem("El usuario configura una clave maestra (minimo 8 caracteres) desde la UI", "sec-numbers"));
children.push(numberItem("Se genera salt aleatorio de 32 bytes y se deriva la clave con PBKDF2", "sec-numbers"));
children.push(numberItem("El hash se almacena en settings; la clave derivada se mantiene solo en memoria", "sec-numbers"));
children.push(numberItem("Opcionalmente se guarda en macOS Keychain para auto-desbloqueo al iniciar", "sec-numbers"));
children.push(numberItem("Las credenciales se cifran/descifran transparentemente al guardar/usar", "sec-numbers"));
children.push(numberItem("Al bloquear, la clave se elimina de memoria. Credenciales inaccesibles.", "sec-numbers"));

children.push(heading2("6.3 Deteccion de Comandos Destructivos"));
children.push(para("El sistema detecta automaticamente comandos potencialmente peligrosos antes de ejecutarlos:"));
children.push(new Paragraph({
  spacing: { after: 120 },
  children: [new TextRun({ text: "rm -rf | mkfs | dd if= | drop table/database | truncate table | format | fdisk | shutdown | reboot | init 0 | poweroff | systemctl stop/disable | kill -9 | pkill | wipefs", font: "Courier New", size: 16, color: COLORS.red })],
}));

children.push(heading2("6.4 Sanitizacion de Logs"));
children.push(para("Toda informacion sensible se redacta automaticamente en logs. Los campos que coinciden con el patron password|credentials|secret|token|passphrase|api_key se reemplazan con [REDACTED]."));

// ===================== 7. AI =====================
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(heading1("7. Integracion con Claude (Anthropic)"));

children.push(heading2("7.1 Seleccion de Modelo"));
children.push(para("El modelo se resuelve en cascada con 4 niveles de prioridad:"));
children.push(makeTable(
  ["Prioridad", "Nivel", "Donde se configura"],
  [
    ["1 (mas alta)", "Override de sesion", "Selector en header del chat"],
    ["2", "Preferencia del servidor", "Formulario de conexion"],
    ["3", "Default global", "Configuracion general"],
    ["4 (fallback)", "Hardcoded", "claude-sonnet-4-20250514"],
  ],
  [1800, 3200, 4360]
));

children.push(heading2("7.2 Modelos Disponibles"));
children.push(makeTable(
  ["Modelo", "Perfil", "Costo Input/1K", "Costo Output/1K"],
  [
    ["claude-sonnet-4-20250514", "Equilibrado", "$0.003", "$0.015"],
    ["claude-haiku-4-5-20251001", "Rapido y economico", "$0.001", "$0.005"],
    ["claude-opus-4-20250514", "Maximo razonamiento", "$0.015", "$0.075"],
  ],
  [3500, 2500, 1680, 1680]
));

children.push(heading2("7.3 Metricas por Interaccion"));
children.push(para("Cada interaccion registra y muestra en la UI:"));
children.push(bullet("Modelo utilizado"));
children.push(bullet("Tokens de entrada y salida"));
children.push(bullet("Tiempo de respuesta AI (ms)"));
children.push(bullet("Latencia total (AI + SSH + ejecucion)"));
children.push(bullet("Costo estimado en USD"));
children.push(bullet("Errores de API si los hay"));

children.push(heading2("7.4 Tool Use: execute_command"));
children.push(para("Claude tiene acceso a la herramienta execute_command que le permite ejecutar comandos SSH en el servidor conectado. El flujo es:"));
children.push(numberItem("Usuario envia instruccion en espanol", "ai-numbers"));
children.push(numberItem("Claude interpreta la intencion y decide si necesita ejecutar comandos", "ai-numbers"));
children.push(numberItem("Si usa execute_command, el backend ejecuta el comando via SSH", "ai-numbers"));
children.push(numberItem("El resultado se devuelve a Claude para que explique", "ai-numbers"));
children.push(numberItem("Claude puede ejecutar multiples comandos en secuencia", "ai-numbers"));
children.push(numberItem("La respuesta final incluye: texto, commandResults, executions, metrics", "ai-numbers"));

// ===================== 8. PLAYBOOKS =====================
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(heading1("8. Playbooks - Procedimientos Operativos"));
children.push(para("Los playbooks son secuencias de comandos reutilizables con metadata operativa. El sistema incluye 8 playbooks integrados y permite crear personalizados."));

children.push(heading2("8.1 Playbooks Integrados"));
children.push(makeTable(
  ["Playbook", "Categoria", "Comandos", "Objetivo"],
  [
    ["Health Check General", "monitoring", "6", "CPU, RAM, disco, uptime, servicios fallidos"],
    ["Verificar Actualizaciones", "maintenance", "3", "Detectar gestor, actualizar cache, listar pendientes"],
    ["Aplicar Actualizaciones", "maintenance", "2", "Upgrade completo + verificar reinicio"],
    ["Limpieza de Logs", "maintenance", "4", "Logrotate, journalctl vacuum, medir espacio"],
    ["Diagnostico de Consumo", "diagnostic", "4", "Top CPU/RAM/disco, iostat"],
    ["Revision de Seguridad Basica", "security", "5", "Usuarios, accesos, puertos, firewall, SSH"],
    ["Validar Conectividad", "diagnostic", "4", "DNS, ping, interfaces, rutas"],
    ["Recolectar Info Sistema", "monitoring", "6", "OS, kernel, hostname, CPU, RAM, disco"],
  ],
  [2800, 1600, 1200, 3760]
));

children.push(heading2("8.2 Modelo de Playbook"));
children.push(para("Cada playbook soporta:"));
children.push(bullet("Nombre, descripcion, objetivo"));
children.push(bullet("Sistemas compatibles (linux/windows)"));
children.push(bullet("Precondiciones y validaciones previas"));
children.push(bullet("Variables requeridas con sustitucion {{variable}}"));
children.push(bullet("Secuencia de comandos con nombre por paso"));
children.push(bullet("Criterios de exito"));
children.push(bullet("Comandos de rollback"));
children.push(bullet("Manejo de errores"));
children.push(bullet("Permisos requeridos"));

// ===================== 9. SCHEDULER =====================
children.push(heading1("9. Scheduler - Automatizacion Programada"));
children.push(para("Motor de ejecucion periodica basado en expresiones cron de 5 campos. Verifica cada 60 segundos las tareas habilitadas y ejecuta las que coinciden."));

children.push(heading2("9.1 Capacidades"));
children.push(bullet("Expresion cron de 5 campos (minuto, hora, dia-del-mes, mes, dia-de-semana)"));
children.push(bullet("Soporte: *, */n, rangos (1-5), listas (1,3,5)"));
children.push(bullet("Ejecucion por servidor individual o por grupo"));
children.push(bullet("Tipo de tarea: comando directo o playbook"));
children.push(bullet("Ventanas horarias (time_window_start/end)"));
children.push(bullet("Politica de reintentos configurable (count + delay)"));
children.push(bullet("Timeout configurable por tarea (default 60s)"));
children.push(bullet("Habilitar/deshabilitar sin eliminar"));
children.push(bullet("Ejecucion manual inmediata (run-now)"));
children.push(bullet("Historial completo por corrida"));

children.push(heading2("9.2 Plantillas Predefinidas"));
children.push(makeTable(
  ["Plantilla", "Cron", "Frecuencia", "Tipo"],
  [
    ["Disponibilidad horaria", "0 * * * *", "Cada hora", "Comando: uptime"],
    ["Updates diarios", "0 6 * * *", "6am diario", "Playbook: Verificar Actualizaciones"],
    ["Mantenimiento nocturno", "0 2 * * *", "2am diario", "Playbook: Limpieza de Logs"],
    ["Health check semanal", "0 9 * * 1", "Lunes 9am", "Playbook: Health Check General"],
    ["Seguridad semanal", "0 10 * * 5", "Viernes 10am", "Playbook: Seguridad Basica"],
  ],
  [2800, 1600, 1800, 3160]
));

// ===================== 10. UPDATES =====================
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(heading1("10. Gestion de Actualizaciones"));
children.push(para("Modulo dedicado para detectar, clasificar y aplicar actualizaciones del sistema operativo. Soporta multiples gestores de paquetes."));

children.push(heading2("10.1 Sistemas Soportados"));
children.push(makeTable(
  ["Familia OS", "Gestor", "Deteccion"],
  [
    ["Debian / Ubuntu", "apt", "apt list --upgradable"],
    ["RHEL / CentOS", "yum / dnf", "yum check-update / dnf check-update"],
    ["Fedora", "dnf", "dnf check-update"],
    ["SUSE / SLES", "zypper", "zypper list-updates"],
    ["Arch", "pacman", "pacman -Qu"],
  ],
  [3000, 2360, 4000]
));

children.push(heading2("10.2 Clasificacion de Severidad"));
children.push(makeTable(
  ["Severidad", "Criterio", "Color"],
  [
    [{ text: "critical", color: COLORS.red }, "security, CVE en el nombre", "Rojo"],
    [{ text: "important", color: COLORS.amber }, "kernel, linux-image, glibc, openssl, openssh", "Ambar"],
    [{ text: "moderate", color: COLORS.blue }, "lib, devel, headers", "Azul"],
    ["low", "Todo lo demas", "Gris"],
  ],
  [2000, 5360, 2000]
));

children.push(heading2("10.3 Flujo Operativo"));
children.push(numberItem("Detectar familia de OS y gestor de paquetes automaticamente", "upd-numbers"));
children.push(numberItem("Consultar paquetes pendientes sin aplicar cambios", "upd-numbers"));
children.push(numberItem("Clasificar por severidad y marcar si requieren reinicio", "upd-numbers"));
children.push(numberItem("Mostrar resumen: cantidad, criticos, tipo, accion recomendada", "upd-numbers"));
children.push(numberItem("Aplicar selectivamente o todas (timeout 5 minutos)", "upd-numbers"));
children.push(numberItem("Verificar si se requiere reinicio post-actualizacion", "upd-numbers"));
children.push(numberItem("Registrar resultado en historial", "upd-numbers"));

// ===================== 11. UI =====================
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(heading1("11. Interfaz de Usuario"));
children.push(para("Tema oscuro estilo terminal con fuentes monoespaciadas, acentos en verde neon (#00ff41) y ambar (#ffb800). 13 componentes React sin librerias UI externas."));

children.push(heading2("11.1 Componentes"));
children.push(makeTable(
  ["Componente", "Funcion"],
  [
    ["App", "Shell principal, estado global, coordinacion de modales"],
    ["Sidebar", "Lista de servidores, busqueda, filtros, env badges, favoritos, acciones"],
    ["SplitView", "Panel dividido resizable (chat izquierda + consola derecha)"],
    ["Terminal", "Chat conversacional, selector de modelo, metricas, markdown"],
    ["ExecutionPanel", "Consola de ejecucion en vivo con exit codes, timing, stdout/stderr"],
    ["ConnectionForm", "Formulario enriquecido: 12 campos, tags, entorno, deteccion duplicados"],
    ["Settings", "API key, clave maestra, Keychain, cifrado masivo"],
    ["GroupManager", "CRUD de grupos, colores, asignacion de servidores"],
    ["AuditLog", "Visor de auditoria con stats, filtros, detalle expandible, export CSV"],
    ["ModelSelector", "Dropdown de modelos AI, modo compacto y completo"],
    ["SearchFilter", "Barra de busqueda + filtros dropdown (entorno, estado, favoritos)"],
    ["ServerStatus", "Dot indicador con 7 estados visuales"],
  ],
  [2500, 6860]
));

children.push(heading2("11.2 Estados de Conexion (7)"));
children.push(makeTable(
  ["Estado", "Tipo", "Visual"],
  [
    ["connected", "Runtime", "Verde brillante con glow"],
    ["connecting", "Runtime", "Ambar pulsante (animacion)"],
    ["error", "Runtime", "Rojo"],
    ["disconnected", "Runtime", "Gris"],
    ["ok", "Persistente", "Verde"],
    ["warning", "Persistente", "Ambar"],
    ["unreachable", "Persistente", "Rojo con pulso"],
    ["invalid_credentials", "Persistente", "Rojo con candado"],
    ["pending_review", "Persistente", "Gris tenue"],
  ],
  [2800, 2000, 4560]
));

// ===================== 12. OBSERVABILITY =====================
children.push(heading1("12. Observabilidad"));
children.push(para("El panel de ejecucion (ExecutionPanel) muestra en tiempo real cada comando ejecutado con detalle tecnico completo:"));
children.push(makeTable(
  ["Dato", "Descripcion"],
  [
    ["Comando", "Texto exacto ejecutado (monoespaciado)"],
    ["Exit Code", "Codigo de salida (0 = verde, otro = rojo)"],
    ["Tiempo de conexion", "Milisegundos para establecer/reutilizar SSH"],
    ["Tiempo de ejecucion", "Milisegundos del comando"],
    ["stdout", "Salida estandar completa (expandible)"],
    ["stderr", "Salida de error (resaltada en rojo)"],
    ["Truncamiento", "Flag si la salida excedio 100KB"],
    ["Timeout", "Flag si el comando excedio el limite"],
    ["Destructivo", "Badge si el comando es potencialmente peligroso"],
    ["Timestamp inicio/fin", "ISO 8601 de inicio y completado"],
  ],
  [3000, 6360]
));

// ===================== 13. AUDIT =====================
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(heading1("13. Auditoria y Trazabilidad"));
children.push(para("Cada interaccion con el agente genera un registro de auditoria consolidado que captura el ciclo completo de la operacion."));

children.push(heading2("13.1 Datos Auditados"));
children.push(bullet("Servidor y nombre de conexion"));
children.push(bullet("Timestamp"));
children.push(bullet("Prompt original del usuario"));
children.push(bullet("Comandos generados (JSON array)"));
children.push(bullet("Salida completa (truncada a 500 chars por comando)"));
children.push(bullet("Duracion total en milisegundos"));
children.push(bullet("Estado final: success | partial_failure | error"));
children.push(bullet("Modelo AI utilizado"));
children.push(bullet("Tipo de tarea (auto-detectado)"));
children.push(bullet("Errores si los hubo"));

children.push(heading2("13.2 Clasificacion Automatica de Tareas"));
children.push(makeTable(
  ["Tipo", "Patrones Detectados"],
  [
    ["maintenance", "actualiz, update, upgrade, patch, parche, reinici, restart, reboot, servicio"],
    ["diagnostic", "diagnos, problema, error, log, revisar, debug"],
    ["deployment", "deploy, desplieg, instalar, install"],
    ["configuration", "config, ajust, modific, cambiar, set"],
    ["monitoring", "monitor, estado, salud, health, cpu, ram, disco, memoria, uptime"],
    ["security", "segur, security, firewall, permiso, access, acceso"],
    ["other", "Cuando no coincide ningun patron"],
  ],
  [2000, 7360]
));

children.push(heading2("13.3 Estadisticas Disponibles"));
children.push(bullet("Total de operaciones"));
children.push(bullet("Tasa de exito (%)"));
children.push(bullet("Duracion promedio"));
children.push(bullet("Uso por modelo AI"));
children.push(bullet("Distribucion por tipo de tarea"));
children.push(bullet("Operaciones por dia (ultimos 30 dias)"));
children.push(bullet("Exportacion CSV con filtros"));

// ===================== 14. LIMITS =====================
children.push(heading1("14. Limites y Restricciones Tecnicas"));
children.push(makeTable(
  ["Parametro", "Valor"],
  [
    ["Request body maximo", "10 MB"],
    ["Salida de comando maxima", "100 KB (truncada con flag)"],
    ["Almacenamiento de output en DB", "50 KB por campo"],
    ["Timeout de conexion SSH", "10 segundos"],
    ["Timeout de comando (default)", "30 segundos (configurable)"],
    ["Timeout de actualizaciones", "300 segundos (5 minutos)"],
    ["Intervalo del scheduler", "60 segundos"],
    ["Iteraciones PBKDF2", "600,000"],
    ["Max tokens por respuesta AI", "4,096"],
    ["Polling de estados", "15 segundos"],
  ],
  [4000, 5360]
));

// ===================== 15. EXECUTION =====================
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(heading1("15. Guia de Ejecucion"));
children.push(heading2("15.1 Requisitos"));
children.push(bullet("Node.js v22+ instalado"));
children.push(bullet("macOS (para Keychain; funcional en Linux sin esa caracteristica)"));
children.push(bullet("Acceso SSH a servidores destino"));
children.push(bullet("API key de Anthropic"));

children.push(heading2("15.2 Inicio"));
children.push(new Paragraph({
  spacing: { after: 200 },
  children: [new TextRun({ text:
`# Terminal 1 - Backend (puerto 3001)
cd server && node index.js

# Terminal 2 - Frontend (puerto 5173)
cd client && npm run dev

# Abrir navegador en http://localhost:5173`, font: "Courier New", size: 18, color: COLORS.text })],
}));

children.push(heading2("15.3 Primer Uso"));
children.push(numberItem("Configurar API key de Anthropic en Settings", "start-numbers"));
children.push(numberItem("(Opcional) Configurar clave maestra para cifrado", "start-numbers"));
children.push(numberItem("Agregar servidor con nombre, host, puerto, usuario, password/key", "start-numbers"));
children.push(numberItem("Hacer clic en el boton play verde para conectar", "start-numbers"));
children.push(numberItem("Verificar dot verde y banner 'Conectado' en el header", "start-numbers"));
children.push(numberItem("Escribir instrucciones en espanol en el chat", "start-numbers"));
children.push(numberItem("Observar comandos y resultados en el panel de ejecucion", "start-numbers"));

// FINAL
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(emptyPara());
children.push(emptyPara());
children.push(emptyPara());
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 100 },
  children: [new TextRun({ text: "KODO", font: "Courier New", size: 72, bold: true, color: COLORS.accent })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 200 },
  children: [new TextRun({ text: "Infrastructure Agent", font: "Arial", size: 24, color: COLORS.textLight, characterSpacing: 200 })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  border: { top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.accent, space: 16 } },
  children: [new TextRun({ text: "48 archivos  |  ~6,700 LOC  |  12+ tablas  |  40+ endpoints  |  8 playbooks  |  10 migraciones", font: "Courier New", size: 16, color: COLORS.textLight })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 200 },
  children: [new TextRun({ text: "Construido con Node.js, React, SQLite, Claude AI y SSH", font: "Arial", size: 20, color: COLORS.textLight })],
}));


// ============ ASSEMBLE DOCUMENT ============
const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 20 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial" }, paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial" }, paragraph: { spacing: { before: 300, after: 150 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial" }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "sec-numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "ai-numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "upd-numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "start-numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: PAGE_WIDTH, height: 15840 },
        margin: MARGINS,
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({ text: "KODO ", font: "Courier New", size: 16, bold: true, color: COLORS.accent }),
            new TextRun({ text: "Infrastructure Agent  |  Documento Tecnico", font: "Arial", size: 14, color: COLORS.textLight }),
          ],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Pagina ", font: "Arial", size: 16, color: COLORS.textLight }),
            new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: COLORS.textLight }),
          ],
        })],
      }),
    },
    children,
  }],
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("/Users/ricardo.nava/Projects/SuSSH/Kodo_Infrastructure_Agent_Documento_Tecnico.docx", buffer);
  console.log("Document generated successfully!");
});

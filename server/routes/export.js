import { Router } from 'express';
import db from '../db.js';

const router = Router();

// ======================== RICH DASHBOARD HTML TEMPLATE ========================
const DASHBOARD_TEMPLATE = (title, body, serverInfo = {}) => `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0a0e14;--bg2:#0d1117;--bg3:#161b22;--bg4:#1c2333;--border:#21262d;--text:#e6edf3;--text2:#c9d1d9;--text3:#8b949e;--green:#00ff41;--green-dim:#0d3321;--red:#ff4444;--red-dim:#3d1111;--amber:#ffb800;--amber-dim:#3d2e00;--blue:#58a6ff;--blue-dim:#0d2744;--purple:#d2a8ff;--brand:#ff3b3b}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);min-height:100vh}
.report{max-width:1000px;margin:0 auto;padding:24px}

/* Header */
.report-header{background:linear-gradient(135deg,var(--bg2) 0%,var(--bg3) 100%);border:1px solid var(--border);border-radius:16px;padding:32px;margin-bottom:24px;position:relative;overflow:hidden}
.report-header::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,var(--brand),var(--green),var(--blue))}
.report-brand{display:flex;align-items:center;gap:12px;margin-bottom:16px}
.report-brand .logo{font-family:'JetBrains Mono',monospace;font-size:28px;font-weight:700;color:var(--brand)}
.report-brand .divider{width:2px;height:28px;background:var(--border)}
.report-brand .server-name{font-size:22px;font-weight:600;color:var(--text)}
.report-title{font-size:16px;color:var(--text2);margin-bottom:12px}
.report-meta{display:flex;gap:16px;flex-wrap:wrap}
.report-meta .meta-item{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text3);background:var(--bg);padding:4px 10px;border-radius:6px;border:1px solid var(--border)}

/* Status Cards Row */
.status-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:24px}
.status-card{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:16px;position:relative;overflow:hidden}
.status-card::before{content:'';position:absolute;top:0;left:0;width:4px;height:100%}
.status-card.ok::before{background:var(--green)}
.status-card.warning::before{background:var(--amber)}
.status-card.critical::before{background:var(--red)}
.status-card.info::before{background:var(--blue)}
.status-card .card-label{font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
.status-card .card-value{font-family:'JetBrains Mono',monospace;font-size:24px;font-weight:700}
.status-card.ok .card-value{color:var(--green)}
.status-card.warning .card-value{color:var(--amber)}
.status-card.critical .card-value{color:var(--red)}
.status-card.info .card-value{color:var(--blue)}
.status-card .card-detail{font-size:11px;color:var(--text3);margin-top:2px}

/* Gauge */
.gauge-container{display:flex;justify-content:center;margin:20px 0}
.gauge{width:200px;height:120px;position:relative}
.gauge-bg{fill:none;stroke:var(--bg3);stroke-width:12}
.gauge-fill{fill:none;stroke-width:12;stroke-linecap:round;transition:stroke-dashoffset 1s}
.gauge-value{font-family:'JetBrains Mono',monospace;font-size:36px;font-weight:700;fill:var(--text)}
.gauge-label{font-size:12px;fill:var(--text3)}

/* Progress Bar */
.progress-bar{background:var(--bg);border-radius:8px;height:8px;margin:6px 0;overflow:hidden}
.progress-fill{height:100%;border-radius:8px;transition:width 0.5s}
.progress-fill.green{background:linear-gradient(90deg,#00cc33,#00ff41)}
.progress-fill.amber{background:linear-gradient(90deg,#cc8800,#ffb800)}
.progress-fill.red{background:linear-gradient(90deg,#cc3333,#ff4444)}
.progress-fill.blue{background:linear-gradient(90deg,#3366cc,#58a6ff)}

/* Section */
.section{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:16px}
.section-header{display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border)}
.section-icon{font-size:20px}
.section-title{font-size:16px;font-weight:600;color:var(--text)}
.section-badge{font-family:'JetBrains Mono',monospace;font-size:10px;padding:2px 8px;border-radius:10px;margin-left:auto}

/* Table */
table{width:100%;border-collapse:separate;border-spacing:0;border-radius:8px;overflow:hidden;margin:8px 0}
th{background:var(--bg3);color:var(--green);font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;padding:10px 14px;text-align:left;border-bottom:2px solid var(--border)}
td{padding:8px 14px;font-size:13px;border-bottom:1px solid var(--border);color:var(--text2)}
tr:last-child td{border-bottom:none}
tr:hover td{background:var(--bg4)}
td code{font-family:'JetBrains Mono',monospace;font-size:11px;background:var(--bg);padding:2px 6px;border-radius:4px}

/* Status indicators */
.st{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:500}
.st::before{content:'';width:8px;height:8px;border-radius:50%}
.st-ok::before{background:var(--green);box-shadow:0 0 6px var(--green)}
.st-warn::before{background:var(--amber);box-shadow:0 0 6px var(--amber)}
.st-crit::before{background:var(--red);box-shadow:0 0 6px var(--red)}
.st-ok{color:var(--green)}.st-warn{color:var(--amber)}.st-crit{color:var(--red)}

/* Priority badges */
.pri{display:inline-block;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px}
.pri-high{background:var(--red-dim);color:var(--red)}
.pri-med{background:var(--amber-dim);color:var(--amber)}
.pri-low{background:var(--blue-dim);color:var(--blue)}

/* Lists */
ul,ol{padding-left:20px;margin:6px 0}
li{margin:4px 0;font-size:13px;color:var(--text2);line-height:1.6}
li strong{color:var(--text)}

/* Text */
h1{font-size:20px;color:var(--text);margin-bottom:12px}
h2{font-size:16px;color:var(--green);margin:16px 0 8px;display:flex;align-items:center;gap:8px}
h3{font-size:14px;color:var(--blue);margin:12px 0 6px}
p{font-size:13px;line-height:1.7;color:var(--text2);margin:4px 0}
hr{border:none;border-top:1px solid var(--border);margin:16px 0}
pre{background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px;font-family:'JetBrains Mono',monospace;font-size:11px;overflow-x:auto;margin:8px 0}
code{font-family:'JetBrains Mono',monospace;font-size:11px;background:var(--bg);padding:1px 5px;border-radius:3px}
strong{color:var(--text)}
blockquote{border-left:3px solid var(--green);padding-left:12px;margin:8px 0;color:var(--text3);font-style:italic}

/* Footer */
.report-footer{text-align:center;padding:24px;margin-top:24px;border-top:1px solid var(--border)}
.report-footer .footer-brand{font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;color:var(--brand);margin-bottom:4px}
.report-footer .footer-meta{font-size:11px;color:var(--text3);font-family:'JetBrains Mono',monospace}

/* Print styles */
@media print{body{background:#fff;color:#222}
.report-header{background:#f5f5f5;border-color:#ddd}
.report-header::before{background:linear-gradient(90deg,#cc0000,#00aa33,#3366cc)}
.section{background:#fafafa;border-color:#ddd}
table{border:1px solid #ddd}th{background:#eee;color:#333}td{color:#333;border-color:#ddd}
.status-card{background:#fafafa;border-color:#ddd}
.st-ok{color:#00aa33}.st-warn{color:#cc8800}.st-crit{color:#cc0000}
.progress-bar{background:#eee}}
</style></head><body>
<div class="report">

<div class="report-header">
  <div class="report-brand">
    <span class="logo">Kōdo</span>
    <span class="divider"></span>
    <span class="server-name">${serverInfo.name || 'Servidor'}</span>
  </div>
  <div class="report-title">${title}</div>
  <div class="report-meta">
    ${serverInfo.os ? `<span class="meta-item">${serverInfo.os}</span>` : ''}
    ${serverInfo.host ? `<span class="meta-item">${serverInfo.host}</span>` : ''}
    <span class="meta-item">${new Date().toLocaleString()}</span>
    ${serverInfo.model ? `<span class="meta-item">Modelo: ${serverInfo.model}</span>` : ''}
  </div>
</div>

${body}

<div class="report-footer">
  <div class="footer-brand">Kōdo Infrastructure Agent</div>
  <div class="footer-meta">Reporte generado automaticamente — ${new Date().toISOString()}</div>
</div>
</div></body></html>`;

// Simple template for basic exports
const SIMPLE_TEMPLATE = (title, body) => `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>${title}</title>
<style>
body{font-family:-apple-system,sans-serif;max-width:900px;margin:40px auto;padding:0 20px;background:#0d1117;color:#e6edf3}
h1,h2{color:#00ff41}h3{color:#58a6ff}
table{border-collapse:collapse;width:100%;margin:12px 0}
th{background:#161b22;color:#00ff41;text-align:left;padding:8px 12px;border:1px solid #21262d;font-size:13px}
td{padding:6px 12px;border:1px solid #21262d;font-size:13px}
pre{background:#0a0e14;border:1px solid #21262d;border-radius:6px;padding:12px;font-size:12px}
code{font-family:monospace}hr{border:none;border-top:1px solid #21262d;margin:20px 0}
.meta{color:#8b949e;font-size:12px}
</style></head><body>${body}</body></html>`;

// ======================== MARKDOWN TO RICH HTML CONVERTER ========================
function markdownToRichHtml(md) {
  let html = md;

  // Status indicators: ✅ → green dot, ⚠️ → amber, ❌ → red
  html = html.replace(/✅\s*(OK|Instalado|Activo|Habilitado|Correcto|ok)/gi, '<span class="st st-ok">$1</span>');
  html = html.replace(/✅/g, '<span class="st st-ok">OK</span>');
  html = html.replace(/⚠️\s*(\S[^<\n]*)/g, '<span class="st st-warn">$1</span>');
  html = html.replace(/❌\s*(\S[^<\n]*)/g, '<span class="st st-crit">$1</span>');

  // Priority badges
  html = html.replace(/🔴\s*(Crítica?|ALTA|Alta|HIGH)/gi, '<span class="pri pri-high">$1</span>');
  html = html.replace(/🟠\s*(Importante|MEDIA|Media|MEDIUM)/gi, '<span class="pri pri-med">$1</span>');
  html = html.replace(/🟡\s*(Estándar|BAJA|Baja|LOW)/gi, '<span class="pri pri-low">$1</span>');

  // Tables (must process BEFORE line-by-line replacements)
  html = html.replace(/\|(.+)\|\s*\n\|[-|\s:]+\|\s*\n((?:\|.+\|\s*\n?)+)/g, (match, headerLine, bodyLines) => {
    const headers = headerLine.split('|').filter(Boolean).map((h) => `<th>${h.trim()}</th>`).join('');
    const rows = bodyLines.trim().split('\n').filter((l) => l.includes('|')).map((line) => {
      const cells = line.split('|').filter(Boolean).map((c) => `<td>${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
  });

  // Code blocks
  html = html.replace(/```[\w]*\n([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

  // Headers with section wrapping
  html = html.replace(/^## (.*)/gm, (m, content) => {
    const emoji = content.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/u)?.[0] || '';
    const text = content.replace(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)\s*/u, '');
    return `</div><div class="section"><div class="section-header"><span class="section-icon">${emoji}</span><span class="section-title">${text}</span></div>`;
  });
  html = html.replace(/^### (.*)/gm, '<h3>$1</h3>');

  // Inline formatting
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/`(.*?)`/g, '<code>$1</code>');

  // Lists
  html = html.replace(/^- (.*)/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr>');

  // Line breaks (but not inside pre/table)
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');

  // Clean up
  html = html.replace(/<\/div><div class="section">/g, '</div>\n<div class="section">'); // fix first section
  html = '<div class="section">' + html + '</div>';
  html = html.replace(/<div class="section"><\/div>/g, ''); // remove empty sections

  return html;
}

// ======================== ROUTES ========================

// Export session report
router.get('/session/:sessionId', (req, res) => {
  const { format = 'html' } = req.query;
  const session = db.prepare('SELECT * FROM work_sessions WHERE id = ?').get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Sesion no encontrada' });

  const conn = db.prepare('SELECT name, host FROM connections WHERE id = ?').get(session.connection_id);
  const messages = db.prepare('SELECT role, content, model_used, input_tokens, output_tokens, created_at FROM chat_history WHERE session_id = ? ORDER BY created_at ASC').all(session.id);
  const executions = db.prepare('SELECT command, exit_code, execution_time_ms, started_at FROM execution_log WHERE session_id = ? ORDER BY started_at ASC').all(session.id);

  const title = `Reporte de Sesion - ${conn?.name || 'Servidor'}`;

  if (format === 'md' || format === 'txt') {
    let md = `# ${title}\n\n**Servidor:** ${conn?.name} (${conn?.host})\n**Inicio:** ${session.started_at}\n**Fin:** ${session.ended_at || 'Activa'}\n**Comandos:** ${session.commands_count}\n\n---\n\n`;
    for (const m of messages) md += `### ${m.role === 'user' ? 'Usuario' : 'Kōdo'} (${m.created_at})\n${m.content}\n\n`;
    res.type(format === 'md' ? 'text/markdown' : 'text/plain').send(md);
  } else {
    let body = `<div class="status-cards">
      <div class="status-card ok"><div class="card-label">Comandos</div><div class="card-value">${session.commands_count || 0}</div></div>
      <div class="status-card ok"><div class="card-label">Exitosos</div><div class="card-value">${session.successful_count || 0}</div></div>
      <div class="status-card ${session.failed_count > 0 ? 'warning' : 'ok'}"><div class="card-label">Fallidos</div><div class="card-value">${session.failed_count || 0}</div></div>
      <div class="status-card info"><div class="card-label">Duracion</div><div class="card-value">${Math.round((session.total_duration_ms || 0) / 60000)}m</div></div>
    </div>`;
    for (const m of messages) {
      const icon = m.role === 'user' ? '👤' : '🤖';
      body += `<div class="section"><div class="section-header"><span class="section-icon">${icon}</span><span class="section-title">${m.role === 'user' ? 'Usuario' : 'Kōdo'}</span><span class="meta-item" style="margin-left:auto">${m.created_at}</span></div><p>${m.content.replace(/\n/g, '<br>')}</p></div>`;
    }
    res.type('text/html').send(DASHBOARD_TEMPLATE(title, body, { name: conn?.name, host: conn?.host }));
  }
});

// Export server profile
router.get('/profile/:connectionId', (req, res) => {
  const { format = 'html' } = req.query;
  const conn = db.prepare('SELECT name, host, os_type FROM connections WHERE id = ?').get(req.params.connectionId);
  const profile = db.prepare('SELECT * FROM server_profiles WHERE connection_id = ?').get(req.params.connectionId);
  if (!conn || !profile) return res.status(404).json({ error: 'Profile no encontrado' });

  const services = JSON.parse(profile.installed_services || '[]');
  const ports = JSON.parse(profile.open_ports || '[]');
  const title = `Server Profile - ${conn.name}`;
  const memPct = profile.total_memory_mb ? Math.min(100, Math.round((profile.total_memory_mb / (profile.total_memory_mb * 1.2)) * 100)) : 0;

  if (format !== 'html') {
    let md = `# ${title}\n\n## Sistema\n- OS: ${profile.os_version}\n- Kernel: ${profile.kernel_version}\n- Arch: ${profile.arch}\n- CPU: ${profile.cpu_info}\n- RAM: ${profile.total_memory_mb} MB\n- Disco: ${Math.round(profile.total_disk_mb / 1024)} GB\n`;
    res.type(format === 'md' ? 'text/markdown' : 'text/plain').send(md);
  } else {
    let body = `<div class="status-cards">
      <div class="status-card info"><div class="card-label">CPU</div><div class="card-value">${profile.cpu_info?.match(/\d+/)?.[0] || '?'}</div><div class="card-detail">${profile.cpu_info || 'N/A'}</div></div>
      <div class="status-card ok"><div class="card-label">RAM</div><div class="card-value">${profile.total_memory_mb ? Math.round(profile.total_memory_mb / 1024) + 'G' : '?'}</div><div class="card-detail">${profile.total_memory_mb} MB total</div></div>
      <div class="status-card ok"><div class="card-label">Disco</div><div class="card-value">${profile.total_disk_mb ? Math.round(profile.total_disk_mb / 1024) + 'G' : '?'}</div><div class="card-detail">${profile.total_disk_mb} MB total</div></div>
      <div class="status-card ${profile.security_score > 70 ? 'ok' : profile.security_score > 40 ? 'warning' : 'critical'}"><div class="card-label">Seguridad</div><div class="card-value">${profile.security_score ?? '—'}</div><div class="card-detail">de 100 puntos</div></div>
    </div>`;
    body += `<div class="section"><div class="section-header"><span class="section-icon">🖥️</span><span class="section-title">Sistema Operativo</span></div>
      <table><tr><th>Campo</th><th>Valor</th></tr>
      <tr><td>OS</td><td><strong>${profile.os_version || profile.distro}</strong></td></tr>
      <tr><td>Kernel</td><td>${profile.kernel_version || 'N/A'}</td></tr>
      <tr><td>Arquitectura</td><td>${profile.arch || 'N/A'}</td></tr>
      <tr><td>Package Manager</td><td>${profile.package_manager || 'N/A'}</td></tr>
      <tr><td>Init System</td><td>${profile.init_system || 'N/A'}</td></tr>
      ${profile.role ? `<tr><td>Rol</td><td><strong>${profile.role}</strong></td></tr>` : ''}
      </table></div>`;
    if (services.length) body += `<div class="section"><div class="section-header"><span class="section-icon">⚙️</span><span class="section-title">Servicios Activos</span><span class="section-badge" style="background:var(--green-dim);color:var(--green)">${services.length}</span></div><pre>${services.join('\n')}</pre></div>`;
    if (ports.length) body += `<div class="section"><div class="section-header"><span class="section-icon">📡</span><span class="section-title">Puertos Abiertos</span><span class="section-badge" style="background:var(--blue-dim);color:var(--blue)">${ports.length}</span></div><pre>${ports.join('\n')}</pre></div>`;
    res.type('text/html').send(DASHBOARD_TEMPLATE(title, body, { name: conn.name, host: conn.host, os: profile.os_version }));
  }
});

// Export single message
router.post('/message', (req, res) => {
  const { content, metrics, serverName, format = 'html' } = req.body;
  const title = `Reporte - ${serverName || 'Servidor'}`;
  const clean = (content || '').replace(/\[ACTION:\s*.+?\]\s*/g, '');

  if (format === 'md') {
    let md = `# ${title}\n\n${clean}\n`;
    if (metrics) md += `\n---\n**Modelo:** ${metrics.model} | **Tokens:** ${metrics.inputTokens}↑ ${metrics.outputTokens}↓ | **Costo:** $${metrics.estimatedCost}\n`;
    res.type('text/markdown').send(md);
  } else if (format === 'txt') {
    res.type('text/plain').send(`${title}\n\n${clean}\n`);
  } else {
    const body = markdownToRichHtml(clean);
    res.type('text/html').send(DASHBOARD_TEMPLATE(title, body, { name: serverName, model: metrics?.model }));
  }
});

// ======================== ENHANCED EXPORT WITH AI ========================
router.post('/enhanced', async (req, res) => {
  const { content, metrics, serverName, connectionId, format = 'html' } = req.body;
  if (!content) return res.status(400).json({ error: 'content requerido' });

  const apiKey = db.prepare('SELECT value FROM settings WHERE key = ?').get('anthropic_api_key')?.value;
  if (!apiKey) return res.status(400).json({ error: 'API key no configurada' });

  let profileContext = '';
  let serverInfo = { name: serverName, model: metrics?.model };
  if (connectionId) {
    const profile = db.prepare('SELECT * FROM server_profiles WHERE connection_id = ?').get(connectionId);
    const conn = db.prepare('SELECT host FROM connections WHERE id = ?').get(connectionId);
    if (profile) {
      profileContext = `\nServidor: ${serverName}\nHost: ${conn?.host}\nOS: ${profile.os_version || profile.distro}\nArch: ${profile.arch}\nCPU: ${profile.cpu_info}\nRAM: ${profile.total_memory_mb} MB\nDisco: ${Math.round(profile.total_disk_mb / 1024)} GB\nPackage Manager: ${profile.package_manager}\nSeguridad: ${profile.security_score ?? 'sin evaluar'}/100`;
      serverInfo.os = profile.os_version || profile.distro;
      serverInfo.host = conn?.host;
    }
  }

  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey });

  const enhancePrompt = `Eres un experto en documentacion tecnica de infraestructura. Transforma este reporte en un documento EJECUTIVO PROFESIONAL.

REGLAS CRITICAS:
1. Empieza con un RESUMEN EJECUTIVO de 3-4 lineas con el veredicto general
2. Usa ## con emojis para secciones: 📊 Estado General, 🔍 Analisis Detallado, etc.
3. SIEMPRE usa tablas markdown para datos tabulares (| col1 | col2 |)
4. Agrega indicadores de estado: ✅ para OK, ⚠️ para atencion, ❌ para critico
5. Para prioridades usa: 🔴 Alta, 🟠 Media, 🟡 Baja
6. Agrega seccion "📋 OBSERVACIONES" con analisis tecnico experto (fortalezas y puntos de atencion)
7. Agrega seccion "🎯 RECOMENDACIONES" con tabla de acciones priorizadas
8. Termina con seccion "📌 SINTESIS" de 2 lineas con veredicto final
9. NO inventes datos - solo reinterpreta y enriquece lo existente
10. Responde en espanol

CONTEXTO DEL SERVIDOR:${profileContext || '\nNo disponible'}

CONTENIDO ORIGINAL:
${content.substring(0, 8000)}`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: enhancePrompt }],
    });

    let enhanced = response.content[0]?.text || content;
    enhanced = enhanced.replace(/\[ACTION:\s*.+?\]\s*/g, '');

    const title = `Reporte Ejecutivo - ${serverName || 'Servidor'}`;

    if (format === 'md') {
      res.type('text/markdown').send(`# ${title}\n\n${enhanced}`);
    } else {
      const htmlBody = markdownToRichHtml(enhanced);

      // Add metrics card at top if available
      let metricsCards = '';
      if (metrics) {
        metricsCards = `<div class="status-cards">
          <div class="status-card info"><div class="card-label">Modelo</div><div class="card-value" style="font-size:14px">${metrics.model?.split('-').slice(1, 3).join(' ') || '?'}</div></div>
          <div class="status-card ok"><div class="card-label">Tokens</div><div class="card-value" style="font-size:14px">${metrics.inputTokens}↑ ${metrics.outputTokens}↓</div></div>
          <div class="status-card info"><div class="card-label">Tiempo</div><div class="card-value">${(metrics.totalLatencyMs / 1000).toFixed(1)}s</div></div>
          <div class="status-card ${parseFloat(metrics.estimatedCost) > 0.1 ? 'warning' : 'ok'}"><div class="card-label">Costo</div><div class="card-value">$${metrics.estimatedCost}</div></div>
        </div>`;
      }

      res.type('text/html').send(DASHBOARD_TEMPLATE(title, metricsCards + htmlBody, serverInfo));
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

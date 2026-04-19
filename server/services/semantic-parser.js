import { randomUUID } from 'crypto';

// ======================== DETECTION PATTERNS ========================

const METRIC_PATTERN = /(?:^|\|)\s*\*?\*?(\w[\w\s/]*?)\*?\*?\s*[:|\s]\s*(\d+[\d.,]*)\s*(%)|(GB|MB|KB|TB|ms|s|MHz|GHz|MB\/s|KB\/s|cores?|CPUs?)\b/i;
const METRIC_LABELS = /\b(cpu|ram|memoria|memory|disco|disk|swap|load|carga|uptime|latencia|uso|usage|free|available|used|total|average|avg|max|min)\b/i;
const QUESTION_PATTERNS = [
  /\bquieres\s+que\b/i, /\bdeseas\b/i, /\bprefieres\b/i, /\bnecesitas\b/i,
  /\bconfirma[rs]?\b/i, /\bproceder\b/i, /\baplicar\b/i, /\breiniciar\b/i,
  /\bselecciona\b/i, /\belige\b/i, /\bcual\s+de\b/i, /\bque\s+opcion\b/i,
];
const FINDING_KEYWORDS = /\b(CRITICO|ADVERTENCIA|CRITICAL|WARNING|FALLO|FAILED|FAILURE|PELIGRO|DANGER|ALERTA|ALERT|VULNERABILIDAD|VULNERABLE)\b/i;
const FINDING_EMOJIS = /([\u26A0\uFE0F]|[\u274C]|[\u{1F534}]|[\u{1F7E0}]|[\u{1F7E1}]|[\u2757]|[\u203C]|[\u{1F6A8}])/u;
const RECOMMENDATION_PATTERNS = [
  /\bse\s+recomienda\b/i, /\brecomendacion\b/i, /\bsugerencia\b/i,
  /\bdeber[ií]a\b/i, /\bconviene\b/i, /\bes\s+recomendable\b/i,
  /\bse\s+sugiere\b/i, /\baccion\s+sugerida\b/i, /\baccion\s+recomendada\b/i,
];
const SEVERITY_MAP = {
  critico: 'critical', critical: 'critical', peligro: 'critical', danger: 'critical',
  advertencia: 'high', warning: 'high', alerta: 'high', alert: 'high',
  fallo: 'high', failed: 'high', failure: 'high',
  vulnerabilidad: 'high', vulnerable: 'high',
};
const TAG_PATTERNS = {
  linux: /\b(linux|ubuntu|debian|centos|rhel|fedora|suse|arch|alpine|rocky|alma)\b/i,
  windows: /\b(windows|powershell|iis|rdp|active\s*directory)\b/i,
  security: /\b(seguridad|security|firewall|ssh|acceso|access|auth|password|permisos|permissions|vulnerab)\b/i,
  performance: /\b(cpu|ram|memoria|memory|rendimiento|performance|carga|load|lento|slow|consumo)\b/i,
  storage: /\b(disco|disk|almacenamiento|storage|espacio|space|inodo|inode|particion)\b/i,
  network: /\b(red|network|puerto|port|dns|ip\b|conectividad|connectivity|interfaz|interface|latencia)\b/i,
  services: /\b(servicio|service|proceso|process|systemctl|daemon|nginx|apache|mysql|postgres)\b/i,
  updates: /\b(actualizacion|update|parche|patch|upgrade|paquete|package)\b/i,
  error: /\b(error|fallo|fail|critico|critical)\b/i,
  warning: /\b(warning|advertencia|atencion|cuidado)\b/i,
};

// ======================== MAIN PARSER ========================

/**
 * Parse AI response text + execution results into semantic blocks.
 * @param {string} text - The AI's markdown text response
 * @param {array} executions - Command execution results [{command, stdout, stderr, exitCode, executionTimeMs}]
 * @returns {{ blocks: object[], tags: string[] }}
 */
export function parseSemanticBlocks(text, executions = []) {
  if (!text) return { blocks: [], tags: [] };

  const blocks = [];
  const lines = text.split('\n');

  // Pre-pass: extract ACTION markers
  const actionLines = [];
  const cleanLines = [];
  for (const line of lines) {
    const actionMatch = line.match(/\[ACTION:\s*(.+?)\]/);
    if (actionMatch) {
      actionLines.push(actionMatch[1].trim());
    } else {
      cleanLines.push(line);
    }
  }

  // Pre-pass: create execution_step blocks
  for (const exec of executions) {
    blocks.push({
      id: randomUUID(),
      type: 'execution_step',
      title: null,
      tags: [],
      severity: exec.exitCode !== 0 ? 'high' : null,
      actions: ['copy', 'reexecute', 'explain'],
      command: exec.command,
      stdout: exec.stdout || '',
      stderr: exec.stderr || '',
      exitCode: exec.exitCode ?? 0,
      duration: exec.executionTimeMs || 0,
      timedOut: exec.timedOut || false,
      startedAt: exec.startedAt,
    });
  }

  // Sequential parsing
  let i = 0;
  let currentSection = null;
  let metricBuffer = [];

  while (i < cleanLines.length) {
    const line = cleanLines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) { i++; continue; }

    // Code blocks
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < cleanLines.length && !cleanLines[i].trim().startsWith('```')) {
        codeLines.push(cleanLines[i]);
        i++;
      }
      i++; // skip closing ```
      flushMetrics(blocks, metricBuffer); metricBuffer = [];
      blocks.push({
        id: randomUUID(),
        type: 'code_block',
        title: null,
        tags: [],
        severity: null,
        actions: ['copy', 'execute', 'explain'],
        code: codeLines.join('\n'),
        language: lang || 'bash',
        executable: true,
      });
      continue;
    }

    // Tables
    if (trimmed.includes('|') && trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines = [];
      while (i < cleanLines.length && cleanLines[i].trim().startsWith('|') && cleanLines[i].trim().endsWith('|')) {
        tableLines.push(cleanLines[i].trim());
        i++;
      }
      if (tableLines.length >= 2) {
        flushMetrics(blocks, metricBuffer); metricBuffer = [];
        const table = parseTable(tableLines);
        if (table) {
          blocks.push({
            id: randomUUID(),
            type: 'data_table',
            title: currentSection,
            tags: [],
            severity: null,
            actions: ['copy', 'export', 'explain', 'filter'],
            headers: table.headers,
            rows: table.rows,
            sortable: true,
            filterable: table.rows.length > 5,
          });
          continue;
        }
      }
    }

    // Synthesis section → summary_card
    if (/^##\s*.*(?:Sintesis|Resumen|Summary)/i.test(trimmed)) {
      flushMetrics(blocks, metricBuffer); metricBuffer = [];
      const highlights = [];
      i++;
      while (i < cleanLines.length) {
        const sl = cleanLines[i].trim();
        if (sl.startsWith('##') || sl.startsWith('[ACTION:') || sl.startsWith('---')) break;
        if (sl) highlights.push(sl.replace(/^[-*]\s*/, ''));
        i++;
      }
      blocks.push({
        id: randomUUID(),
        type: 'summary_card',
        title: 'Sintesis',
        tags: [],
        severity: null,
        actions: ['copy', 'export', 'simplify'],
        status: detectOverallStatus(text),
        highlights,
        stats: [],
      });
      continue;
    }

    // Section headers
    if (/^#{1,4}\s+/.test(trimmed)) {
      flushMetrics(blocks, metricBuffer); metricBuffer = [];
      currentSection = trimmed.replace(/^#+\s*/, '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}]/gu, '').trim();
      blocks.push({
        id: randomUUID(),
        type: 'text_block',
        title: null,
        tags: [],
        severity: null,
        actions: [],
        content: trimmed,
        format: 'markdown',
      });
      i++;
      continue;
    }

    // Horizontal rules (separators)
    if (/^-{3,}$/.test(trimmed)) { i++; continue; }

    // Questions
    if (trimmed.endsWith('?') && QUESTION_PATTERNS.some((p) => p.test(trimmed))) {
      flushMetrics(blocks, metricBuffer); metricBuffer = [];
      const options = extractOptions(cleanLines, i + 1);
      blocks.push({
        id: randomUUID(),
        type: 'question_prompt',
        title: null,
        tags: [],
        severity: null,
        actions: [],
        question: trimmed,
        options: options.length > 0 ? options : [
          { label: 'Si', value: 'si' },
          { label: 'No', value: 'no' },
          { label: 'Ver impacto', value: 'ver impacto primero' },
        ],
        inputType: options.length > 4 ? 'select' : 'buttons',
      });
      i += 1 + options.length;
      continue;
    }

    // Findings (severity indicators)
    if (FINDING_KEYWORDS.test(trimmed) || (FINDING_EMOJIS.test(trimmed) && trimmed.length > 10)) {
      flushMetrics(blocks, metricBuffer); metricBuffer = [];
      const severity = detectSeverity(trimmed);
      const description = [];
      i++;
      while (i < cleanLines.length) {
        const fl = cleanLines[i].trim();
        if (!fl || fl.startsWith('##') || fl.startsWith('|') || fl.startsWith('---')) break;
        if (FINDING_KEYWORDS.test(fl) || RECOMMENDATION_PATTERNS.some((p) => p.test(fl))) break;
        description.push(fl);
        i++;
      }
      blocks.push({
        id: randomUUID(),
        type: 'finding',
        title: trimmed.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}]/gu, '').replace(/^[-*]\s*/, '').trim(),
        tags: [],
        severity,
        actions: ['explain', 'fix', 'deepen', 'tag', 'add_to_report'],
        description: description.join('\n'),
        impact: null,
        evidence: null,
        remediation: null,
      });
      continue;
    }

    // Recommendations
    if (RECOMMENDATION_PATTERNS.some((p) => p.test(trimmed))) {
      flushMetrics(blocks, metricBuffer); metricBuffer = [];
      blocks.push({
        id: randomUUID(),
        type: 'recommendation',
        title: null,
        tags: [],
        severity: null,
        actions: ['execute', 'explain', 'modify', 'add_to_report'],
        priority: 'medium',
        description: trimmed.replace(/^[-*]\s*/, ''),
        command: null,
        risk: 'low',
      });
      i++;
      continue;
    }

    // Metrics detection (accumulate and flush)
    if (METRIC_LABELS.test(trimmed) && /\d/.test(trimmed)) {
      const metrics = extractMetricsFromLine(trimmed);
      if (metrics.length > 0) {
        metricBuffer.push(...metrics);
        i++;
        continue;
      }
    }

    // Default: text block (accumulate consecutive text lines)
    flushMetrics(blocks, metricBuffer); metricBuffer = [];
    const textLines = [trimmed];
    i++;
    while (i < cleanLines.length) {
      const tl = cleanLines[i].trim();
      if (!tl || tl.startsWith('##') || tl.startsWith('```') || (tl.startsWith('|') && tl.endsWith('|')) || tl.startsWith('---')) break;
      if (FINDING_KEYWORDS.test(tl) || QUESTION_PATTERNS.some((p) => p.test(tl) && tl.endsWith('?'))) break;
      if (RECOMMENDATION_PATTERNS.some((p) => p.test(tl))) break;
      textLines.push(tl);
      i++;
    }
    blocks.push({
      id: randomUUID(),
      type: 'text_block',
      title: null,
      tags: [],
      severity: null,
      actions: ['copy', 'explain'],
      content: textLines.join('\n'),
      format: 'markdown',
    });
  }

  // Flush remaining metrics
  flushMetrics(blocks, metricBuffer);

  // Add action items from [ACTION:] markers
  for (const action of actionLines) {
    blocks.push({
      id: randomUUID(),
      type: 'recommendation',
      title: null,
      tags: [],
      severity: null,
      actions: ['execute'],
      priority: 'medium',
      description: action,
      command: null,
      risk: 'low',
    });
  }

  // Auto-tag the whole response
  const tags = detectTags(text);

  return { blocks, tags };
}

// ======================== HELPERS ========================

/** @internal Flush accumulated metrics buffer into a single metric_block. */
function flushMetrics(blocks, buffer) {
  if (buffer.length === 0) return;
  blocks.push({
    id: randomUUID(),
    type: 'metric_block',
    title: null,
    tags: [],
    severity: null,
    actions: ['refresh', 'compare', 'explain'],
    metrics: [...buffer],
  });
  buffer.length = 0;
}

/** @internal Parse markdown table lines into { headers, rows } or null. */
export function parseTable(lines) {
  if (lines.length < 2) return null;
  const headerLine = lines[0];
  // Skip separator line (|---|---|)
  const separatorIndex = lines.findIndex((l) => /^\|[\s-:|]+\|$/.test(l));
  const dataStart = separatorIndex >= 0 ? separatorIndex + 1 : 1;

  const headers = headerLine.split('|').filter(Boolean).map((h) => h.trim());
  const rows = [];
  for (let j = dataStart; j < lines.length; j++) {
    const cells = lines[j].split('|').filter(Boolean).map((c) => c.trim());
    if (cells.length > 0) rows.push(cells);
  }

  if (headers.length === 0 || rows.length === 0) return null;
  return { headers, rows };
}

/** @internal Extract list-style options from lines starting at startIndex. Max 10. */
export function extractOptions(lines, startIndex) {
  const options = [];
  let j = startIndex;
  while (j < lines.length && options.length < 10) {
    const l = lines[j].trim();
    if (!l) break;
    // Match list items: - Option, * Option, 1. Option, a) Option
    const match = l.match(/^[-*\d.)\]]\s*(.+)/);
    if (match) {
      options.push({ label: match[1].trim(), value: match[1].trim().toLowerCase() });
      j++;
    } else {
      break;
    }
  }
  return options;
}

/** @internal Extract metric {label, value, unit, status, threshold} objects from a text line. */
export function extractMetricsFromLine(line) {
  const metrics = [];
  // Pattern: "Label: Value Unit" or "**Label:** Value Unit"
  const patterns = [
    /\*?\*?([A-Za-z\u00C0-\u017F][\w\s/]*?)\*?\*?\s*[:=]\s*(\d[\d.,]*)\s*(%%|%|GB|MB|KB|TB|ms|s|MHz|GHz|cores?|CPUs?|MB\/s)\b/gi,
    /\*?\*?([A-Za-z\u00C0-\u017F][\w\s/]*?)\*?\*?\s*[:=]\s*(\d[\d.,]*)\s*$/gm,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(line)) !== null) {
      const label = match[1].trim();
      const value = parseFloat(match[2].replace(',', '.'));
      const unit = (match[3] || '').replace('%%', '%');

      if (isNaN(value)) continue;

      let status = 'normal';
      if (unit === '%') {
        if (value >= 90) status = 'critical';
        else if (value >= 70) status = 'warning';
        else status = 'good';
      }

      metrics.push({ label, value, unit, status, threshold: unit === '%' ? 90 : null });
    }
  }
  return metrics;
}

/** @internal Detect severity level from keywords and emojis in text. */
export function detectSeverity(text) {
  const lower = text.toLowerCase();
  for (const [keyword, severity] of Object.entries(SEVERITY_MAP)) {
    if (lower.includes(keyword)) return severity;
  }
  if (text.includes('\u274C') || text.includes('\u{1F534}')) return 'critical';
  if (text.includes('\u26A0') || text.includes('\u{1F7E0}')) return 'high';
  if (text.includes('\u{1F7E1}')) return 'medium';
  return 'medium';
}

/** @internal Detect overall response status from keywords in full text. */
export function detectOverallStatus(text) {
  const lower = text.toLowerCase();
  if (/\b(critico|critical|peligro|grave)\b/.test(lower)) return 'critical';
  if (/\b(advertencia|warning|atencion|cuidado)\b/.test(lower)) return 'warning';
  if (/\b(normal|estable|saludable|operativo|ok\b|correcto)\b/.test(lower)) return 'good';
  return 'info';
}

/** @internal Detect topic tags from pattern matching against full text. */
export function detectTags(text) {
  const tags = [];
  for (const [tag, pattern] of Object.entries(TAG_PATTERNS)) {
    if (pattern.test(text)) tags.push(tag);
  }
  return tags;
}

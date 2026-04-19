import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSemanticBlocks,
  parseTable,
  extractOptions,
  extractMetricsFromLine,
  detectSeverity,
  detectOverallStatus,
  detectTags,
} from '../semantic-parser.js';

// ════════════════════════════════════════════════════════════════════
// HELPER: assert block type at index
// ════════════════════════════════════════════════════════════════════
function assertBlockType(blocks, index, expectedType) {
  assert.ok(blocks.length > index, `Expected at least ${index + 1} blocks, got ${blocks.length}`);
  assert.equal(blocks[index].type, expectedType, `Block ${index} should be ${expectedType}, got ${blocks[index].type}`);
}

// ════════════════════════════════════════════════════════════════════
// 1. AUXILIARY FUNCTIONS — parseTable
// ════════════════════════════════════════════════════════════════════

describe('parseTable', () => {
  it('parses standard markdown table', () => {
    const lines = ['| Name | Status |', '|---|---|', '| nginx | active |', '| ssh | active |'];
    const result = parseTable(lines);
    assert.deepEqual(result.headers, ['Name', 'Status']);
    assert.equal(result.rows.length, 2);
    assert.deepEqual(result.rows[0], ['nginx', 'active']);
  });

  it('handles table without separator row', () => {
    const lines = ['| A | B |', '| 1 | 2 |', '| 3 | 4 |'];
    const result = parseTable(lines);
    assert.deepEqual(result.headers, ['A', 'B']);
    // Without separator, dataStart = 1, so rows start from line index 1
    assert.equal(result.rows.length, 2);
  });

  it('returns null for single-line input', () => {
    assert.equal(parseTable(['| only |']), null);
  });

  it('returns null for empty headers', () => {
    assert.equal(parseTable(['||', '|---|', '| data |']), null);
  });
});

// ════════════════════════════════════════════════════════════════════
// 2. AUXILIARY FUNCTIONS — extractOptions
// ════════════════════════════════════════════════════════════════════

describe('extractOptions', () => {
  it('extracts dash-prefixed options', () => {
    const lines = ['question?', '- Option A', '- Option B', '- Option C', ''];
    const options = extractOptions(lines, 1);
    assert.equal(options.length, 3);
    assert.equal(options[0].label, 'Option A');
    assert.equal(options[0].value, 'option a');
  });

  it('extracts numbered options (1. 2.) — includes dot in label', () => {
    // Current behavior: regex captures ". First" including the dot+space
    const lines = ['q?', '1. First', '2. Second'];
    const options = extractOptions(lines, 1);
    assert.equal(options.length, 2);
    assert.equal(options[0].label, '. First');
  });

  it('stops at empty line', () => {
    const lines = ['q?', '- A', '', '- B'];
    const options = extractOptions(lines, 1);
    assert.equal(options.length, 1);
  });

  it('stops at non-list line', () => {
    const lines = ['q?', '- A', 'Some text without list prefix'];
    const options = extractOptions(lines, 1);
    assert.equal(options.length, 1);
  });

  it('caps at 10 options', () => {
    const lines = ['q?', ...Array.from({ length: 15 }, (_, i) => `- Opt ${i}`)];
    const options = extractOptions(lines, 1);
    assert.equal(options.length, 10);
  });
});

// ════════════════════════════════════════════════════════════════════
// 3. AUXILIARY FUNCTIONS — extractMetricsFromLine
// ════════════════════════════════════════════════════════════════════

describe('extractMetricsFromLine', () => {
  it('current behavior: percentage metrics not extracted due to regex \\b after %', () => {
    // Documents bug: the regex pattern uses \b after %, but % is non-word char
    // so \b never matches after %. Percentage metrics silently return empty.
    // TODO: fix regex in semantic-parser.js, then update this test
    const metrics = extractMetricsFromLine('CPU: 45%');
    assert.equal(metrics.length, 0);
  });

  it('current behavior: RAM 92% also not extracted (same regex bug)', () => {
    // Same root cause as CPU: 45%
    // TODO: fix regex in semantic-parser.js, then update this test
    const metrics = extractMetricsFromLine('RAM: 92%');
    assert.equal(metrics.length, 0);
  });

  it('extracts "Disco: 75 GB" with unit', () => {
    const metrics = extractMetricsFromLine('Disco: 75 GB');
    assert.equal(metrics.length, 1);
    assert.equal(metrics[0].value, 75);
    assert.equal(metrics[0].unit, 'GB');
  });

  it('current behavior: multiple percentage metrics not extracted', () => {
    // Same regex \b bug — neither CPU: 30% nor RAM: 85% extracts
    // TODO: fix regex, then update this test to expect >= 2
    const metrics = extractMetricsFromLine('CPU: 30% | RAM: 85%');
    assert.equal(metrics.length, 0);
  });

  it('returns empty for line without metrics', () => {
    const metrics = extractMetricsFromLine('El servidor esta funcionando normalmente');
    assert.equal(metrics.length, 0);
  });

  it('handles comma decimal separator', () => {
    const metrics = extractMetricsFromLine('Uso: 4,5 GB');
    assert.equal(metrics.length, 1);
    assert.equal(metrics[0].value, 4.5);
  });
});

// ════════════════════════════════════════════════════════════════════
// 4. AUXILIARY FUNCTIONS — detectSeverity
// ════════════════════════════════════════════════════════════════════

describe('detectSeverity', () => {
  it('returns critical for "critico"', () => {
    assert.equal(detectSeverity('Nivel CRITICO detectado'), 'critical');
  });

  it('returns high for "warning"', () => {
    assert.equal(detectSeverity('Warning: check this'), 'high');
  });

  it('current behavior: ❌ emoji returns high because "failed" keyword matches first', () => {
    // Keywords are checked before emojis. "failed" → 'high' wins over ❌ → 'critical'.
    // TODO: consider reordering emoji check before keyword check
    assert.equal(detectSeverity('❌ Something failed'), 'high');
  });

  it('returns critical for ❌ emoji without keyword conflict', () => {
    assert.equal(detectSeverity('❌ Algo paso'), 'critical');
  });

  it('returns high for ⚠️ emoji', () => {
    assert.equal(detectSeverity('⚠️ Attention needed'), 'high');
  });

  it('returns medium for 🟡 emoji', () => {
    assert.equal(detectSeverity('🟡 Low priority issue'), 'medium');
  });

  it('returns medium as default', () => {
    assert.equal(detectSeverity('Some regular text'), 'medium');
  });
});

// ════════════════════════════════════════════════════════════════════
// 5. AUXILIARY FUNCTIONS — detectOverallStatus
// ════════════════════════════════════════════════════════════════════

describe('detectOverallStatus', () => {
  it('returns critical for text with "critico"', () => {
    assert.equal(detectOverallStatus('Estado critico del servidor'), 'critical');
  });

  it('returns warning for text with "advertencia"', () => {
    assert.equal(detectOverallStatus('Advertencia: disco casi lleno'), 'warning');
  });

  it('returns good for text with "estable"', () => {
    assert.equal(detectOverallStatus('El sistema esta estable'), 'good');
  });

  it('returns info as default', () => {
    assert.equal(detectOverallStatus('Informacion general del servidor'), 'info');
  });
});

// ════════════════════════════════════════════════════════════════════
// 6. AUXILIARY FUNCTIONS — detectTags
// ════════════════════════════════════════════════════════════════════

describe('detectTags', () => {
  it('detects linux from "ubuntu"', () => {
    const tags = detectTags('Servidor Ubuntu 22.04');
    assert.ok(tags.includes('linux'));
  });

  it('detects windows from "powershell"', () => {
    const tags = detectTags('Ejecutando PowerShell cmdlets');
    assert.ok(tags.includes('windows'));
  });

  it('detects multiple tags', () => {
    const tags = detectTags('Ubuntu server con firewall y nginx activo usando cpu alto');
    assert.ok(tags.includes('linux'));
    assert.ok(tags.includes('security'));
    assert.ok(tags.includes('services'));
    assert.ok(tags.includes('performance'));
  });

  it('returns empty for untagged text', () => {
    const tags = detectTags('Hola, como estas');
    assert.equal(tags.length, 0);
  });
});

// ════════════════════════════════════════════════════════════════════
// 7. parseSemanticBlocks — edge cases / empty input
// ════════════════════════════════════════════════════════════════════

describe('parseSemanticBlocks edge cases', () => {
  it('returns empty blocks and tags for null text', () => {
    const result = parseSemanticBlocks(null);
    assert.deepEqual(result, { blocks: [], tags: [] });
  });

  it('returns empty blocks and tags for empty string', () => {
    const result = parseSemanticBlocks('');
    assert.deepEqual(result, { blocks: [], tags: [] });
  });

  it('handles Windows line endings (\\r\\n) without crashing', () => {
    const text = '## Title\r\nSome text\r\n---\r\n## 📌 Sintesis\r\nAll good.';
    const { blocks } = parseSemanticBlocks(text);
    assert.ok(blocks.length > 0, 'Should produce blocks from \\r\\n text');
  });

  it('handles mixed Unicode emojis and special characters', () => {
    const text = '## 🖥️ Estado — Servidor "Producción"\n✅ Todo OK: ñ, á, é, ü\n¿Deseas continuar?';
    const { blocks } = parseSemanticBlocks(text);
    assert.ok(blocks.length > 0, 'Should handle unicode without crashing');
  });
});

// ════════════════════════════════════════════════════════════════════
// 8. parseSemanticBlocks — execution_step blocks
// ════════════════════════════════════════════════════════════════════

describe('execution_step blocks', () => {
  it('creates execution_step for each execution', () => {
    const execs = [
      { command: 'uptime', stdout: ' 10:30 up 5 days', stderr: '', exitCode: 0, executionTimeMs: 50 },
      { command: 'df -h', stdout: '/dev/sda1 20G', stderr: '', exitCode: 0, executionTimeMs: 80 },
    ];
    const { blocks } = parseSemanticBlocks('Response text', execs);
    const steps = blocks.filter((b) => b.type === 'execution_step');
    assert.equal(steps.length, 2);
  });

  it('execution_step has severity high when exitCode !== 0', () => {
    const execs = [{ command: 'fail', stdout: '', stderr: 'error', exitCode: 1, executionTimeMs: 10 }];
    const { blocks } = parseSemanticBlocks('text', execs);
    assert.equal(blocks[0].severity, 'high');
  });

  it('execution_step has severity null when exitCode === 0', () => {
    const execs = [{ command: 'ok', stdout: 'ok', stderr: '', exitCode: 0, executionTimeMs: 10 }];
    const { blocks } = parseSemanticBlocks('text', execs);
    assert.equal(blocks[0].severity, null);
  });

  it('execution_steps appear before text blocks in array', () => {
    const execs = [{ command: 'ls', stdout: 'files', stderr: '', exitCode: 0, executionTimeMs: 5 }];
    const { blocks } = parseSemanticBlocks('Some text here', execs);
    assert.equal(blocks[0].type, 'execution_step');
    assert.equal(blocks[1].type, 'text_block');
  });

  it('handles empty executions array', () => {
    const { blocks } = parseSemanticBlocks('Just text');
    const steps = blocks.filter((b) => b.type === 'execution_step');
    assert.equal(steps.length, 0);
  });
});

// ════════════════════════════════════════════════════════════════════
// 9. parseSemanticBlocks — code_block
// ════════════════════════════════════════════════════════════════════

describe('code_block', () => {
  it('detects fenced code block with language', () => {
    const text = '```python\nprint("hello")\n```';
    const { blocks } = parseSemanticBlocks(text);
    const code = blocks.find((b) => b.type === 'code_block');
    assert.ok(code);
    assert.equal(code.language, 'python');
    assert.equal(code.code, 'print("hello")');
    assert.equal(code.executable, true);
  });

  it('detects fenced code block without language (defaults to bash)', () => {
    const text = '```\napt update\n```';
    const { blocks } = parseSemanticBlocks(text);
    const code = blocks.find((b) => b.type === 'code_block');
    assert.ok(code);
    assert.equal(code.language, 'bash');
  });

  it('handles multi-line code block', () => {
    const text = '```bash\nline1\nline2\nline3\n```';
    const { blocks } = parseSemanticBlocks(text);
    const code = blocks.find((b) => b.type === 'code_block');
    assert.equal(code.code, 'line1\nline2\nline3');
  });

  it('does not confuse inline backticks with code blocks', () => {
    const text = 'Use `apt update` to refresh packages.';
    const { blocks } = parseSemanticBlocks(text);
    const code = blocks.find((b) => b.type === 'code_block');
    assert.equal(code, undefined, 'Inline backticks should not produce code_block');
  });
});

// ════════════════════════════════════════════════════════════════════
// 10. parseSemanticBlocks — data_table
// ════════════════════════════════════════════════════════════════════

describe('data_table', () => {
  it('parses markdown table with header, separator, and rows', () => {
    const text = '| Puerto | Estado |\n|---|---|\n| 22 | LISTEN |\n| 80 | LISTEN |';
    const { blocks } = parseSemanticBlocks(text);
    const table = blocks.find((b) => b.type === 'data_table');
    assert.ok(table);
    assert.deepEqual(table.headers, ['Puerto', 'Estado']);
    assert.equal(table.rows.length, 2);
  });

  it('sets filterable true when rows > 5', () => {
    const rows = Array.from({ length: 7 }, (_, i) => `| port${i} | ok |`).join('\n');
    const text = '| Port | Status |\n|---|---|\n' + rows;
    const { blocks } = parseSemanticBlocks(text);
    const table = blocks.find((b) => b.type === 'data_table');
    assert.equal(table.filterable, true);
  });

  it('sets filterable false when rows <= 5', () => {
    const text = '| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |';
    const { blocks } = parseSemanticBlocks(text);
    const table = blocks.find((b) => b.type === 'data_table');
    assert.equal(table.filterable, false);
  });

  it('inherits currentSection as title', () => {
    const text = '## 📊 Puertos\n| Puerto | Estado |\n|---|---|\n| 22 | LISTEN |';
    const { blocks } = parseSemanticBlocks(text);
    const table = blocks.find((b) => b.type === 'data_table');
    assert.equal(table.title, 'Puertos');
  });

  it('skips malformed table (header only, no data rows)', () => {
    const text = '| Header Only |';
    const { blocks } = parseSemanticBlocks(text);
    const table = blocks.find((b) => b.type === 'data_table');
    assert.equal(table, undefined);
  });
});

// ════════════════════════════════════════════════════════════════════
// 11. parseSemanticBlocks — summary_card
// ════════════════════════════════════════════════════════════════════

describe('summary_card', () => {
  it('detects "## 📌 Sintesis" header', () => {
    const text = '## 📌 Sintesis\nTodo funciona correctamente.';
    const { blocks } = parseSemanticBlocks(text);
    const summary = blocks.find((b) => b.type === 'summary_card');
    assert.ok(summary);
    assert.equal(summary.title, 'Sintesis');
  });

  it('detects "## Resumen" header (case insensitive)', () => {
    const text = '## resumen\nEl servidor esta estable.';
    const { blocks } = parseSemanticBlocks(text);
    const summary = blocks.find((b) => b.type === 'summary_card');
    assert.ok(summary);
  });

  it('detects "## Summary" header', () => {
    const text = '## Summary\nAll systems operational.';
    const { blocks } = parseSemanticBlocks(text);
    const summary = blocks.find((b) => b.type === 'summary_card');
    assert.ok(summary);
  });

  it('collects highlights from following lines', () => {
    const text = '## 📌 Sintesis\n- CPU normal\n- Disco ok\n- RAM estable';
    const { blocks } = parseSemanticBlocks(text);
    const summary = blocks.find((b) => b.type === 'summary_card');
    assert.equal(summary.highlights.length, 3);
    assert.equal(summary.highlights[0], 'CPU normal');
  });

  it('stops collecting at next ## or ---', () => {
    const text = '## 📌 Sintesis\nAll good.\n---\n## Next section';
    const { blocks } = parseSemanticBlocks(text);
    const summary = blocks.find((b) => b.type === 'summary_card');
    assert.equal(summary.highlights.length, 1);
    assert.equal(summary.highlights[0], 'All good.');
  });
});

// ════════════════════════════════════════════════════════════════════
// 12. parseSemanticBlocks — text_block from headers
// ════════════════════════════════════════════════════════════════════

describe('text_block from headers', () => {
  it('converts ## header to text_block with markdown format', () => {
    const text = '## Estado del Sistema';
    const { blocks } = parseSemanticBlocks(text);
    assertBlockType(blocks, 0, 'text_block');
    assert.equal(blocks[0].format, 'markdown');
    assert.ok(blocks[0].content.includes('## Estado del Sistema'));
  });

  it('converts ### header to text_block', () => {
    const text = '### Subheader';
    const { blocks } = parseSemanticBlocks(text);
    assertBlockType(blocks, 0, 'text_block');
  });

  it('strips emojis from currentSection tracking', () => {
    const text = '## 📊 Servicios\n| Svc | Status |\n|---|---|\n| nginx | ok |';
    const { blocks } = parseSemanticBlocks(text);
    const table = blocks.find((b) => b.type === 'data_table');
    assert.equal(table.title, 'Servicios');
  });

  it('updates currentSection for subsequent table titles', () => {
    const text = '## Section A\ntext\n## Section B\n| H |\n|---|\n| d |';
    const { blocks } = parseSemanticBlocks(text);
    const table = blocks.find((b) => b.type === 'data_table');
    assert.equal(table.title, 'Section B');
  });
});

// ════════════════════════════════════════════════════════════════════
// 13. parseSemanticBlocks — question_prompt
// ════════════════════════════════════════════════════════════════════

describe('question_prompt', () => {
  it('detects question ending with ? matching QUESTION_PATTERNS', () => {
    const text = '¿Deseas aplicar las actualizaciones?';
    const { blocks } = parseSemanticBlocks(text);
    const q = blocks.find((b) => b.type === 'question_prompt');
    assert.ok(q);
    assert.ok(q.question.includes('Deseas'));
  });

  it('extracts options from following list items', () => {
    const text = '¿Deseas continuar?\n- Si\n- No\n- Cancelar';
    const { blocks } = parseSemanticBlocks(text);
    const q = blocks.find((b) => b.type === 'question_prompt');
    assert.equal(q.options.length, 3);
  });

  it('uses default options (Si/No/Ver impacto) when no list follows', () => {
    const text = '¿Deseas reiniciar el servicio?';
    const { blocks } = parseSemanticBlocks(text);
    const q = blocks.find((b) => b.type === 'question_prompt');
    assert.equal(q.options.length, 3);
    assert.equal(q.options[0].label, 'Si');
  });

  it('sets inputType to select when > 4 options', () => {
    const text = '¿Cual de estas prefieres?\n- A\n- B\n- C\n- D\n- E';
    const { blocks } = parseSemanticBlocks(text);
    const q = blocks.find((b) => b.type === 'question_prompt');
    assert.equal(q.inputType, 'select');
  });

  it('sets inputType to buttons when <= 4 options', () => {
    const text = '¿Deseas continuar?\n- Si\n- No';
    const { blocks } = parseSemanticBlocks(text);
    const q = blocks.find((b) => b.type === 'question_prompt');
    assert.equal(q.inputType, 'buttons');
  });

  it('does not detect question without matching pattern keyword', () => {
    const text = 'What time is it?';
    const { blocks } = parseSemanticBlocks(text);
    const q = blocks.find((b) => b.type === 'question_prompt');
    assert.equal(q, undefined, 'Generic question should not match QUESTION_PATTERNS');
  });
});

// ════════════════════════════════════════════════════════════════════
// 14. parseSemanticBlocks — finding
// ════════════════════════════════════════════════════════════════════

describe('finding', () => {
  it('detects FINDING_KEYWORDS (ADVERTENCIA)', () => {
    const text = 'ADVERTENCIA: SSH permite login de root';
    const { blocks } = parseSemanticBlocks(text);
    const f = blocks.find((b) => b.type === 'finding');
    assert.ok(f);
    assert.ok(f.title.includes('SSH'));
  });

  it('detects FINDING_EMOJIS (⚠️) when line > 10 chars', () => {
    const text = '⚠️ Se detecto un proceso zombie en el sistema';
    const { blocks } = parseSemanticBlocks(text);
    const f = blocks.find((b) => b.type === 'finding');
    assert.ok(f);
  });

  it('does not detect emoji in short line (<= 10 chars)', () => {
    const text = '⚠️ short';
    const { blocks } = parseSemanticBlocks(text);
    const f = blocks.find((b) => b.type === 'finding');
    assert.equal(f, undefined);
  });

  it('collects description from following lines', () => {
    const text = 'CRITICAL: disk full\nThe root partition has no space left.\nImmediate action required.';
    const { blocks } = parseSemanticBlocks(text);
    const f = blocks.find((b) => b.type === 'finding');
    assert.ok(f.description.includes('root partition'));
    assert.ok(f.description.includes('Immediate'));
  });

  it('stops description at next finding keyword', () => {
    const text = 'WARNING: issue one\nDetails about one.\nCRITICAL: issue two';
    const { blocks } = parseSemanticBlocks(text);
    const findings = blocks.filter((b) => b.type === 'finding');
    assert.equal(findings.length, 2);
  });

  it('stops description at next recommendation pattern', () => {
    const text = 'ADVERTENCIA: problema\nDetalles del problema.\nSe recomienda reiniciar.';
    const { blocks } = parseSemanticBlocks(text);
    const f = blocks.find((b) => b.type === 'finding');
    const r = blocks.find((b) => b.type === 'recommendation');
    assert.ok(f);
    assert.ok(r);
  });
});

// ════════════════════════════════════════════════════════════════════
// 15. parseSemanticBlocks — recommendation
// ════════════════════════════════════════════════════════════════════

describe('recommendation', () => {
  it('detects "Se recomienda" pattern', () => {
    const text = 'Se recomienda actualizar OpenSSL.';
    const { blocks } = parseSemanticBlocks(text);
    const r = blocks.find((b) => b.type === 'recommendation');
    assert.ok(r);
    assert.ok(r.description.includes('actualizar OpenSSL'));
  });

  it('detects "debería" pattern', () => {
    const text = 'Se debería reiniciar el servicio.';
    const { blocks } = parseSemanticBlocks(text);
    const r = blocks.find((b) => b.type === 'recommendation');
    assert.ok(r);
  });

  it('always sets priority to medium', () => {
    const text = 'Se recomienda urgentemente actualizar.';
    const { blocks } = parseSemanticBlocks(text);
    const r = blocks.find((b) => b.type === 'recommendation');
    assert.equal(r.priority, 'medium');
  });

  it('strips leading "- " from description', () => {
    const text = '- Se recomienda verificar permisos.';
    const { blocks } = parseSemanticBlocks(text);
    const r = blocks.find((b) => b.type === 'recommendation');
    assert.ok(!r.description.startsWith('- '));
  });
});

// ════════════════════════════════════════════════════════════════════
// 16. parseSemanticBlocks — metric_block
// ════════════════════════════════════════════════════════════════════

describe('metric_block', () => {
  it('detects line with metric label and number', () => {
    const text = 'Disco: 120 GB';
    const { blocks } = parseSemanticBlocks(text);
    const m = blocks.find((b) => b.type === 'metric_block');
    assert.ok(m, 'Should produce metric_block for disk metric');
    assert.equal(m.metrics[0].label, 'Disco');
  });

  it('accumulates consecutive metrics into single block', () => {
    const text = 'RAM: 4 GB\nDisco: 120 GB';
    const { blocks } = parseSemanticBlocks(text);
    const metrics = blocks.filter((b) => b.type === 'metric_block');
    assert.equal(metrics.length, 1, 'Consecutive metrics should be in one block');
    assert.equal(metrics[0].metrics.length, 2);
  });

  it('flushes metrics when non-metric line follows', () => {
    const text = 'RAM: 4 GB\nEl servidor esta bien.';
    const { blocks } = parseSemanticBlocks(text);
    const m = blocks.find((b) => b.type === 'metric_block');
    assert.ok(m);
    const t = blocks.find((b) => b.type === 'text_block');
    assert.ok(t);
  });

  it('does not detect line without metric label keyword', () => {
    const text = 'Resultado: 42 puntos';
    const { blocks } = parseSemanticBlocks(text);
    const m = blocks.find((b) => b.type === 'metric_block');
    assert.equal(m, undefined, '"Resultado" is not a metric label');
  });
});

// ════════════════════════════════════════════════════════════════════
// 17. parseSemanticBlocks — text_block default
// ════════════════════════════════════════════════════════════════════

describe('text_block default', () => {
  it('accumulates consecutive plain text lines', () => {
    const text = 'Line one.\nLine two.\nLine three.';
    const { blocks } = parseSemanticBlocks(text);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].type, 'text_block');
    assert.ok(blocks[0].content.includes('Line one.'));
    assert.ok(blocks[0].content.includes('Line three.'));
  });

  it('breaks at empty line', () => {
    const text = 'First paragraph.\n\nSecond paragraph.';
    const { blocks } = parseSemanticBlocks(text);
    const textBlocks = blocks.filter((b) => b.type === 'text_block');
    assert.equal(textBlocks.length, 2);
  });

  it('breaks at header', () => {
    const text = 'Some text.\n## Header';
    const { blocks } = parseSemanticBlocks(text);
    assert.equal(blocks.length, 2);
  });

  it('breaks at code fence', () => {
    const text = 'Some text.\n```\ncode\n```';
    const { blocks } = parseSemanticBlocks(text);
    assert.ok(blocks.some((b) => b.type === 'text_block'));
    assert.ok(blocks.some((b) => b.type === 'code_block'));
  });

  it('breaks at table', () => {
    const text = 'Some text.\n| A | B |\n|---|---|\n| 1 | 2 |';
    const { blocks } = parseSemanticBlocks(text);
    assert.ok(blocks.some((b) => b.type === 'text_block'));
    assert.ok(blocks.some((b) => b.type === 'data_table'));
  });
});

// ════════════════════════════════════════════════════════════════════
// 18. parseSemanticBlocks — ACTION markers
// ════════════════════════════════════════════════════════════════════

describe('ACTION markers', () => {
  it('extracts [ACTION: text] as recommendation blocks', () => {
    const text = 'Response text.\n[ACTION: Reiniciar nginx]';
    const { blocks } = parseSemanticBlocks(text);
    const recs = blocks.filter((b) => b.type === 'recommendation');
    assert.ok(recs.some((r) => r.description === 'Reiniciar nginx'));
  });

  it('ACTION blocks appear at end of blocks array', () => {
    const text = 'Some text.\n[ACTION: Do something]';
    const { blocks } = parseSemanticBlocks(text);
    const last = blocks[blocks.length - 1];
    assert.equal(last.type, 'recommendation');
    assert.equal(last.description, 'Do something');
  });

  it('ACTION lines are removed from text processing', () => {
    const text = '[ACTION: test]\nSome text.';
    const { blocks } = parseSemanticBlocks(text);
    const textBlocks = blocks.filter((b) => b.type === 'text_block');
    for (const tb of textBlocks) {
      assert.ok(!tb.content.includes('[ACTION:'), 'ACTION marker should not appear in text_block');
    }
  });
});

// ════════════════════════════════════════════════════════════════════
// 19. parseSemanticBlocks — tags integration
// ════════════════════════════════════════════════════════════════════

describe('tags integration', () => {
  it('detects linux tag from text mentioning ubuntu', () => {
    const { tags } = parseSemanticBlocks('Servidor Ubuntu 22.04 operativo.');
    assert.ok(tags.includes('linux'));
  });

  it('detects security tag from text mentioning firewall', () => {
    const { tags } = parseSemanticBlocks('Revisando el firewall del servidor.');
    assert.ok(tags.includes('security'));
  });

  it('detects multiple tags simultaneously', () => {
    const { tags } = parseSemanticBlocks('Ubuntu server con nginx y cpu alto, warning de seguridad.');
    assert.ok(tags.includes('linux'));
    assert.ok(tags.includes('services'));
    assert.ok(tags.includes('performance'));
  });

  it('returns empty tags for generic text', () => {
    const { tags } = parseSemanticBlocks('Todo bien.');
    assert.equal(tags.length, 0);
  });
});

// ════════════════════════════════════════════════════════════════════
// 20. parseSemanticBlocks — priority and ambiguity
// ════════════════════════════════════════════════════════════════════

describe('priority and ambiguity', () => {
  it('code block wins over table-like content inside fence', () => {
    const text = '```\n| A | B |\n|---|---|\n| 1 | 2 |\n```';
    const { blocks } = parseSemanticBlocks(text);
    assertBlockType(blocks, 0, 'code_block');
    assert.equal(blocks.filter((b) => b.type === 'data_table').length, 0);
  });

  it('summary_card wins over generic header', () => {
    const text = '## 📌 Sintesis\nTodo OK.';
    const { blocks } = parseSemanticBlocks(text);
    assert.ok(blocks.some((b) => b.type === 'summary_card'));
    // Should NOT also produce a text_block for the header
    const textHeaders = blocks.filter((b) => b.type === 'text_block' && b.content.includes('Sintesis'));
    assert.equal(textHeaders.length, 0);
  });

  // Documents bug #1 in docs/semantic-parser-bugs.md
  // TODO: update this test when bug is fixed
  it('current behavior: header wins over finding keywords', () => {
    const text = '## ⚠️ ADVERTENCIA: Root login habilitado';
    const { blocks } = parseSemanticBlocks(text);
    assertBlockType(blocks, 0, 'text_block'); // header wins, NOT finding
    assert.equal(blocks.filter((b) => b.type === 'finding').length, 0);
  });

  // Documents bug #2 in docs/semantic-parser-bugs.md
  // TODO: update this test when bug is fixed
  it('current behavior: summary_card status uses full text not just synthesis', () => {
    const text = 'CRITICO: servidor caido.\n\n## 📌 Sintesis\nSe resolvio el problema. Todo estable.';
    const { blocks } = parseSemanticBlocks(text);
    const summary = blocks.find((b) => b.type === 'summary_card');
    assert.equal(summary.status, 'critical', 'Status comes from full text, not just synthesis section');
  });

  // Documents bug #3 in docs/semantic-parser-bugs.md
  // TODO: update this test when bug is fixed
  it('current behavior: recommendation priority always medium regardless of context', () => {
    const text = 'Se recomienda URGENTEMENTE reiniciar el servidor de inmediato.';
    const { blocks } = parseSemanticBlocks(text);
    const r = blocks.find((b) => b.type === 'recommendation');
    assert.ok(r, 'Should produce recommendation (no finding keywords in text)');
    assert.equal(r.priority, 'medium', 'Priority is always medium, even with URGENTEMENTE');
  });

  // Documents bug #6 in docs/semantic-parser-bugs.md
  // TODO: update this test when bug is fixed
  it('current behavior: ACTION marker duplicates inline recommendation', () => {
    const text = 'Se recomienda actualizar OpenSSL.\n[ACTION: Actualizar OpenSSL]';
    const { blocks } = parseSemanticBlocks(text);
    const recs = blocks.filter((b) => b.type === 'recommendation');
    assert.equal(recs.length, 2, 'Both inline and ACTION marker produce recommendations');
  });

  // Documents bug #4 in docs/semantic-parser-bugs.md
  // TODO: update this test when bug is fixed
  it('current behavior: extractOptions captures descriptive bullets after question', () => {
    const text = '¿Deseas continuar?\n- El servidor esta bien\n- Los servicios funcionan';
    const { blocks } = parseSemanticBlocks(text);
    const q = blocks.find((b) => b.type === 'question_prompt');
    assert.equal(q.options.length, 2, 'Descriptive bullets captured as options');
  });

  // Documents bug #5 in docs/semantic-parser-bugs.md
  // TODO: update this test when bug is fixed
  it('current behavior: malformed table becomes text_blocks', () => {
    const text = '| Header Only |';
    const { blocks } = parseSemanticBlocks(text);
    assert.equal(blocks.filter((b) => b.type === 'data_table').length, 0);
    assert.ok(blocks.length > 0, 'Malformed table should produce some block');
  });

  it('horizontal rule (---) is skipped, not a block', () => {
    const text = 'Text above.\n---\nText below.';
    const { blocks } = parseSemanticBlocks(text);
    const allTypes = blocks.map((b) => b.type);
    assert.ok(!allTypes.includes('separator'), 'No separator block type');
    assert.equal(blocks.filter((b) => b.type === 'text_block').length, 2);
  });
});

// ════════════════════════════════════════════════════════════════════
// 21. Realistic integration tests
// ════════════════════════════════════════════════════════════════════

const SECURITY_AUDIT_RESPONSE = `## 🛡️ Auditoria de Seguridad

| Aspecto | Estado |
|---|---|
| SSH Root Login | Habilitado |
| Firewall | Inactivo |
| Fail2ban | No instalado |

⚠️ ADVERTENCIA: El login de root por SSH esta habilitado sin restriccion
Esto permite ataques de fuerza bruta directamente contra la cuenta root.

❌ CRITICAL: No hay firewall activo en el servidor
El servidor esta completamente expuesto sin ninguna regla de filtrado.

Se recomienda instalar y configurar ufw como firewall basico.

Se recomienda deshabilitar root login en /etc/ssh/sshd_config.

---

## 📌 Sintesis
Servidor con multiples vulnerabilidades criticas. Requiere accion inmediata.

[ACTION: Instalar ufw]
[ACTION: Deshabilitar root SSH]`;

const DIAGNOSTIC_RESPONSE = `## 📊 Diagnostico del Servidor

El servidor presenta lentitud reportada por el equipo de operaciones.

Disco: 120 GB
RAM: 8 GB

Los procesos de mayor consumo son:
- mysql: 45% CPU
- nginx: 12% CPU

ADVERTENCIA: MySQL esta consumiendo recursos excesivos
Se detecto un query lento que lleva mas de 30 minutos ejecutandose.

Se recomienda revisar el slow query log de MySQL.

---

## 📌 Sintesis
Servidor con problema de rendimiento identificado en MySQL. No es critico pero requiere atencion.`;

const CONFIGURATION_RESPONSE = `## 🔧 Configuracion de Nginx

Para configurar nginx como reverse proxy, necesitas editar el archivo de configuracion:

\`\`\`bash
sudo nano /etc/nginx/sites-available/default
\`\`\`

La configuracion sugerida es:

\`\`\`nginx
server {
    listen 80;
    server_name example.com;
    location / {
        proxy_pass http://localhost:3000;
    }
}
\`\`\`

¿Deseas aplicar esta configuracion?
- Si, aplicar ahora
- No, quiero revisarla primero
- Ver impacto antes de aplicar`;

describe('realistic integration', () => {
  it('parses typical security audit response (findings + recommendations + summary)', () => {
    const { blocks, tags } = parseSemanticBlocks(SECURITY_AUDIT_RESPONSE);

    const tables = blocks.filter((b) => b.type === 'data_table');
    assert.ok(tables.length >= 1, 'Should have at least 1 table');

    const findings = blocks.filter((b) => b.type === 'finding');
    assert.ok(findings.length >= 2, `Should have at least 2 findings, got ${findings.length}`);

    const recs = blocks.filter((b) => b.type === 'recommendation');
    assert.ok(recs.length >= 2, 'Should have at least 2 recommendations (inline + ACTION)');

    const summary = blocks.find((b) => b.type === 'summary_card');
    assert.ok(summary, 'Should have summary_card');

    assert.ok(tags.includes('security'), 'Should tag as security');
  });

  it('parses diagnostic response (metrics + finding + recommendation + summary)', () => {
    const { blocks } = parseSemanticBlocks(DIAGNOSTIC_RESPONSE);

    const metrics = blocks.filter((b) => b.type === 'metric_block');
    assert.ok(metrics.length >= 1, 'Should have at least 1 metric_block');

    const findings = blocks.filter((b) => b.type === 'finding');
    assert.ok(findings.length >= 1, 'Should have at least 1 finding');

    const summary = blocks.find((b) => b.type === 'summary_card');
    assert.ok(summary, 'Should have summary_card');
  });

  it('parses configuration response (text + code block + question_prompt)', () => {
    const { blocks } = parseSemanticBlocks(CONFIGURATION_RESPONSE);

    const codeBlocks = blocks.filter((b) => b.type === 'code_block');
    assert.ok(codeBlocks.length >= 2, `Should have at least 2 code blocks, got ${codeBlocks.length}`);

    const question = blocks.find((b) => b.type === 'question_prompt');
    assert.ok(question, 'Should have question_prompt');
    assert.ok(question.options.length >= 3, 'Should have at least 3 options');
  });

  it('preserves block order matching document flow', () => {
    const { blocks } = parseSemanticBlocks(SECURITY_AUDIT_RESPONSE);
    // First non-text block should be table (appears first in document)
    const significantBlocks = blocks.filter((b) => b.type !== 'text_block');
    if (significantBlocks.length >= 2) {
      const tableIdx = blocks.indexOf(significantBlocks.find((b) => b.type === 'data_table'));
      const summaryIdx = blocks.indexOf(blocks.find((b) => b.type === 'summary_card'));
      assert.ok(tableIdx < summaryIdx, 'Table should appear before summary in block order');
    }
  });
});

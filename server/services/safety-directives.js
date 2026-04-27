import db from '../db.js';

/**
 * Check a command against all enabled safety directives.
 * Returns { allowed: boolean, violations: [] }
 */
export function checkCommand(command, osType = 'linux') {
  const directives = db.prepare(
    "SELECT * FROM safety_directives WHERE enabled = 1 AND (os_scope = ? OR os_scope = 'all')"
  ).all(osType);

  const violations = [];

  for (const directive of directives) {
    if (!directive.detection_pattern) continue;

    try {
      const pattern = new RegExp(directive.detection_pattern, 'i');
      if (pattern.test(command)) {
        violations.push({
          id: directive.id,
          title: directive.title,
          description: directive.description,
          severity: directive.severity,
          rule_type: directive.rule_type,
          is_builtin: !!directive.is_builtin,
        });
      }
    } catch { /* invalid regex, skip */ }
  }

  const blocked = violations.some((v) => v.rule_type === 'block_command');
  const warnings = violations.filter((v) => v.rule_type === 'warn_before');

  return {
    allowed: !blocked,
    blocked,
    violations,
    warnings,
    message: blocked
      ? `BLOQUEADO: ${violations.find((v) => v.rule_type === 'block_command').title}`
      : warnings.length > 0
        ? `ADVERTENCIA: ${warnings.map((w) => w.title).join(', ')}`
        : null,
  };
}

/**
 * Get all directives for display/management.
 */
export function getAllDirectives() {
  return db.prepare('SELECT * FROM safety_directives ORDER BY is_builtin DESC, severity ASC, title ASC').all();
}

/**
 * Get directives formatted for the AI system prompt.
 */
export function getDirectivesForPrompt(osType = 'linux') {
  const directives = db.prepare(
    "SELECT title, description, rule_type, severity FROM safety_directives WHERE enabled = 1 AND (os_scope = ? OR os_scope = 'all') ORDER BY severity ASC"
  ).all(osType);

  if (directives.length === 0) return '';

  let prompt = '\n\nDIRECTRICES DE SEGURIDAD FUNDAMENTALES (OBLIGATORIO CUMPLIR):';
  for (const d of directives) {
    const icon = d.rule_type === 'block_command' ? 'PROHIBIDO' : 'PRECAUCION';
    prompt += `\n- [${icon}] ${d.title}: ${d.description}`;
  }
  prompt += '\n\nNUNCA generes comandos que violen estas directrices. Si el usuario solicita algo que las viole, EXPLICA el riesgo y SUGIERE una alternativa segura. Esto no es negociable.';

  return prompt;
}

/**
 * Create a new directive (manual or AI-suggested).
 */
export function createDirective(data) {
  const { title, description, rule_type, os_scope, detection_pattern, severity, suggested_by_ai, ai_reasoning } = data;
  if (!title) throw new Error('Titulo requerido');

  const result = db.prepare(
    `INSERT INTO safety_directives (title, description, rule_type, os_scope, detection_pattern, severity, source, suggested_by_ai, ai_reasoning)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    title, description || '', rule_type || 'warn_before', os_scope || 'all',
    detection_pattern || '', severity || 'high',
    suggested_by_ai ? 'ai' : 'manual', suggested_by_ai ? 1 : 0, ai_reasoning || ''
  );

  return db.prepare('SELECT * FROM safety_directives WHERE id = ?').get(result.lastInsertRowid);
}

/**
 * Toggle a directive on/off.
 */
export function toggleDirective(id) {
  const directive = db.prepare('SELECT * FROM safety_directives WHERE id = ?').get(id);
  if (!directive) throw new Error('Directriz no encontrada');

  const newState = directive.enabled ? 0 : 1;
  db.prepare('UPDATE safety_directives SET enabled = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newState, id);
  return { id, enabled: newState };
}

/**
 * Delete a directive (only non-builtin).
 */
export function deleteDirective(id) {
  const directive = db.prepare('SELECT * FROM safety_directives WHERE id = ?').get(id);
  if (!directive) throw new Error('Directriz no encontrada');
  if (directive.is_builtin) throw new Error('No se puede eliminar una directriz fundamental integrada');

  db.prepare('DELETE FROM safety_directives WHERE id = ?').run(id);
  return { success: true };
}

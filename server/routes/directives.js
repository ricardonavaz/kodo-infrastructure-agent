import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import db from '../db.js';
import { getAllDirectives, createDirective, toggleDirective, deleteDirective, checkCommand } from '../services/safety-directives.js';
import { getProfile } from '../services/profiler.js';
import { getKnowledgeForPrompt } from '../services/knowledge.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// List all directives
router.get('/', (req, res) => {
  res.json(getAllDirectives());
});

// Create new directive (admin only)
router.post('/', requireRole('admin'), (req, res) => {
  try {
    const directive = createDirective(req.body);
    res.status(201).json(directive);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Toggle enabled/disabled (admin only)
router.put('/:id/toggle', requireRole('admin'), (req, res) => {
  try {
    res.json(toggleDirective(parseInt(req.params.id)));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Delete (non-builtin only, admin only)
router.delete('/:id', requireRole('admin'), (req, res) => {
  try {
    res.json(deleteDirective(parseInt(req.params.id)));
  } catch (err) {
    res.status(err.message.includes('integrada') ? 403 : 404).json({ error: err.message });
  }
});

// Check a command against directives
router.post('/check', (req, res) => {
  const { command, os_type } = req.body;
  if (!command) return res.status(400).json({ error: 'Comando requerido' });
  res.json(checkCommand(command, os_type || 'linux'));
});

// AI-suggest new directives based on knowledge base and server profile (admin only)
router.post('/suggest', requireRole('admin'), async (req, res) => {
  const { connectionId } = req.body;

  const apiKey = db.prepare('SELECT value FROM settings WHERE key = ?').get('anthropic_api_key')?.value;
  if (!apiKey) return res.status(400).json({ error: 'API key no configurada' });

  const existing = getAllDirectives();
  const profile = connectionId ? getProfile(connectionId) : null;
  const knowledge = connectionId ? getKnowledgeForPrompt(connectionId) : '';

  const systemPrompt = `Eres un experto en seguridad de infraestructura. Tu trabajo es sugerir directrices de seguridad adicionales basandote en:
1. El perfil del servidor (OS, version, servicios)
2. La base de conocimiento de experiencias previas (exitos y fallos)
3. Las directrices que ya existen (para no duplicar)

REGLAS:
- Sugiere directrices que prevengan perdida de acceso, corrupcion de datos o interrupcion de servicios criticos
- Considera que hay comandos que funcionan en ciertas versiones de OS pero no en otras
- Cada directriz debe tener un patron de deteccion regex realista
- Responde en espanol
- Formato JSON estricto: array de objetos

FORMATO:
[
  {
    "title": "Titulo claro y corto",
    "description": "Explicacion del riesgo y por que esta directriz es importante",
    "rule_type": "block_command" o "warn_before",
    "os_scope": "linux" o "windows" o "all",
    "detection_pattern": "regex para detectar el comando peligroso",
    "severity": "critical" o "high" o "medium",
    "reasoning": "Por que sugieres esta directriz especificamente"
  }
]

Responde SOLO con el JSON array.`;

  let userPrompt = `DIRECTRICES EXISTENTES:\n${existing.map((d) => `- ${d.title} (${d.os_scope})`).join('\n')}\n`;
  if (profile) {
    userPrompt += `\nSERVIDOR:\n- OS: ${profile.os_version || profile.distro}\n- Servicios: ${profile.installed_services?.substring(0, 500) || 'N/A'}\n- Puertos: ${profile.open_ports?.substring(0, 300) || 'N/A'}\n`;
  }
  if (knowledge) userPrompt += `\n${knowledge}`;
  userPrompt += '\n\nSugiere 3-5 directrices nuevas que NO esten ya cubiertas.';

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content[0]?.text || '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return res.status(500).json({ error: 'IA no genero sugerencias validas', raw: text });

    const suggestions = JSON.parse(jsonMatch[0]);
    res.json({
      suggestions: suggestions.map((s) => ({
        ...s,
        suggested_by_ai: true,
        ai_reasoning: s.reasoning || '',
      })),
      metrics: { inputTokens: response.usage?.input_tokens, outputTokens: response.usage?.output_tokens },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

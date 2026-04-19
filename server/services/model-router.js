const MODELS = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-20250514',
  opus: 'claude-opus-4-20250514',
};

// Opus: generacion, planificacion compleja, instalaciones
const OPUS_PATTERNS = /\b(instalar|install|configurar|configure|setup|deploy|desplegar|migrar|migrate|playbook|plan|diseñar|design|arquitectura|cluster|replicacion|failover|hardening|generar?\s+playbook)\b/i;

// Sonnet: operaciones que modifican el sistema, tareas medianas
const SONNET_PATTERNS = /\b(actualizar|update|upgrade|aplicar|apply|cambiar|change|modificar|modify|crear|create|eliminar|delete|remove|reiniciar|restart|detener|stop|habilitar|enable|deshabilitar|disable|montar|mount|compilar|compile|backup|restaurar|restore)\b/i;

// Base model per taskType
const TASK_BASE = {
  deployment:    'opus',
  maintenance:   'sonnet',
  diagnostic:    'sonnet',
  configuration: 'sonnet',
  security:      'sonnet',
  monitoring:    'haiku',
  other:         'haiku',
};

export function selectModel(taskType, prompt) {
  const base = TASK_BASE[taskType] || 'haiku';

  // Escalado: Opus siempre gana si el prompt matchea
  if (OPUS_PATTERNS.test(prompt)) return MODELS.opus;

  // Sonnet sube desde Haiku si el prompt matchea
  if (base === 'haiku' && SONNET_PATTERNS.test(prompt)) return MODELS.sonnet;

  return MODELS[base];
}

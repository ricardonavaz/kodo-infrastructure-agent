import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { selectModel } from '../model-router.js';

const HAIKU = 'claude-haiku-4-5-20251001';
const SONNET = 'claude-sonnet-4-20250514';
const OPUS = 'claude-opus-4-20250514';

// ── Base taskType sin escalado ──────────────────────────────────────

describe('Base model por taskType (sin escalado)', () => {
  it('deployment → Opus', () => {
    assert.equal(selectModel('deployment', 'sube la app al servidor'), OPUS);
  });

  it('maintenance → Sonnet', () => {
    assert.equal(selectModel('maintenance', 'revisa el estado del cron'), SONNET);
  });

  it('diagnostic → Sonnet', () => {
    assert.equal(selectModel('diagnostic', 'por que esta lento el servidor'), SONNET);
  });

  it('configuration → Sonnet', () => {
    assert.equal(selectModel('configuration', 'ajusta el limite de conexiones'), SONNET);
  });

  it('security → Sonnet', () => {
    assert.equal(selectModel('security', 'revisa los permisos del directorio'), SONNET);
  });

  it('monitoring → Haiku', () => {
    assert.equal(selectModel('monitoring', 'cuanto ram queda libre'), HAIKU);
  });

  it('other → Haiku', () => {
    assert.equal(selectModel('other', 'hola que tal'), HAIKU);
  });
});

// ── Escalado a Opus desde distintos taskType ────────────────────────

describe('Escalado a Opus por OPUS_PATTERNS', () => {
  it('maintenance + "migrar" → Opus', () => {
    assert.equal(selectModel('maintenance', 'migrar la base de datos al nuevo servidor'), OPUS);
  });

  it('security + "hardening" → Opus', () => {
    assert.equal(selectModel('security', 'hardening completo del servidor'), OPUS);
  });

  it('monitoring + "configurar cluster" → Opus', () => {
    assert.equal(selectModel('monitoring', 'configurar el cluster de alta disponibilidad'), OPUS);
  });

  it('other + "generar playbook" → Opus', () => {
    assert.equal(selectModel('other', 'generar playbook para desplegar nginx'), OPUS);
  });
});

// ── Escalado a Sonnet desde Haiku ───────────────────────────────────

describe('Escalado a Sonnet por SONNET_PATTERNS', () => {
  it('monitoring + "reiniciar" → Sonnet', () => {
    assert.equal(selectModel('monitoring', 'reiniciar el servicio nginx'), SONNET);
  });

  it('other + "crear usuario" → Sonnet', () => {
    assert.equal(selectModel('other', 'crear un usuario nuevo en el sistema'), SONNET);
  });

  it('diagnostic (ya Sonnet) + "eliminar" no degrada', () => {
    // diagnostic base es Sonnet, SONNET_PATTERNS matchea pero no debe degradar
    assert.equal(selectModel('diagnostic', 'eliminar los logs antiguos'), SONNET);
  });
});

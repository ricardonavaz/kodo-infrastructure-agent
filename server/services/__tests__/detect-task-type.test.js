import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectTaskType } from '../../routes/agent.js';

describe('detectTaskType', () => {
  describe('maintenance patterns (English)', () => {
    it('"update packages" → maintenance', () => {
      assert.equal(detectTaskType('update packages'), 'maintenance');
    });

    it('"upgrade kernel" → maintenance', () => {
      assert.equal(detectTaskType('upgrade kernel'), 'maintenance');
    });

    it('"apply patch" → maintenance', () => {
      assert.equal(detectTaskType('apply patch'), 'maintenance');
    });

    it('"restart service" → maintenance', () => {
      assert.equal(detectTaskType('restart service'), 'maintenance');
    });

    it('"reboot server" → maintenance', () => {
      assert.equal(detectTaskType('reboot server'), 'maintenance');
    });

    it('"stop nginx" → maintenance', () => {
      assert.equal(detectTaskType('stop nginx'), 'maintenance');
    });
  });

  describe('maintenance patterns (Spanish)', () => {
    it('"mantenimiento del servidor" → maintenance (fix H8)', () => {
      assert.equal(detectTaskType('mantenimiento del servidor'), 'maintenance');
    });

    it('"mantenimiento general" → maintenance (fix H8)', () => {
      assert.equal(detectTaskType('mantenimiento general'), 'maintenance');
    });

    it('"hacer mantenimiento" → maintenance (fix H8)', () => {
      assert.equal(detectTaskType('hacer mantenimiento'), 'maintenance');
    });

    it('"actualizar paquetes" → maintenance', () => {
      assert.equal(detectTaskType('actualizar paquetes'), 'maintenance');
    });

    it('"reiniciar nginx" → maintenance', () => {
      assert.equal(detectTaskType('reiniciar nginx'), 'maintenance');
    });

    it('"parche de seguridad" → maintenance', () => {
      assert.equal(detectTaskType('parche de seguridad'), 'maintenance');
    });
  });

  describe('diagnostic patterns', () => {
    it('"revisar el servidor" → diagnostic', () => {
      assert.equal(detectTaskType('revisar el servidor'), 'diagnostic');
    });

    it('"revisión del sistema" → diagnostic (fix H8, antes caia a other)', () => {
      assert.equal(detectTaskType('revisión del sistema'), 'diagnostic');
    });

    it('"revisar los logs" → diagnostic', () => {
      assert.equal(detectTaskType('revisar los logs'), 'diagnostic');
    });

    it('"diagnosticar problema" → diagnostic', () => {
      assert.equal(detectTaskType('diagnosticar problema'), 'diagnostic');
    });

    it('"problema de red" → diagnostic', () => {
      assert.equal(detectTaskType('problema de red'), 'diagnostic');
    });
  });

  describe('priority ordering when multiple patterns match', () => {
    // El orden de filas en TASK_PATTERNS importa: maintenance (fila 0) se evalua
    // antes que diagnostic (fila 1). Cuando un prompt matchea ambos, gana maintenance.
    it('"revision y mantenimiento..." → maintenance (smoke test H8)', () => {
      assert.equal(
        detectTaskType('revision y mantenimiento, preguntame antes de ejecutar cada accion'),
        'maintenance'
      );
    });

    it('"revisión y mantenimiento..." con tilde → maintenance', () => {
      assert.equal(
        detectTaskType('revisión y mantenimiento, preguntame antes de ejecutar cada accion'),
        'maintenance'
      );
    });

    it('"mantenimiento y revisar logs" → maintenance (fila 0 gana a fila 1)', () => {
      assert.equal(detectTaskType('mantenimiento y revisar logs'), 'maintenance');
    });
  });

  describe('other taskTypes (no regression)', () => {
    it('deployment: "deploy app" → deployment', () => {
      assert.equal(detectTaskType('deploy app'), 'deployment');
    });

    it('deployment: "instalar paquete" → deployment', () => {
      assert.equal(detectTaskType('instalar paquete'), 'deployment');
    });

    it('configuration: "ajustar limite" → configuration', () => {
      assert.equal(detectTaskType('ajustar limite'), 'configuration');
    });

    it('monitoring: "cuanto ram queda" → monitoring', () => {
      assert.equal(detectTaskType('cuanto ram queda'), 'monitoring');
    });

    it('security: "revisar firewall" → diagnostic (revis gana a firewall)', () => {
      // Nota: fila 1 (diagnostic, revis) se evalua antes que fila 5 (security, firewall).
      // Documentado intencionalmente; si se desea priorizar security, ajustar orden.
      assert.equal(detectTaskType('revisar firewall'), 'diagnostic');
    });

    it('security: "hardening de permisos" → security', () => {
      assert.equal(detectTaskType('hardening de permisos'), 'security');
    });

    it('other: "hola que tal" → other', () => {
      assert.equal(detectTaskType('hola que tal'), 'other');
    });
  });

  describe('edge cases', () => {
    it('string vacio → other', () => {
      assert.equal(detectTaskType(''), 'other');
    });

    it('solo whitespace → other', () => {
      assert.equal(detectTaskType('   \n\t  '), 'other');
    });

    it('solo emojis → other', () => {
      assert.equal(detectTaskType('🚀🔥✨'), 'other');
    });

    it('case-insensitive: "MANTENIMIENTO" → maintenance', () => {
      assert.equal(detectTaskType('MANTENIMIENTO'), 'maintenance');
    });
  });
});

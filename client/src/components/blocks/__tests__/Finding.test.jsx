import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Finding from '../Finding.jsx';

describe('Finding', () => {
  describe('severity badge', () => {
    it('renderiza severity label "Medio" por defecto cuando severity es undefined', () => {
      render(<Finding block={{ title: 'algo' }} />);
      expect(screen.getByText('Medio')).toBeInTheDocument();
    });

    it('renderiza severity "critical" con label "Critico"', () => {
      render(<Finding block={{ title: 'algo', severity: 'critical' }} />);
      expect(screen.getByText('Critico')).toBeInTheDocument();
    });

    it('renderiza severity "high" con label "Alto"', () => {
      render(<Finding block={{ title: 'algo', severity: 'high' }} />);
      expect(screen.getByText('Alto')).toBeInTheDocument();
    });

    it('renderiza severity "low" con label "Bajo"', () => {
      render(<Finding block={{ title: 'algo', severity: 'low' }} />);
      expect(screen.getByText('Bajo')).toBeInTheDocument();
    });

    it('aplica data-severity attribute al badge con valor raw (incluso desconocido)', () => {
      const { container } = render(
        <Finding block={{ title: 'algo', severity: 'urgent' }} />
      );
      const badge = container.querySelector('.sb-severity-badge');
      expect(badge).toHaveAttribute('data-severity', 'urgent');
      // Severity desconocida muestra raw value como label
      expect(badge).toHaveTextContent('urgent');
    });

    it('aplica clase sb-finding-medium cuando severity es desconocida (fallback)', () => {
      const { container } = render(
        <Finding block={{ title: 'algo', severity: 'urgent' }} />
      );
      const outer = container.querySelector('.sb-finding');
      expect(outer).toHaveClass('sb-finding-medium');
    });
  });

  describe('contenido', () => {
    it('renderiza description con formatMessage cuando presente', () => {
      const { container } = render(
        <Finding block={{ title: 'titulo', description: 'esto es **urgente** ya' }} />
      );
      const desc = container.querySelector('.sb-finding-desc');
      expect(desc).toBeInTheDocument();
      const strong = desc.querySelector('strong');
      expect(strong).toBeInTheDocument();
      expect(strong).toHaveTextContent('urgente');
    });

    it('NO renderiza description cuando undefined', () => {
      const { container } = render(<Finding block={{ title: 'titulo' }} />);
      expect(container.querySelector('.sb-finding-desc')).toBeNull();
    });

    it('renderiza remediation con prefijo "Remediacion:" cuando presente', () => {
      const { container } = render(
        <Finding block={{ title: 'titulo', remediation: 'reiniciar servicio' }} />
      );
      const rem = container.querySelector('.sb-finding-remediation');
      expect(rem).toBeInTheDocument();
      expect(rem).toHaveTextContent('Remediacion:');
      expect(rem).toHaveTextContent('reiniciar servicio');
    });

    it('NO renderiza remediation cuando undefined', () => {
      const { container } = render(<Finding block={{ title: 'titulo' }} />);
      expect(container.querySelector('.sb-finding-remediation')).toBeNull();
    });

    it('renderiza evidence en <pre> como texto literal sin formato markdown', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <Finding block={{ title: 'titulo', evidence: 'log: **error**' }} />
      );
      // Evidence esta hidden por defecto, hay que abrir el toggle
      await user.click(screen.getByRole('button', { name: /evidencia/i }));
      const pre = container.querySelector('pre.sb-finding-evidence');
      expect(pre).toBeInTheDocument();
      // Asteriscos LITERALES, no convertidos a <strong>
      expect(pre).toHaveTextContent('log: **error**');
      expect(pre.querySelector('strong')).toBeNull();
    });
  });

  describe('toggles', () => {
    it('NO renderiza seccion impact cuando undefined', () => {
      const { container } = render(<Finding block={{ title: 'titulo' }} />);
      expect(screen.queryByRole('button', { name: /impacto/i })).toBeNull();
      // Tampoco la seccion contenedora
      const sections = container.querySelectorAll('.sb-finding-section');
      expect(sections.length).toBe(0);
    });

    it('renderiza boton "Impacto" pero contenido oculto por defecto', () => {
      const { container } = render(
        <Finding block={{ title: 'titulo', impact: 'productivo afectado' }} />
      );
      const btn = screen.getByRole('button', { name: /impacto/i });
      expect(btn).toBeInTheDocument();
      // Contenido NO renderizado todavia
      expect(container.querySelector('.sb-finding-content')).toBeNull();
    });

    it('al click en "Impacto" el contenido se hace visible', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <Finding block={{ title: 'titulo', impact: 'productivo afectado' }} />
      );
      await user.click(screen.getByRole('button', { name: /impacto/i }));
      const content = container.querySelector('.sb-finding-content');
      expect(content).toBeInTheDocument();
      expect(content).toHaveTextContent('productivo afectado');
    });

    it('toggles de Impacto y Evidencia son independientes', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <Finding
          block={{
            title: 'titulo',
            impact: 'algo de impacto',
            evidence: 'log linea 42',
          }}
        />
      );
      // Estado inicial: ambos cerrados
      expect(container.querySelector('.sb-finding-content')).toBeNull();
      expect(container.querySelector('.sb-finding-evidence')).toBeNull();

      // Abrir solo Impacto
      await user.click(screen.getByRole('button', { name: /impacto/i }));
      expect(container.querySelector('.sb-finding-content')).toBeInTheDocument();
      expect(container.querySelector('.sb-finding-evidence')).toBeNull();

      // Abrir Evidencia (ambos abiertos simultaneamente)
      await user.click(screen.getByRole('button', { name: /evidencia/i }));
      expect(container.querySelector('.sb-finding-content')).toBeInTheDocument();
      expect(container.querySelector('.sb-finding-evidence')).toBeInTheDocument();

      // Cerrar solo Impacto - Evidencia sigue abierto
      await user.click(screen.getByRole('button', { name: /impacto/i }));
      expect(container.querySelector('.sb-finding-content')).toBeNull();
      expect(container.querySelector('.sb-finding-evidence')).toBeInTheDocument();
    });
  });
});

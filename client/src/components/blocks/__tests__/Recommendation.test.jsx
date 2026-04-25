import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Recommendation from '../Recommendation.jsx';

describe('Recommendation', () => {
  describe('priority badge', () => {
    it('renderiza priority badge con label en español por defecto (medium)', () => {
      render(<Recommendation block={{ description: 'desc' }} />);
      expect(screen.getByText('Media')).toBeInTheDocument();
    });

    it('renderiza priority "high" con label "Alta"', () => {
      render(<Recommendation block={{ description: 'desc', priority: 'high' }} />);
      expect(screen.getByText('Alta')).toBeInTheDocument();
    });

    it('renderiza priority "low" con label "Baja"', () => {
      render(<Recommendation block={{ description: 'desc', priority: 'low' }} />);
      expect(screen.getByText('Baja')).toBeInTheDocument();
    });

    it('aplica data-priority attribute correcto al badge', () => {
      const { container } = render(
        <Recommendation block={{ description: 'desc', priority: 'high' }} />
      );
      const badge = container.querySelector('.sb-priority-badge');
      expect(badge).toHaveAttribute('data-priority', 'high');
    });
  });

  describe('description rendering', () => {
    it('renderiza description con markdown formateado', () => {
      const { container } = render(
        <Recommendation block={{ description: 'esto es **urgente** ya' }} />
      );
      const strong = container.querySelector('.sb-recommendation-desc strong');
      expect(strong).toBeInTheDocument();
      expect(strong).toHaveTextContent('urgente');
    });
  });

  describe('risk section', () => {
    it('NO renderiza seccion de risk cuando risk es undefined', () => {
      const { container } = render(
        <Recommendation block={{ description: 'desc' }} />
      );
      expect(container.querySelector('.sb-recommendation-risk')).toBeNull();
    });

    it('renderiza seccion de risk con inlineFormat cuando risk esta presente', () => {
      const { container } = render(
        <Recommendation block={{ description: 'desc', risk: 'puede **romper** prod' }} />
      );
      const riskSection = container.querySelector('.sb-recommendation-risk');
      expect(riskSection).toBeInTheDocument();
      expect(riskSection.querySelector('strong')).toHaveTextContent('romper');
      expect(screen.getByText('Riesgo:')).toBeInTheDocument();
    });
  });

  describe('command and execute button', () => {
    it('NO renderiza seccion de command/boton cuando command es undefined', () => {
      const { container } = render(
        <Recommendation block={{ description: 'desc' }} />
      );
      expect(container.querySelector('.sb-recommendation-action')).toBeNull();
      expect(screen.queryByRole('button', { name: /ejecutar/i })).toBeNull();
    });

    it('renderiza command y boton "Ejecutar" cuando command esta presente', () => {
      const { container } = render(
        <Recommendation block={{ description: 'desc', command: 'ls -la' }} />
      );
      const code = container.querySelector('.sb-recommendation-cmd');
      expect(code).toBeInTheDocument();
      expect(code).toHaveTextContent('ls -la');
      expect(screen.getByRole('button', { name: /ejecutar/i })).toBeInTheDocument();
    });

    it('llama onAction("execute", command) al click en boton "Ejecutar"', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      render(
        <Recommendation
          block={{ description: 'desc', command: 'ls -la' }}
          onAction={onAction}
        />
      );
      await user.click(screen.getByRole('button', { name: /ejecutar/i }));
      expect(onAction).toHaveBeenCalledWith('execute', 'ls -la');
      expect(onAction).toHaveBeenCalledTimes(1);
    });

    it('no crashea al click en "Ejecutar" si onAction es undefined', async () => {
      const user = userEvent.setup();
      render(
        <Recommendation block={{ description: 'desc', command: 'ls -la' }} />
      );
      await user.click(screen.getByRole('button', { name: /ejecutar/i }));
      // Si llegamos aqui sin throw, el caso silent no-op funciona.
      expect(true).toBe(true);
    });
  });
});

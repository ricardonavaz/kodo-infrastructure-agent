import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SummaryCard from '../SummaryCard.jsx';

describe('SummaryCard', () => {
  describe('title', () => {
    it('renderiza title cuando esta presente', () => {
      render(<SummaryCard block={{ title: 'Health Check' }} />);
      expect(screen.getByText('Health Check')).toBeInTheDocument();
    });

    it('usa fallback "Resumen" cuando title es undefined', () => {
      render(<SummaryCard block={{}} />);
      expect(screen.getByText('Resumen')).toBeInTheDocument();
    });
  });

  describe('status badge', () => {
    it('renderiza status badge con texto desde STATUS_LABELS para status conocido', () => {
      render(<SummaryCard block={{ status: 'warning' }} />);
      expect(screen.getByText('Advertencia')).toBeInTheDocument();
    });

    it('aplica data-status attribute al status badge', () => {
      const { container } = render(<SummaryCard block={{ status: 'critical' }} />);
      const badge = container.querySelector('.sb-status-badge');
      expect(badge).toHaveAttribute('data-status', 'critical');
    });

    it('usa statusText custom cuando esta presente, sobre STATUS_LABELS', () => {
      render(
        <SummaryCard block={{ status: 'good', statusText: 'En progreso' }} />
      );
      expect(screen.getByText('En progreso')).toBeInTheDocument();
      expect(screen.queryByText('Correcto')).toBeNull();
    });
  });

  describe('highlights', () => {
    it('NO renderiza seccion de highlights cuando highlights es array vacio', () => {
      const { container } = render(<SummaryCard block={{}} />);
      expect(container.querySelector('.sb-summary-highlights')).toBeNull();
    });

    it('renderiza highlights cuando array no esta vacio', () => {
      const { container } = render(
        <SummaryCard
          block={{
            highlights: ['Disco al 87%', 'Memoria libre OK', '3 servicios reiniciados'],
          }}
        />
      );
      const list = container.querySelector('ul.sb-summary-highlights');
      expect(list).toBeInTheDocument();
      expect(list.querySelectorAll('li')).toHaveLength(3);
      expect(screen.getByText(/Disco al 87/)).toBeInTheDocument();
      expect(screen.getByText(/Memoria libre OK/)).toBeInTheDocument();
      expect(screen.getByText(/3 servicios reiniciados/)).toBeInTheDocument();
    });
  });

  describe('stats', () => {
    it('NO renderiza seccion de stats cuando stats es array vacio', () => {
      const { container } = render(<SummaryCard block={{}} />);
      expect(container.querySelector('.sb-summary-stats')).toBeNull();
    });

    it('renderiza chips de stats con label y value', () => {
      const { container } = render(
        <SummaryCard
          block={{
            stats: [
              { label: 'CPU', value: '85%' },
              { label: 'RAM', value: '4.2 GB' },
            ],
          }}
        />
      );
      const chips = container.querySelectorAll('.sb-summary-chip');
      expect(chips).toHaveLength(2);
      expect(screen.getByText('CPU:')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText('RAM:')).toBeInTheDocument();
      expect(screen.getByText('4.2 GB')).toBeInTheDocument();
    });
  });
});

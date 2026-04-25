import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuestionPrompt from '../QuestionPrompt.jsx';

describe('QuestionPrompt', () => {
  describe('pregunta base', () => {
    it('renderiza la pregunta con formatMessage', () => {
      const { container } = render(
        <QuestionPrompt block={{ question: 'Quieres **continuar**?' }} />
      );
      const text = container.querySelector('.sb-question-text');
      expect(text).toBeInTheDocument();
      const strong = text.querySelector('strong');
      expect(strong).toBeInTheDocument();
      expect(strong).toHaveTextContent('continuar');
    });
  });

  describe('modo buttons (default)', () => {
    it('renderiza un boton por cada option como string', () => {
      render(
        <QuestionPrompt block={{ question: '?', options: ['Si', 'No', 'Tal vez'] }} />
      );
      expect(screen.getByRole('button', { name: 'Si' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Tal vez' })).toBeInTheDocument();
    });

    it('renderiza opciones como objetos {value, label} mostrando label', () => {
      render(
        <QuestionPrompt
          block={{
            question: '?',
            options: [
              { value: 'yes', label: 'Si quiero' },
              { value: 'no', label: 'Para nada' },
            ],
          }}
        />
      );
      expect(screen.getByRole('button', { name: 'Si quiero' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Para nada' })).toBeInTheDocument();
    });

    it('click en boton llama onAction("answer", value) con valor correcto del objeto', async () => {
      const user = userEvent.setup();
      const mockOnAction = vi.fn();
      render(
        <QuestionPrompt
          block={{
            question: '?',
            options: [{ value: 'yes', label: 'Si quiero' }],
          }}
          onAction={mockOnAction}
        />
      );
      await user.click(screen.getByRole('button', { name: 'Si quiero' }));
      // El value enviado es 'yes', NO el label 'Si quiero'
      expect(mockOnAction).toHaveBeenCalledWith('answer', 'yes');
      expect(mockOnAction).toHaveBeenCalledTimes(1);
    });
  });

  describe('modo select', () => {
    it('renderiza select con opcion placeholder "Seleccionar..."', () => {
      const { container } = render(
        <QuestionPrompt
          block={{ question: '?', inputType: 'select', options: ['A', 'B'] }}
        />
      );
      const select = container.querySelector('select.sb-question-select');
      expect(select).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Seleccionar...' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'A' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'B' })).toBeInTheDocument();
    });

    it('boton "Confirmar" disabled hasta que se selecciona opcion', async () => {
      const user = userEvent.setup();
      render(
        <QuestionPrompt
          block={{ question: '?', inputType: 'select', options: ['A', 'B'] }}
        />
      );
      const confirmBtn = screen.getByRole('button', { name: /confirmar/i });
      expect(confirmBtn).toBeDisabled();

      await user.selectOptions(screen.getByRole('combobox'), 'A');
      expect(confirmBtn).toBeEnabled();
    });

    it('tras seleccionar y click Confirmar, llama onAction("answer", value)', async () => {
      const user = userEvent.setup();
      const mockOnAction = vi.fn();
      render(
        <QuestionPrompt
          block={{ question: '?', inputType: 'select', options: ['A', 'B'] }}
          onAction={mockOnAction}
        />
      );
      await user.selectOptions(screen.getByRole('combobox'), 'B');
      await user.click(screen.getByRole('button', { name: /confirmar/i }));
      expect(mockOnAction).toHaveBeenCalledWith('answer', 'B');
    });
  });

  describe('modo text', () => {
    it('usa placeholder default "Escribe tu respuesta..." cuando no se provee', () => {
      render(<QuestionPrompt block={{ question: '?', inputType: 'text' }} />);
      expect(
        screen.getByPlaceholderText('Escribe tu respuesta...')
      ).toBeInTheDocument();
    });

    it('usa placeholder custom cuando se provee', () => {
      render(
        <QuestionPrompt
          block={{ question: '?', inputType: 'text', placeholder: 'Escribe el host' }}
        />
      );
      expect(screen.getByPlaceholderText('Escribe el host')).toBeInTheDocument();
    });

    it('boton "Enviar" disabled mientras input vacio o whitespace-only', async () => {
      const user = userEvent.setup();
      render(<QuestionPrompt block={{ question: '?', inputType: 'text' }} />);
      const sendBtn = screen.getByRole('button', { name: /enviar/i });

      // Vacio: disabled
      expect(sendBtn).toBeDisabled();

      // Solo whitespace: sigue disabled
      await user.type(screen.getByRole('textbox'), '   ');
      expect(sendBtn).toBeDisabled();

      // Texto real: enabled
      await user.type(screen.getByRole('textbox'), 'hola');
      expect(sendBtn).toBeEnabled();
    });

    it('tras typing y submit, llama onAction con texto trimeado', async () => {
      const user = userEvent.setup();
      const mockOnAction = vi.fn();
      render(
        <QuestionPrompt
          block={{ question: '?', inputType: 'text' }}
          onAction={mockOnAction}
        />
      );
      await user.type(screen.getByRole('textbox'), '  hola  ');
      await user.click(screen.getByRole('button', { name: /enviar/i }));
      // Trimeado: 'hola', no '  hola  '
      expect(mockOnAction).toHaveBeenCalledWith('answer', 'hola');
    });

    it('el input se resetea despues de submit', async () => {
      const user = userEvent.setup();
      const mockOnAction = vi.fn();
      render(
        <QuestionPrompt
          block={{ question: '?', inputType: 'text' }}
          onAction={mockOnAction}
        />
      );
      const input = screen.getByRole('textbox');
      await user.type(input, 'primera respuesta');
      await user.click(screen.getByRole('button', { name: /enviar/i }));
      expect(input).toHaveValue('');
    });
  });

  describe('modo confirm', () => {
    it('renderiza botones "Si" y "No"', () => {
      render(<QuestionPrompt block={{ question: '?', inputType: 'confirm' }} />);
      expect(screen.getByRole('button', { name: /^si$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^no$/i })).toBeInTheDocument();
    });

    it('click "Si" llama onAction("answer", "si")', async () => {
      const user = userEvent.setup();
      const mockOnAction = vi.fn();
      render(
        <QuestionPrompt
          block={{ question: '?', inputType: 'confirm' }}
          onAction={mockOnAction}
        />
      );
      await user.click(screen.getByRole('button', { name: /^si$/i }));
      expect(mockOnAction).toHaveBeenCalledWith('answer', 'si');
    });

    it('click "No" llama onAction("answer", "no")', async () => {
      const user = userEvent.setup();
      const mockOnAction = vi.fn();
      render(
        <QuestionPrompt
          block={{ question: '?', inputType: 'confirm' }}
          onAction={mockOnAction}
        />
      );
      await user.click(screen.getByRole('button', { name: /^no$/i }));
      expect(mockOnAction).toHaveBeenCalledWith('answer', 'no');
    });
  });

  describe('defensividad', () => {
    it('click sin onAction no crashea', async () => {
      const user = userEvent.setup();
      render(
        <QuestionPrompt
          block={{ question: '?', options: ['Si', 'No'] }}
        />
      );
      await user.click(screen.getByRole('button', { name: 'Si' }));
      // Si llegamos aqui sin throw, el silent no-op funciono
      expect(true).toBe(true);
    });

    it('inputType desconocido renderiza solo la pregunta sin input', () => {
      const { container } = render(
        <QuestionPrompt block={{ question: 'pregunta de prueba', inputType: 'radio' }} />
      );
      // Pregunta presente
      expect(screen.getByText('pregunta de prueba')).toBeInTheDocument();
      // Sin botones, sin input, sin select
      expect(container.querySelectorAll('button').length).toBe(0);
      expect(container.querySelectorAll('input').length).toBe(0);
      expect(container.querySelectorAll('select').length).toBe(0);
    });
  });
});

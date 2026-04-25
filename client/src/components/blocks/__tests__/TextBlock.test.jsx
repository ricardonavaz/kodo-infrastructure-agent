import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TextBlock from '../TextBlock.jsx';

describe('TextBlock', () => {
  it('renderiza markdown por defecto cuando format es undefined', () => {
    const { container } = render(
      <TextBlock block={{ content: 'texto **urgente**' }} />
    );
    const strong = container.querySelector('strong');
    expect(strong).toBeInTheDocument();
    expect(strong).toHaveTextContent('urgente');
    // Asegurar que no quedan asteriscos literales en el DOM
    expect(container.textContent).not.toMatch(/\*\*/);
  });

  it('renderiza markdown cuando format es "markdown" explicito', () => {
    const { container } = render(
      <TextBlock block={{ content: 'hola **mundo**', format: 'markdown' }} />
    );
    const strong = container.querySelector('strong');
    expect(strong).toBeInTheDocument();
    expect(strong).toHaveTextContent('mundo');
  });

  it('renderiza como texto plano dentro de <pre> cuando format es "plain"', () => {
    const { container } = render(
      <TextBlock block={{ content: 'no **bold** here', format: 'plain' }} />
    );
    const pre = container.querySelector('pre.sb-text-pre');
    expect(pre).toBeInTheDocument();
    expect(pre).toHaveTextContent('no **bold** here');
    // Asegurar que NO se aplico transformacion: no hay <strong>
    expect(container.querySelector('strong')).toBeNull();
  });

  it('renderiza como plain con cualquier format que no sea "markdown"', () => {
    const { container } = render(
      <TextBlock block={{ content: '**raw**', format: 'raw' }} />
    );
    const pre = container.querySelector('pre.sb-text-pre');
    expect(pre).toBeInTheDocument();
    expect(pre).toHaveTextContent('**raw**');
  });

  it('no crashea con content vacio en modo markdown', () => {
    const { container } = render(<TextBlock block={{ content: '' }} />);
    const wrapper = container.querySelector('div.sb-text-block');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toBeEmptyDOMElement();
  });

  it('no crashea con content vacio en modo plain', () => {
    const { container } = render(
      <TextBlock block={{ content: '', format: 'plain' }} />
    );
    const pre = container.querySelector('pre.sb-text-pre');
    expect(pre).toBeInTheDocument();
    expect(pre).toBeEmptyDOMElement();
  });
});

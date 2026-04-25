import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TextBlock from '../TextBlock.jsx';

describe('Test infrastructure smoke test', () => {
  it('vitest works', () => {
    expect(true).toBe(true);
  });

  it('jest-dom matchers work', () => {
    const div = document.createElement('div');
    div.textContent = 'hello';
    document.body.appendChild(div);
    expect(div).toBeInTheDocument();
    expect(div).toHaveTextContent('hello');
    div.remove();
  });

  it('react testing library can render a component', () => {
    render(<TextBlock block={{ content: 'hello world' }} />);
    expect(screen.getByText(/hello world/i)).toBeInTheDocument();
  });
});

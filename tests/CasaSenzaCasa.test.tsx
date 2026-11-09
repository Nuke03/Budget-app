import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CasaSenzaCasa } from '@/app/casa/CasaSenzaCasa';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

describe('CasaSenzaCasa', () => {
  it('mostra "Creo la casa" (verso /casa/inizia) e "Ho un codice di invito" (verso /casa/inizia?modo=entra) come link', () => {
    render(<CasaSenzaCasa />);
    expect(screen.getByRole('link', { name: 'Creo la casa' })).toHaveAttribute('href', '/casa/inizia');
    expect(screen.getByRole('link', { name: 'Ho un codice di invito' })).toHaveAttribute('href', '/casa/inizia?modo=entra');
  });

  it(`non nomina "l'altro": usa "le altre persone di casa"`, () => {
    const { container } = render(<CasaSenzaCasa />);
    expect(screen.getByText(/Cosa vedono le altre persone di casa\?/)).toBeInTheDocument();
    expect(container.textContent).not.toContain("l'altro");
    expect(
      screen.getByText(/Solo conti, spese e obiettivi della casa\. Le tue cose personali no, mai\./)
    ).toBeInTheDocument();
  });

  it('non contiene parole vietate', () => {
    const { container } = render(<CasaSenzaCasa />);
    assertNessunaParolaVietata(container);
  });
});

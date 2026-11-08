import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CasaSenzaCasa } from '@/app/casa/CasaSenzaCasa';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

describe('CasaSenzaCasa', () => {
  it('mostra "Creo la casa" e "Ho un codice di invito" come link a /casa/inizia', () => {
    render(<CasaSenzaCasa />);
    expect(screen.getByRole('link', { name: 'Creo la casa' })).toHaveAttribute('href', '/casa/inizia');
    expect(screen.getByRole('link', { name: 'Ho un codice di invito' })).toHaveAttribute('href', '/casa/inizia');
  });

  it('mostra la riga "Cosa vede l\'altro?" con la frase sulla privacy', () => {
    render(<CasaSenzaCasa />);
    expect(screen.getByText(/Cosa vede l'altro\?/)).toBeInTheDocument();
    expect(
      screen.getByText(/Solo conti, spese e obiettivi della casa\. Le tue cose personali no, mai\./)
    ).toBeInTheDocument();
  });

  it('non contiene parole vietate', () => {
    const { container } = render(<CasaSenzaCasa />);
    assertNessunaParolaVietata(container);
  });
});

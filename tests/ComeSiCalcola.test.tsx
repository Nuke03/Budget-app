import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComeSiCalcola } from '@/app/casa/ComeSiCalcola';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';
import type { Spiegazione } from '@/lib/calculations/casa/spiegazioni';

const spiegazione: Spiegazione = {
  valore: 777,
  formula:
    'Spese comuni 1.321 euro + cuscinetto 59 euro = 1.380 euro, divisi secondo il reddito.\nFabio: 1.800 su 3.200 di reddito, cioè 56%.',
  ingredienti: [
    { etichetta: 'Reddito di Fabio', valore: 1800 },
    { etichetta: 'Reddito di tutti', valore: 3200 },
    { etichetta: 'Totale da dividere', valore: 1380 },
    { etichetta: 'Numero di persone', valore: 2 },
  ],
};

describe('ComeSiCalcola', () => {
  it('è chiuso di default', () => {
    render(<ComeSiCalcola spiegazione={spiegazione} />);
    expect(screen.getByRole('button', { name: 'Come si calcola?' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/Spese comuni/)).not.toBeInTheDocument();
  });

  it('il pulsante "Come si calcola?" mostra formula e ingredienti con i valori', () => {
    render(<ComeSiCalcola spiegazione={spiegazione} />);
    fireEvent.click(screen.getByRole('button', { name: 'Come si calcola?' }));
    expect(screen.getByText(/Spese comuni 1\.321 euro \+ cuscinetto 59 euro = 1\.380 euro/)).toBeInTheDocument();
    expect(screen.getByText('Fabio: 1.800 su 3.200 di reddito, cioè 56%.')).toBeInTheDocument();
    expect(screen.getByText('Reddito di Fabio')).toBeInTheDocument();
    expect(screen.getByText('1.800,00 €')).toBeInTheDocument();
    expect(screen.getByText('1.380,00 €')).toBeInTheDocument();
    // un conteggio non è una cifra in euro
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('un secondo tocco lo richiude', () => {
    render(<ComeSiCalcola spiegazione={spiegazione} />);
    const pulsante = screen.getByRole('button', { name: 'Come si calcola?' });
    fireEvent.click(pulsante);
    fireEvent.click(pulsante);
    expect(screen.queryByText(/Spese comuni/)).not.toBeInTheDocument();
  });

  it('nessuna parola vietata', () => {
    const { container } = render(<ComeSiCalcola spiegazione={spiegazione} />);
    fireEvent.click(screen.getByRole('button', { name: 'Come si calcola?' }));
    assertNessunaParolaVietata(container);
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CasaHome } from '@/app/casa/CasaHome';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';
import type { CasaCorrente } from '@/lib/data/households';

const fabio = { householdId: 'h1', userId: 'u1', displayName: 'Fabio', joinedAt: '2026-01-01', slot: 1, attivo: true };
const anna = { householdId: 'h1', userId: 'u2', displayName: 'Anna', joinedAt: '2026-01-02', slot: 2, attivo: true };

const casa: CasaCorrente = {
  household: { id: 'h1', nome: 'Casa Rossi', createdAt: '2026-01-01', archiviataIl: null },
  members: [fabio, anna],
  invite: null,
  me: fabio,
};

describe('CasaHome', () => {
  it('mostra il nome della casa e i nomi dei membri', () => {
    render(<CasaHome casa={casa} />);
    expect(screen.getByRole('heading', { name: 'Casa Rossi' })).toBeInTheDocument();
    expect(screen.getByText(/Fabio/)).toBeInTheDocument();
    expect(screen.getByText(/Anna/)).toBeInTheDocument();
  });

  it('ha il link Impostazioni verso /casa/impostazioni', () => {
    render(<CasaHome casa={casa} />);
    expect(screen.getByRole('link', { name: 'Impostazioni' })).toHaveAttribute('href', '/casa/impostazioni');
  });

  it('non contiene parole vietate', () => {
    const { container } = render(<CasaHome casa={casa} />);
    assertNessunaParolaVietata(container);
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CasaHome } from '@/app/casa/CasaHome';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';
import type { CasaCorrente } from '@/lib/data/households';
import type { PlanBundle } from '@/lib/data/householdPlans';

const fabio = { householdId: 'h1', userId: 'u1', displayName: 'Fabio', joinedAt: '2026-01-01', slot: 1, attivo: true };
const anna = { householdId: 'h1', userId: 'u2', displayName: 'Anna', joinedAt: '2026-01-02', slot: 2, attivo: true };

const casa: CasaCorrente = {
  household: { id: 'h1', nome: 'Casa Rossi', createdAt: '2026-01-01', archiviataIl: null },
  members: [fabio, anna],
  invite: null,
  me: fabio,
};

function piano(legato: boolean): PlanBundle {
  const base = {
    planId: 'p1',
    redditoNettoMensile: 1000,
    redditoIrregolare: false,
    percentuale: null,
    inCasaDal: null,
    esceDal: null,
  };
  return {
    plan: {
      id: 'p1',
      householdId: 'h1',
      validoDal: '2026-12-01',
      giornoVersamento: 5,
      regola: 'parti_uguali',
      cuscinettoObiettivo: 0,
      cuscinettoQuotaMensile: 0,
      arrotondamento: 10,
      totaleMensile: 1380,
      createdAt: '2026-11-08T00:00:00Z',
    },
    items: [],
    shares: [
      { ...base, slot: 1, userId: 'u1', displayName: 'Fabio', quotaMensile: 690 },
      { ...base, slot: 2, userId: legato ? 'u2' : null, displayName: 'Anna', quotaMensile: 690 },
    ],
  };
}

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

  it('senza piano invita a calcolare la quota con il link a /casa/quota', () => {
    render(<CasaHome casa={casa} piano={null} />);
    expect(screen.getByRole('link', { name: 'Calcolate la nostra quota' })).toHaveAttribute('href', '/casa/quota');
  });

  it('con un piano attivo mostra lo stato e il totale', () => {
    render(<CasaHome casa={casa} piano={piano(true)} />);
    expect(screen.getByText(/Attivo: totale da versare ogni mese/)).toHaveTextContent('1.380 €');
    expect(screen.queryByText(/Diventa attivo/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Vedi la quota' })).toHaveAttribute('href', '/casa/quota');
  });

  it('con un piano in bozza dice chi manca', () => {
    render(<CasaHome casa={casa} piano={piano(false)} />);
    expect(screen.getByText(/Bozza: totale da versare ogni mese/)).toBeInTheDocument();
    expect(screen.getByText('Diventa attivo quando entra anche Anna')).toBeInTheDocument();
  });

  it('non contiene parole vietate', () => {
    const { container } = render(<CasaHome casa={casa} piano={piano(false)} />);
    assertNessunaParolaVietata(container);
  });
});

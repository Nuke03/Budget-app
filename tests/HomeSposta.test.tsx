import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

const replace = vi.hoisted(() => vi.fn());
const query = vi.hoisted(() => ({ valore: '' }));
const foglio = vi.hoisted(() => vi.fn());
const foglioRimetti = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace }),
  useSearchParams: () => new URLSearchParams(query.valore),
}));
vi.mock('@/app/impara/primi-passi/actions', () => ({
  nascondiPrimiPassi: vi.fn(async () => {}),
  proponiLezione: vi.fn(async () => {}),
}));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ rpc: vi.fn() }) }));
vi.mock('@/app/sposta/SpostaFoglio', () => ({
  SpostaFoglio: (p: { iniziale?: unknown }): ReactNode => {
    foglio(p);
    return <div>foglio-sposta</div>;
  },
}));

vi.mock('@/app/rientri/RimettiARateFoglio', () => ({
  RimettiARateFoglio: (p: { scelta?: string; destinazioni: unknown[]; notaCasa?: string }): ReactNode => {
    foglioRimetti(p);
    return <div>foglio-rimetti</div>;
  },
}));

import { HomeDashboard } from '@/app/HomeDashboard';
import type { SituazioneRientroConto } from '@/lib/calculations/rientri';

const conto = (id: string, nome: string, extra = {}) => ({
  id,
  nome,
  saldoAttuale: 100,
  contaInDisponibile: true,
  targetSaldo: null,
  archiviato: false,
  ...extra,
});
const accounts = [conto('corr', 'Corrente'), conto('ris', 'Risparmio', { contaInDisponibile: false }), conto('tasse', 'Tasse', { contaInDisponibile: false })];
const rientriConti = [
  {
    rientro: { id: 'r1', accountId: 'ris' },
    maturato: 120,
    spostato: 0,
    daSpostare: 120,
    finito: false,
  },
] as unknown as SituazioneRientroConto[];

function monta() {
  return render(
    <HomeDashboard
      disponibileLibero={500}
      margineGiornaliero={20}
      dataTarget="2026-12-31T00:00:00Z"
      accounts={accounts}
      categories={[]}
      goals={[]}
      righe={[]}
      andamento={{ spesoFinora: 0, solito: null, mesiConfronto: 0, curva: [], perCategoria: [] }}
      consiglio={{ tipo: 'in_linea', testo: 'x', perche: 'y', lezione: 'dove-vanno' }}
      prossimo={null}
      rientriConti={rientriConti}
      oggi="2026-11-20"
    />,
  );
}

beforeEach(() => {
  replace.mockClear();
  foglio.mockClear();
  foglioRimetti.mockClear();
  query.valore = '';
});

describe('Home: foglio Sposta dall indirizzo', () => {
  it('?sposta=<rientro> apre il foglio già compilato e ripulisce l indirizzo', () => {
    query.valore = 'sposta=r1';
    monta();
    expect(screen.getByText('foglio-sposta')).toBeInTheDocument();
    expect(foglio.mock.calls[0][0].iniziale).toEqual({ daAccountId: 'corr', aAccountId: 'ris', importo: 120 });
    expect(replace).toHaveBeenCalledWith('/');
  });

  it('?sposta=1 apre il foglio vuoto', () => {
    query.valore = 'sposta=1';
    monta();
    expect(screen.getByText('foglio-sposta')).toBeInTheDocument();
    expect(foglio.mock.calls[0][0].iniziale).toBeUndefined();
    expect(replace).toHaveBeenCalledWith('/');
  });

  it('senza parametro il foglio non c è', () => {
    monta();
    expect(screen.queryByText('foglio-sposta')).not.toBeInTheDocument();
  });
});

describe('Home: foglio Rimetti a rate dall indirizzo', () => {
  it('?rimetti=1 apre il foglio senza scelta, con conti risparmio, cassetti e cassetti di casa', () => {
    query.valore = 'rimetti=1';
    render(
      <HomeDashboard
        disponibileLibero={500}
        margineGiornaliero={20}
        dataTarget="2026-12-31T00:00:00Z"
        accounts={accounts}
        categories={[]}
        goals={[{ id: 'g1', nome: 'Vacanza', stato: 'aperto', accantonato: 0, specoCollegato: 300 } as never]}
        rientri={[{ id: 'r1', goalId: 'g1', accountId: null, importo: 100, mesi: 2, creatoIl: '2026-11-01', stato: 'aperto', fermatoIl: null } as never]}
        casa={{
          aggiunta: { householdId: 'h1', meUserId: 'me', nomi: [{ userId: 'me', nome: 'Fabio' }, { userId: 'm', nome: 'Miriam' }], conti: [], categorie: [], obiettivi: [{ id: 'g9', nome: 'Gas', stato: 'aperto' }], spesoDaRientrare: { g9: 120 } },
          stato: null,
        } as never}
        piva={{ contoTasseId: 'tasse', categoriaFatturatoId: 'x', percentuale: 20, inSospeso: [], stipendio: null, scadenze: [], fatture: [] } as never}
        righe={[]}
        andamento={{ spesoFinora: 0, solito: null, mesiConfronto: 0, curva: [], perCategoria: [] }}
        consiglio={{ tipo: 'in_linea', testo: 'x', perche: 'y', lezione: 'dove-vanno' }}
        prossimo={null}
        oggi="2026-11-20"
      />,
    );
    expect(screen.getByText('foglio-rimetti')).toBeInTheDocument();
    const p = foglioRimetti.mock.calls[0][0];
    expect(p.scelta).toBeUndefined();
    expect(p.destinazioni).toEqual([
      { tipo: 'conto', id: 'ris', nome: 'Risparmio' },
      { tipo: 'cassetto', id: 'g1', nome: 'Vacanza', spesoDaRientrare: 250 },
      { tipo: 'cassetto-casa', id: 'g9', nome: 'Gas', householdId: 'h1', spesoDaRientrare: 120 },
    ]);
    expect(p.notaCasa).toBe('Lo vedrà anche Miriam.');
    expect(replace).toHaveBeenCalledWith('/');
  });

  it('?rimetti=<id> preseleziona quel cassetto', () => {
    query.valore = 'rimetti=g1';
    monta();
    expect(foglioRimetti.mock.calls[0][0].scelta).toBe('g1');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

const replace = vi.hoisted(() => vi.fn());
const query = vi.hoisted(() => ({ valore: '' }));
const foglio = vi.hoisted(() => vi.fn());
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

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuotaClient } from '@/app/casa/quota/QuotaClient';
import type { PlanBundle } from '@/lib/data/householdPlans';
import type { PropostaStima } from '@/lib/calculations/casa/stimaVsReale';
import type { HouseholdMember } from '@/lib/types';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/data/stime', () => ({ applicaStima: vi.fn(), ignoraStima: vi.fn() }));

const membro = (userId: string, displayName: string, slot: number): HouseholdMember => ({
  householdId: 'h1', userId, displayName, joinedAt: '2026-01-01', slot, attivo: true,
});

const piano: PlanBundle = {
  plan: {
    id: 'p1', householdId: 'h1', validoDal: '2026-10-01', giornoVersamento: 5, regola: 'parti_uguali',
    cuscinettoObiettivo: 100, cuscinettoQuotaMensile: 10, arrotondamento: 10, totaleMensile: 1380, createdAt: '2026-09-20T10:00:00Z',
  },
  items: [
    { id: 'i1', planId: 'p1', nome: 'Luce', categoriaId: 'c1', frequenzaMesi: 2, importoRicorrenza: 110, importoMensile: 55, origineStima: 'suggerita', goalId: null, stimaIgnorataConN: null, ordine: 0 },
    { id: 'i2', planId: 'p1', nome: 'Gas', categoriaId: 'c2', frequenzaMesi: 2, importoRicorrenza: 110, importoMensile: 55, origineStima: 'suggerita', goalId: null, stimaIgnorataConN: null, ordine: 1 },
    { id: 'i3', planId: 'p1', nome: 'Affitto', categoriaId: null, frequenzaMesi: 1, importoRicorrenza: 1000, importoMensile: 1000, origineStima: 'utente', goalId: null, stimaIgnorataConN: null, ordine: 2 },
  ],
  shares: [
    { planId: 'p1', slot: 1, userId: 'u1', displayName: 'Fabio', redditoNettoMensile: 1000, redditoIrregolare: false, percentuale: null, inCasaDal: null, esceDal: null, quotaMensile: 685 },
    { planId: 'p1', slot: 2, userId: 'u2', displayName: 'Anna', redditoNettoMensile: 1000, redditoIrregolare: false, percentuale: null, inCasaDal: null, esceDal: null, quotaMensile: 685 },
  ],
};

const proposta = (itemId: string, nome: string): PropostaStima => ({
  itemId, nome, categoriaId: 'c', frequenzaMesi: 2, importoMensileAttuale: 55, mediaReale: 142,
  nuovoMensile: 71, nuovoImportoRicorrenza: 142, n: 3, unita: 'bollette',
});

function pagina(extra: Partial<React.ComponentProps<typeof QuotaClient>> = {}) {
  return render(
    <QuotaClient
      householdId="h1"
      meUserId="u1"
      meseCorrente="2026-11-01"
      membri={[membro('u1', 'Fabio', 1), membro('u2', 'Anna', 2)]}
      piani={[piano]}
      slotMassimo={2}
      validoDalStima="2026-12-01"
      {...extra}
    />,
  );
}

describe('QuotaClient: stima contro reale', () => {
  it('una sola card sopra il piano attuale; le altre dietro "Altre N stime da rivedere"', () => {
    const { container } = pagina({ proposte: [proposta('i1', 'Luce'), proposta('i2', 'Gas')] });
    expect(screen.getAllByRole('button', { name: 'Usa 71 € al mese' })).toHaveLength(1);
    expect(screen.getByText(/^Luce: avete previsto/)).toBeInTheDocument();
    expect(screen.queryByText(/^Gas: avete previsto/)).not.toBeInTheDocument();
    const rivedi = screen.getByRole('button', { name: 'Rivedi la quota' });
    const card = screen.getByRole('button', { name: 'Usa 71 € al mese' });
    expect(card.compareDocumentPosition(rivedi) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Altre 1 stima da rivedere' }));
    expect(screen.getAllByRole('button', { name: 'Usa 71 € al mese' })).toHaveLength(2);
    expect(screen.getByText(/^Gas: avete previsto/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Altre/ })).not.toBeInTheDocument();
    assertNessunaParolaVietata(container);
  });

  it('con una sola proposta non ci sono le altre', () => {
    const { container } = pagina({ proposte: [proposta('i1', 'Luce')] });
    expect(screen.queryByRole('button', { name: /^Altre/ })).not.toBeInTheDocument();
    assertNessunaParolaVietata(container);
  });

  it('senza proposte non ci sono card', () => {
    pagina();
    expect(screen.queryByRole('button', { name: 'Usa 71 € al mese' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rivedi la quota' })).toBeInTheDocument();
  });

  it('con una modifica già programmata le card rimandano a Rivedi la quota', () => {
    pagina({ proposte: [proposta('i1', 'Luce')], programmata: true });
    expect(screen.queryByRole('button', { name: 'Usa 71 € al mese' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Rivedi la quota' })).toHaveAttribute('href', '/casa/quota');
  });

  it('senza piano parte la procedura guidata, senza card', () => {
    pagina({ piani: [], proposte: [proposta('i1', 'Luce')] });
    expect(screen.queryByRole('button', { name: 'Usa 71 € al mese' })).not.toBeInTheDocument();
  });
});

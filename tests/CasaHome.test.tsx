import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CasaHome } from '@/app/casa/CasaHome';
import { computeDisponibileCasa } from '@/lib/calculations/casa/disponibileCasa';
import type { CasaAggiunta } from '@/lib/loadCasaData';
import type { Account } from '@/lib/types';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/data/transactions', () => ({ createTransaction: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/data/accounts', () => ({ adjustAccountBalance: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/data/transfers', () => ({ recordTransfer: vi.fn().mockResolvedValue('t1'), messaggioErroreTrasferimento: () => 'errore' }));
vi.mock('@/lib/data/casaSetup', () => ({ creaContoComune: vi.fn().mockResolvedValue({}) }));

import { creaContoComune } from '@/lib/data/casaSetup';
import { recordTransfer } from '@/lib/data/transfers';
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

  it('un piano attivo che parte in un mese futuro dice da quando parte', () => {
    const { container } = render(<CasaHome casa={casa} piano={piano(true)} meseCorrente="2026-11-01" />);
    expect(screen.getByText(/Parte da dicembre 2026: totale da versare ogni mese/)).toHaveTextContent('1.380 €');
    expect(screen.queryByText(/Attivo/)).not.toBeInTheDocument();
    assertNessunaParolaVietata(container);
  });

  it('un piano che è già partito resta Attivo', () => {
    render(<CasaHome casa={casa} piano={piano(true)} meseCorrente="2026-12-01" />);
    expect(screen.getByText(/Attivo: totale da versare ogni mese/)).toBeInTheDocument();
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

  describe('con le finanze', () => {
    const conto: Account = {
      id: 'ac', nome: 'Conto comune', saldoAttuale: 870, contaInDisponibile: true, targetSaldo: null,
    };
    function aggiunta(conti: Account[]): CasaAggiunta {
      return {
        householdId: 'h1',
        meUserId: 'u1',
        nomi: [
          { userId: 'u1', nome: 'Fabio' },
          { userId: 'u2', nome: 'Anna' },
        ],
        conti,
        categorie: [{ id: 'cc', nome: 'Bollette', tipo: 'expense', colore: null, archiviata: false }],
        obiettivi: [],
      };
    }
    function finanze(conti: Account[]) {
      return {
        disponibile: computeDisponibileCasa({ conti, obiettivi: [], today: new Date('2026-11-09T10:00:00Z') }),
        conti,
        ultimeSpese: [
          {
            id: 't1', tipo: 'expense' as const, importo: 64.2, data: '2026-11-05', categoriaId: 'cc',
            accountId: 'ac', goalId: null, descrizione: 'Luce', nota: null, createdAt: '', pagataDaUserId: 'u2',
          },
        ],
        nomi: { u1: 'Fabio', u2: 'Anna' },
        aggiunta: aggiunta(conti),
      };
    }

    it('con finanze mostra il disponibile casa 870,00 e il pannello Come si calcola', () => {
      const { container } = render(<CasaHome casa={casa} finanze={finanze([conto])} />);
      expect(screen.getByText('Disponibile casa')).toBeInTheDocument();
      expect(screen.getAllByText(/870,00/).length).toBeGreaterThan(0);
      fireEvent.click(screen.getByRole('button', { name: 'Come si calcola?' }));
      expect(screen.getByRole('button', { name: 'Come si calcola?' })).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText('Luce')).toBeInTheDocument();
      expect(screen.getAllByText('Anna').length).toBeGreaterThan(1);
      expect(screen.getByRole('link', { name: 'Vedi tutte' })).toHaveAttribute('href', '/casa/movimenti');
      assertNessunaParolaVietata(container);
    });

    it('senza conto comune mostra il modulo e crea il conto', async () => {
      render(<CasaHome casa={casa} finanze={finanze([])} />);
      expect(screen.getByText('Aprite il conto comune qui')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Conto comune')).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('Saldo attuale'), { target: { value: '120,50' } });
      fireEvent.click(screen.getByRole('button', { name: 'Apri il conto' }));
      await waitFor(() =>
        expect(creaContoComune).toHaveBeenCalledWith(expect.anything(), 'h1', {
          nome: 'Conto comune',
          saldoAttuale: 120.5,
        })
      );
      await waitFor(() => expect(refresh).toHaveBeenCalled());
    });

    it('il pulsante + apre il foglio in modalità Casa senza selettore', () => {
      render(<CasaHome casa={casa} finanze={finanze([conto])} />);
      fireEvent.click(screen.getByLabelText('Aggiungi spesa di casa'));
      expect(screen.getByText('Chi ha pagato')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Personale' })).not.toBeInTheDocument();
      expect(screen.getByText('Lo vedrà anche Anna')).toBeInTheDocument();
    });

    describe('versamenti e crediti', () => {
      const registri = {
        righe: { u1: [{ mese: '2026-12-01', atteso: 690, versato: 690, mancano: 0 }], u2: [{ mese: '2026-12-01', atteso: 690, versato: 300, mancano: 390 }] },
        debiti: [],
        crediti: { u1: 45, u2: 0 },
      };
      const contiPersonali: Account[] = [
        { id: 'pf', nome: 'Conto Fabio', saldoAttuale: 500, contaInDisponibile: true, targetSaldo: null },
      ];
      const monta = () =>
        render(
          <CasaHome
            casa={casa}
            piano={piano(true)}
            meseCorrente="2026-12-01"
            finanze={{ ...finanze([conto]), ...registri, contiPersonali }}
          />
        );

      it('mostra i pannelli con le quote del mese e il credito in attesa', () => {
        const { container } = monta();
        expect(screen.getByText('Fabio 690 di 690 € fatto')).toBeInTheDocument();
        expect(screen.getByText('Anna 300 di 690 € mancano 390 €')).toBeInTheDocument();
        expect(screen.getByText('In attesa del rimborso: 45 €')).toBeInTheDocument();
        assertNessunaParolaVietata(container);
      });

      it('Registra un versamento apre il modulo e a salvataggio riuscito ricarica e chiude', async () => {
        monta();
        fireEvent.click(screen.getByRole('button', { name: 'Registra un versamento' }));
        fireEvent.change(screen.getByLabelText('Importo'), { target: { value: '390' } });
        fireEvent.click(screen.getByRole('button', { name: 'Registra' }));
        await waitFor(() => expect(refresh).toHaveBeenCalled());
        expect(recordTransfer).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ causale: 'versamento', importo: 390, daAccountId: 'pf', aAccountId: 'ac' })
        );
        await waitFor(() => expect(screen.queryByLabelText('Importo')).toBeNull());
      });

      it('Rinuncia al credito chiede conferma e registra un rimborso a proprio favore', async () => {
        monta();
        fireEvent.click(screen.getByRole('button', { name: 'Rinuncia' }));
        expect(screen.getByText(/Chiudi il credito di 45 €.*Da qui non si può annullare/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Chiudi il credito' }));
        await waitFor(() =>
          expect(recordTransfer).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
              causale: 'rimborso',
              beneficiarioUserId: 'u1',
              soloRegistrazione: true,
              importo: 45,
            })
          )
        );
      });
    });
  });
});

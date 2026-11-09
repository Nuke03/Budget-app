import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import { HomeDashboard } from '@/app/HomeDashboard';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({}),
}));

vi.mock('@/lib/data/transactions', () => ({
  createTransaction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/data/accounts', () => ({
  updateAccountBalance: vi.fn().mockResolvedValue(undefined),
  adjustAccountBalance: vi.fn().mockResolvedValue(undefined),
}));

import { adjustAccountBalance, updateAccountBalance } from '@/lib/data/accounts';
import type { CasaPerHome } from '@/lib/loadHomeData';
import type { CasaStato } from '@/lib/loadCasaStato';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

const T0 = '2026-01-01T00:00:00Z';
const fabio = { householdId: 'h1', userId: 'u1', displayName: 'Fabio', joinedAt: T0, slot: 1, attivo: true };
const anna = { householdId: 'h1', userId: 'u2', displayName: 'Anna', joinedAt: T0, slot: 2, attivo: true };

function casaPerHome(stato: Partial<CasaStato> = {}): CasaPerHome {
  return {
    aggiunta: {
      householdId: 'h1',
      meUserId: 'u1',
      nomi: [
        { userId: 'u1', nome: 'Fabio' },
        { userId: 'u2', nome: 'Anna' },
      ],
      conti: [],
      categorie: [],
      obiettivi: [],
    },
    stato: {
      householdId: 'h1',
      nomeCasa: 'Casa',
      me: fabio,
      membri: [fabio, anna],
      piano: null,
      righe: [],
      riservaVersamento: 0,
      debiti: [],
      debitoDaRestituire: 0,
      crediti: { u1: 0, u2: 0 },
      avvisoArretrati: false,
      controlli: { ultimoControllo: null, ultimoCheckinMese: null },
      ...stato,
    },
  };
}

const accounts = [
  { id: '1', nome: 'Conto corrente', saldoAttuale: 870, contaInDisponibile: true, targetSaldo: null },
];
const goals = [
  {
    id: '1',
    nome: 'Telepass',
    importoTarget: 130,
    modalita: 'bloccato' as const,
    scadenza: null,
    categoriaId: null,
    ricorrente: false,
    frequenzaMesi: null,
    stato: 'aperto' as const,
    createdAt: '2026-02-01T00:00:00Z',
    accantonato: 130,
  },
];

describe('HomeDashboard', () => {
  it('mostra il disponibile libero e il margine giornaliero', () => {
    render(
      <HomeDashboard
        disponibileLibero={870}
        margineGiornaliero={29}
        dataTarget="2026-07-01T00:00:00Z"
        accounts={accounts}
        categories={[]}
        goals={goals}
      />
    );

    expect(screen.getByText(/870,00/)).toBeInTheDocument();
    expect(screen.getByText(/29,00/)).toBeInTheDocument();
  });

  it('mostra il dettaglio conti/obiettivi solo dopo il click', () => {
    render(
      <HomeDashboard
        disponibileLibero={870}
        margineGiornaliero={29}
        dataTarget="2026-07-01T00:00:00Z"
        accounts={accounts}
        categories={[]}
        goals={goals}
      />
    );

    expect(screen.queryByText('Conto corrente')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Mostra dettaglio'));

    expect(screen.getByText('Conto corrente')).toBeInTheDocument();
    expect(screen.getByText(/Telepass/)).toBeInTheDocument();
  });

  it('nel dettaglio mostra la quota accantonata (non il target) per un obiettivo dilazionato e separa i conti esclusi dal disponibile', () => {
    const accountsConFondo = [
      ...accounts,
      { id: '2', nome: 'Fondo emergenza', saldoAttuale: 500, contaInDisponibile: false, targetSaldo: null },
    ];
    const goalsDilazionato = [
      {
        id: '2',
        nome: 'Vacanza',
        importoTarget: 300,
        modalita: 'dilazionato' as const,
        scadenza: '2026-12-01',
        categoriaId: null,
        ricorrente: false,
        frequenzaMesi: null,
        stato: 'aperto' as const,
        createdAt: '2026-01-01T00:00:00Z',
        accantonato: 150,
      },
    ];

    render(
      <HomeDashboard
        disponibileLibero={720}
        margineGiornaliero={29}
        dataTarget="2026-07-01T00:00:00Z"
        accounts={accountsConFondo}
        categories={[]}
        goals={goalsDilazionato}
      />
    );

    fireEvent.click(screen.getByText('Mostra dettaglio'));

    // Mostra la quota maturata (150), non l'intero importoTarget (300).
    expect(screen.getByText(/150,00/)).toBeInTheDocument();
    expect(screen.queryByText(/300,00/)).not.toBeInTheDocument();

    // Il conto escluso dal disponibile è mostrato ma etichettato come tale.
    expect(screen.getByText(/Fondo emergenza \(non conta nel disponibile\)/)).toBeInTheDocument();
  });

  it('scarica una spesa dal saldo del conto selezionato con un delta quando si aggiunge una transazione', async () => {
    render(
      <HomeDashboard
        disponibileLibero={870}
        margineGiornaliero={29}
        dataTarget="2026-07-01T00:00:00Z"
        accounts={accounts}
        categories={[]}
        goals={goals}
      />
    );

    fireEvent.click(screen.getByLabelText('Aggiungi transazione'));
    fireEvent.change(screen.getByLabelText('Importo'), { target: { value: '26' } });
    fireEvent.change(screen.getByLabelText('Descrizione'), { target: { value: 'Spesa' } });
    fireEvent.click(screen.getByText('Salva'));

    await waitFor(() => {
      expect(adjustAccountBalance).toHaveBeenCalledWith(expect.anything(), '1', -26);
      expect(updateAccountBalance).not.toHaveBeenCalled();
    });
  });

  it('con una casa passata mostra il selettore nel foglio', () => {
    render(
      <HomeDashboard
        disponibileLibero={870}
        margineGiornaliero={29}
        dataTarget="2026-07-01T00:00:00Z"
        accounts={accounts}
        categories={[]}
        goals={goals}
        meUserId="u1"
        casa={casaPerHome()}
      />
    );
    fireEvent.click(screen.getByLabelText('Aggiungi transazione'));
    expect(screen.getByRole('button', { name: 'Personale' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Casa' })).toBeInTheDocument();
  });

  describe('riserva della casa nel dettaglio', () => {
    const base = {
      disponibileLibero: 223,
      margineGiornaliero: 7,
      dataTarget: '2026-07-01T00:00:00Z',
      accounts,
      categories: [],
      goals: [],
      meUserId: 'u1',
    };
    const conRiserva = casaPerHome({
      righe: [{ mese: '2026-11-01', atteso: 777, versato: 0, mancano: 777 }],
      riservaVersamento: 777,
    });

    it('mostra Versamento alla casa, novembre con segno meno solo a dettaglio aperto', () => {
      render(<HomeDashboard {...base} casa={conRiserva} />);
      expect(screen.queryByText('Versamento alla casa, novembre')).not.toBeInTheDocument();
      fireEvent.click(screen.getByText('Mostra dettaglio'));
      const riga = screen.getByText('Versamento alla casa, novembre').parentElement as HTMLElement;
      expect(riga).toHaveTextContent('-777,00 €');
    });

    it('mostra le righe informative del credito e del debito dell altro senza sommarle', () => {
      const stato = casaPerHome({
        crediti: { u1: 45, u2: 0 },
        debiti: [
          { debitoreId: 'u2', creditoreId: 'u1', importo: 603, mesi: [{ mese: '2026-11-01', importo: 603, versato: 603 }] },
        ],
        avvisoArretrati: true,
      });
      render(<HomeDashboard {...base} casa={stato} />);
      fireEvent.click(screen.getByText('Mostra dettaglio'));
      expect(screen.getByText('Dalla casa ti spettano 45 €')).toBeInTheDocument();
      expect(screen.getByText('Anna deve a te 603 €, quota di novembre')).toBeInTheDocument();
      expect(screen.getByText(/Sono più di due mesi di versamenti da registrare/)).toBeInTheDocument();
      expect(screen.queryByText(/Da restituire a/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Versamento alla casa/)).not.toBeInTheDocument();
    });

    it('al debitore mostra Da restituire a con segno meno', () => {
      const stato = casaPerHome({
        debiti: [
          { debitoreId: 'u1', creditoreId: 'u2', importo: 603, mesi: [{ mese: '2026-11-01', importo: 603, versato: 603 }] },
        ],
        debitoDaRestituire: 603,
      });
      render(<HomeDashboard {...base} casa={stato} />);
      fireEvent.click(screen.getByText('Mostra dettaglio'));
      expect(screen.getByText('Da restituire a Anna').parentElement).toHaveTextContent('-603,00 €');
    });

    it('senza casa il dettaglio è identico a prima', () => {
      const { container: senza } = render(<HomeDashboard {...base} />);
      fireEvent.click(within(senza).getByText('Mostra dettaglio'));
      const { container: vuota } = render(<HomeDashboard {...base} casa={casaPerHome()} />);
      fireEvent.click(within(vuota).getByText('Mostra dettaglio'));
      expect(vuota.innerHTML).toBe(senza.innerHTML);
      expect(senza).not.toHaveTextContent('Versamento alla casa');
    });

    it('in home compare una sola riga compatta che porta a /casa', () => {
      const piano = { plan: { giornoVersamento: 5 } } as unknown as CasaStato['piano'];
      const stato = casaPerHome({
        piano,
        righe: [{ mese: '2026-11-01', atteso: 776, versato: 0, mancano: 776 }],
        crediti: { u1: 45, u2: 0 },
      });
      const { container } = render(<HomeDashboard {...base} casa={stato} oggi="2026-11-03" />);
      const link = screen.getByRole('link', { name: 'Il tuo versamento di 776 € è da fare entro il 5.' });
      expect(link).toHaveAttribute('href', '/casa');
      expect(screen.queryByText(/In attesa del rimborso/)).not.toBeInTheDocument();
      assertNessunaParolaVietata(container);
    });

    it('con l ultimo controllo di 15 giorni fa la riga compatta porta il controllo del conto', () => {
      const stato = casaPerHome({ controlli: { ultimoControllo: '2026-10-19', ultimoCheckinMese: null } });
      const conConto = {
        ...stato,
        aggiunta: {
          ...stato.aggiunta!,
          conti: [{ id: 'ac', nome: 'Conto comune', saldoAttuale: 500, contaInDisponibile: true, targetSaldo: null }],
        },
      };
      const { container } = render(<HomeDashboard {...base} casa={conConto} oggi="2026-11-03" />);
      expect(screen.getByRole('link', { name: /controllo veloce del conto comune/ })).toHaveAttribute('href', '/casa/controllo/conto');
      assertNessunaParolaVietata(container);
    });

    it('il primo del mese dopo la riga compatta porta il check-in', () => {
      const stato = casaPerHome({
        righe: [
          { mese: '2026-10-01', atteso: 776, versato: 776, mancano: 0 },
          { mese: '2026-11-01', atteso: 776, versato: 776, mancano: 0 },
        ],
        controlli: { ultimoControllo: null, ultimoCheckinMese: '2026-09-01' },
      });
      render(<HomeDashboard {...base} casa={stato} oggi="2026-11-01" />);
      expect(screen.getByRole('link', { name: /check-in di ottobre/ })).toHaveAttribute('href', '/casa');
    });

    it('senza promemoria la riga compatta non compare', () => {
      render(<HomeDashboard {...base} casa={casaPerHome()} oggi="2026-11-03" />);
      expect(screen.queryByRole('link', { name: /versamento|rimborso|restituire/ })).not.toBeInTheDocument();
    });

    it('con la casa ma senza stato il dettaglio dice che la quota non è inclusa', () => {
      const casa = { ...casaPerHome(), stato: null };
      const { container } = render(<HomeDashboard {...base} casa={casa} />);
      expect(screen.queryByText(/Non riesco a leggere la casa/)).not.toBeInTheDocument();
      fireEvent.click(screen.getByText('Mostra dettaglio'));
      expect(
        screen.getByText('Non riesco a leggere la casa: il disponibile non tiene conto della quota.')
      ).toBeInTheDocument();
      assertNessunaParolaVietata(container);
    });

    it('senza casa e con lo stato letto la riga non compare', () => {
      render(<HomeDashboard {...base} casa={null} />);
      fireEvent.click(screen.getByText('Mostra dettaglio'));
      expect(screen.queryByText(/Non riesco a leggere la casa/)).not.toBeInTheDocument();
      cleanup();
      render(<HomeDashboard {...base} casa={casaPerHome()} />);
      fireEvent.click(screen.getByText('Mostra dettaglio'));
      expect(screen.queryByText(/Non riesco a leggere la casa/)).not.toBeInTheDocument();
    });

    it('nessuna parola vietata', () => {
      const { container } = render(
        <HomeDashboard
          {...base}
          casa={casaPerHome({
            righe: conRiserva.stato?.righe ?? [],
            riservaVersamento: 777,
            crediti: { u1: 45, u2: 0 },
            avvisoArretrati: true,
          })}
        />
      );
      fireEvent.click(screen.getByText('Mostra dettaglio'));
      fireEvent.click(screen.getByLabelText('Come si calcola?'));
      assertNessunaParolaVietata(container);
    });
  });
});

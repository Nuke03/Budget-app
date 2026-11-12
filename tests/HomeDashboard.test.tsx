import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as renderRTL, screen, fireEvent, waitFor, within, cleanup, act } from '@testing-library/react';
import type { ReactElement } from 'react';
import { HomeDashboard as HomeBase } from '@/app/HomeDashboard';

const replace = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace }),
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
import { computeDisponibileLibero } from '@/lib/calculations/disponibile';
import { computeAccantonatoFinora } from '@/lib/calculations/accantonato';
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

const ANDAMENTO_VUOTO = { spesoFinora: 0, solito: null, mesiConfronto: 0, curva: [], perCategoria: [] };
const CONSIGLIO = { tipo: 'in_linea', testo: 'Segna la prima spesa.', perche: 'Il libretto parte dal primo movimento.' } as const;
const NUOVI = { righe: [], andamento: ANDAMENTO_VUOTO, consiglio: CONSIGLIO, prossimo: null };

// Le parti del libretto hanno un valore di base: ogni test cambia solo ciò che gli serve.
function HomeDashboard(props: Omit<React.ComponentProps<typeof HomeBase>, 'righe' | 'andamento' | 'consiglio' | 'prossimo'> & Partial<Pick<React.ComponentProps<typeof HomeBase>, 'righe' | 'andamento' | 'consiglio' | 'prossimo'>>) {
  return <HomeBase {...NUOVI} {...props} />;
}
const render = (ui: ReactElement) => renderRTL(ui);

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

    expect(screen.getByTestId('disponibile')).toHaveTextContent('870,00 €');
    expect(screen.getByText(/29 € al giorno/)).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('button', { name: 'Come si calcola?', expanded: false }));

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

    fireEvent.click(screen.getByRole('button', { name: 'Come si calcola?', expanded: false }));

    // Mostra la quota maturata (150), non l'intero importoTarget (300).
    expect(screen.getAllByText(/150,00/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/300,00/)).toHaveLength(0);

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

    act(() => {
      window.dispatchEvent(new CustomEvent('libretto:aggiungi', { detail: { gestito: false } }));
    });
    fireEvent.change(screen.getByLabelText('Importo'), { target: { value: '26' } });
    fireEvent.click(screen.getByText('Salva'));

    await waitFor(() => {
      expect(adjustAccountBalance).toHaveBeenCalledWith(expect.anything(), '1', -26);
      expect(updateAccountBalance).not.toHaveBeenCalled();
    });
  });

  it('con ?aggiungi=1 apre il foglio al caricamento e ripulisce l indirizzo', () => {
    window.history.pushState({}, '', '/?aggiungi=1');
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
    expect(screen.getByLabelText('Importo')).toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith('/');
    window.history.pushState({}, '', '/');
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
    act(() => {
      window.dispatchEvent(new CustomEvent('libretto:aggiungi', { detail: { gestito: false } }));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Personale' }));
    expect(screen.getByRole('button', { name: 'Personale', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Casa', pressed: false })).toBeInTheDocument();
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
      fireEvent.click(screen.getByRole('button', { name: 'Come si calcola?', expanded: false }));
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
      fireEvent.click(screen.getByRole('button', { name: 'Come si calcola?', expanded: false }));
      expect(screen.getByText('Dalla casa ti spettano 45 €')).toBeInTheDocument();
      expect(screen.getByText('Anna deve a te 603 €, quota di novembre')).toBeInTheDocument();
      expect(screen.getByText(/Sono più di due mesi di versamenti da registrare/)).toBeInTheDocument();
      expect(screen.queryByText(/Da restituire a/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Versamento alla casa/)).not.toBeInTheDocument();
    });

    it('un debito da Tricount nel dettaglio dice saldo di partenza', () => {
      const stato = casaPerHome({
        debiti: [
          { debitoreId: 'u2', creditoreId: 'u1', importo: 43, mesi: [{ mese: '2026-11-01', importo: 43, versato: 43, origine: 'tricount' }] },
        ],
      });
      render(<HomeDashboard {...base} casa={stato} />);
      fireEvent.click(screen.getByRole('button', { name: 'Come si calcola?', expanded: false }));
      expect(screen.getByText('Anna deve a te 43 €, saldo di partenza da Tricount')).toBeInTheDocument();
    });

    it('al debitore mostra Da restituire a con segno meno', () => {
      const stato = casaPerHome({
        debiti: [
          { debitoreId: 'u1', creditoreId: 'u2', importo: 603, mesi: [{ mese: '2026-11-01', importo: 603, versato: 603 }] },
        ],
        debitoDaRestituire: 603,
      });
      render(<HomeDashboard {...base} casa={stato} />);
      fireEvent.click(screen.getByRole('button', { name: 'Come si calcola?', expanded: false }));
      expect(screen.getByText('Da restituire a Anna').parentElement).toHaveTextContent('-603,00 €');
    });

    it('senza casa il dettaglio è identico a prima', () => {
      const { container: senza } = render(<HomeDashboard {...base} />);
      fireEvent.click(within(senza).getByText('Come si calcola?'));
      const { container: vuota } = render(<HomeDashboard {...base} casa={casaPerHome()} />);
      fireEvent.click(within(vuota).getByText('Come si calcola?'));
      const senzaId = (html: string) => html.replace(/aria-controls="[^"]*"/g, '');
      expect(senzaId(vuota.innerHTML)).toBe(senzaId(senza.innerHTML));
      expect(senza).not.toHaveTextContent('Versamento alla casa');
    });

    it('con la casa ma senza stato il dettaglio dice che la quota non è inclusa', () => {
      const casa = { ...casaPerHome(), stato: null };
      const { container } = render(<HomeDashboard {...base} casa={casa} />);
      expect(screen.queryByText(/Non riesco a leggere la casa/)).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Come si calcola?', expanded: false }));
      expect(
        screen.getByText('Non riesco a leggere la casa: il disponibile non tiene conto della quota.')
      ).toBeInTheDocument();
      assertNessunaParolaVietata(container);
    });

    it('senza casa e con lo stato letto la riga non compare', () => {
      render(<HomeDashboard {...base} casa={null} />);
      fireEvent.click(screen.getByRole('button', { name: 'Come si calcola?', expanded: false }));
      expect(screen.queryByText(/Non riesco a leggere la casa/)).not.toBeInTheDocument();
      cleanup();
      render(<HomeDashboard {...base} casa={casaPerHome()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Come si calcola?', expanded: false }));
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
      fireEvent.click(screen.getByRole('button', { name: 'Come si calcola?', expanded: false }));
      fireEvent.click(screen.getByLabelText('Come si calcola la parte di casa'));
      assertNessunaParolaVietata(container);
    });
  });
});

describe('il libretto', () => {
  const base = {
    disponibileLibero: 1240.5,
    margineGiornaliero: 62,
    dataTarget: '2026-11-27T00:00:00Z',
    accounts: [{ id: '1', nome: 'Conto corrente', saldoAttuale: 1500, contaInDisponibile: true, targetSaldo: null }],
    categories: [],
    goals: [{ ...goals[0], accantonato: 259.5 }],
    oggi: '2026-11-11',
  };
  const righe = [
    { id: 'a', data: '2026-11-11', descrizione: 'Esselunga', importo: 38.2, tipo: 'expense' as const, stima: false, nelMese: 1240.5 },
    { id: 'b', data: '2026-11-10', descrizione: '', importo: 50, tipo: 'expense' as const, stima: true, nelMese: 1202.3 },
    { id: 'c', data: '2026-11-08', descrizione: 'Rimborso Fabio', importo: 25, tipo: 'income' as const, stima: false, nelMese: 1152.3 },
  ];
  const andamento = {
    spesoFinora: 312,
    solito: 280,
    mesiConfronto: 3,
    curva: [
      { giorno: 1, mese: 10, solito: 12 },
      { giorno: 2, mese: 40, solito: 30 },
      { giorno: 3, mese: 312, solito: 280 },
    ],
    perCategoria: [],
  };
  const prossimo = { testo: 'Quota casa 650 € entro il 5 dicembre', href: '/casa', tipo: 'casa' as const };

  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('con dati pieni mostra le sette parti', () => {
    const { container } = render(<HomeDashboard {...base} righe={righe} andamento={andamento} prossimo={prossimo} />);
    expect(screen.getByText('Il mio libretto')).toBeInTheDocument();
    expect(screen.getByText('novembre 2026')).toBeInTheDocument();
    expect(screen.getByText('Disponibile libero')).toBeInTheDocument();
    expect(screen.getByTestId('disponibile')).toHaveTextContent('1.240,50 €');
    expect(screen.getByText(/62 € al giorno/)).toHaveTextContent('62 € al giorno');
    expect(container).toHaveTextContent('fino al 27 novembre');
    expect(container).toHaveTextContent('Hai 1.500 € sui conti, 259,50 € sono già messi da parte');
    expect(container).toHaveTextContent("Questo mese hai speso 312 €, di solito a quest'ora 280 €");
    expect(screen.getByText('Questo mese')).toBeInTheDocument();
    expect(screen.getByText("Di solito a quest'ora")).toBeInTheDocument();
    expect(container).not.toHaveTextContent('linea piena');
    for (const t of ['Data', 'Movimento', 'Importo', 'Nel mese']) expect(screen.getByText(t)).toBeInTheDocument();
    expect(screen.getByText('Esselunga')).toBeInTheDocument();
    expect(screen.getByText('−38,20')).toBeInTheDocument();
    expect(screen.getByText('+25,00')).toBeInTheDocument();
    expect(screen.getAllByText('stima')).toHaveLength(1);
    expect(screen.getByText('Spesa')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tutti i movimenti' })).toHaveAttribute('href', '/history');
    expect(screen.getByRole('link', { name: /Prossimo/ })).toHaveAttribute('href', '/casa');
    expect(screen.getByText('Segna la prima spesa.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Aggiungi transazione')).not.toBeInTheDocument();
    assertNessunaParolaVietata(container);
  });

  it('il Perché apre la spiegazione del consiglio', () => {
    render(<HomeDashboard {...base} />);
    expect(screen.queryByText('Il libretto parte dal primo movimento.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Perché?' }));
    expect(screen.getByText('Il libretto parte dal primo movimento.')).toBeInTheDocument();
  });

  it('il registro vuoto dice che è vuoto, senza prossimo non c è la card', () => {
    render(<HomeDashboard {...base} />);
    expect(screen.getByText('Il libretto è vuoto: la prima spesa che segni compare qui.')).toBeInTheDocument();
    expect(screen.queryByText('Prossimo')).not.toBeInTheDocument();
  });

  it('senza il solito dice quando arriverà il confronto', () => {
    render(<HomeDashboard {...base} />);
    expect(screen.getByText('Dal prossimo mese ti mostro come stai andando rispetto al solito.')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /a confronto con il solito/ })).not.toBeInTheDocument();
  });

  it('Come si calcola? mostra i tre gruppi con i subtotali', () => {
    const casa = casaPerHome({
      righe: [{ mese: '2026-11-01', atteso: 100, versato: 0, mancano: 100 }],
      riservaVersamento: 100,
    });
    render(<HomeDashboard {...base} casa={casa} meUserId="u1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Come si calcola?', expanded: false }));
    const soldi = screen.getByRole('region', { name: 'Soldi tuoi' });
    expect(soldi).toHaveTextContent('1.500,00 €');
    expect(within(soldi).getByText('Conto corrente')).toBeInTheDocument();
    const messi = screen.getByRole('region', { name: 'Già messi da parte' });
    expect(messi).toHaveTextContent('-259,50 €');
    expect(within(messi).getByText('Telepass')).toBeInTheDocument();
    const casaGruppo = screen.getByRole('region', { name: 'Casa' });
    expect(casaGruppo).toHaveTextContent('-100,00 €');
  });

  it('i tre subtotali tornano con la cifra grande e ogni obiettivo dice se è tutto o finora', () => {
    const oggiData = new Date('2026-11-11T12:00:00Z');
    const bloccato = { ...goals[0], id: 'g1', nome: 'Telepass', importoTarget: 130 };
    const dilazionato = {
      ...goals[0],
      id: 'g2',
      nome: 'Vacanza',
      modalita: 'dilazionato' as const,
      importoTarget: 300,
      scadenza: '2027-03-01',
      createdAt: '2026-09-01T00:00:00Z',
    };
    const obiettivi = [bloccato, dilazionato].map((g) => ({ ...g, accantonato: computeAccantonatoFinora(g, oggiData, 0) }));
    const conti = [
      { id: '1', nome: 'Conto corrente', saldoAttuale: 1500, contaInDisponibile: true, targetSaldo: null },
      { id: '2', nome: 'Fondo', saldoAttuale: 400, contaInDisponibile: false, targetSaldo: null },
    ];
    const casa = casaPerHome({
      righe: [{ mese: '2026-11-01', atteso: 100, versato: 0, mancano: 100 }],
      riservaVersamento: 100,
      debiti: [
        { debitoreId: 'u1', creditoreId: 'u2', importo: 60, mesi: [{ mese: '2026-11-01', importo: 60, versato: 60 }] },
      ],
      debitoDaRestituire: 60,
    });
    const disponibile = computeDisponibileLibero(
      conti,
      obiettivi.map((g) => ({ ...g, specoCollegato: 0 })),
      oggiData,
      100,
      60
    );
    render(
      <HomeDashboard
        disponibileLibero={disponibile}
        margineGiornaliero={10}
        dataTarget="2026-11-27T00:00:00Z"
        accounts={conti}
        categories={[]}
        goals={obiettivi}
        casa={casa}
        meUserId="u1"
        oggi="2026-11-11"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Come si calcola?', expanded: false }));
    const subtotale = (nome: string): number => {
      const h = within(screen.getByRole('region', { name: nome })).getByRole('heading');
      const testo = (h.lastElementChild as HTMLElement).textContent ?? '';
      return Number(testo.replace(/[^\d,-]/g, '').replace(',', '.'));
    };
    const somma = subtotale('Soldi tuoi') + subtotale('Già messi da parte') + subtotale('Casa');
    expect(somma).toBeCloseTo(disponibile, 2);
    expect(screen.getByText('tutto messo da parte')).toBeInTheDocument();
    expect(screen.getByText('messo da parte finora')).toBeInTheDocument();
    expect(screen.getByTestId('disponibile').parentElement).toHaveTextContent('messi da parte o da versare');
  });

  it('con l id registrato fra le righe mostra il timbro e l annuncio e cancella la chiave', () => {
    window.sessionStorage.setItem('libretto:registrato', 'a');
    render(<HomeDashboard {...base} righe={righe} />);
    expect(screen.getByText(/REGISTRATO/)).toHaveTextContent('11 NOV');
    const annuncio = document.querySelector('[aria-live="polite"]');
    expect(annuncio).toHaveTextContent('Registrato. Disponibile ora 1.240,50 €');
    expect(window.sessionStorage.getItem('libretto:registrato')).toBeNull();
  });

  it('senza chiave, o con un id che non c è, niente timbro', () => {
    render(<HomeDashboard {...base} righe={righe} />);
    expect(screen.queryByText(/REGISTRATO/)).not.toBeInTheDocument();
    cleanup();
    window.sessionStorage.setItem('libretto:registrato', 'zzz');
    render(<HomeDashboard {...base} righe={righe} />);
    expect(screen.queryByText(/REGISTRATO/)).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem('libretto:registrato')).toBeNull();
  });

  it('nessun verde nei className', () => {
    window.sessionStorage.setItem('libretto:registrato', 'a');
    const { container } = render(<HomeDashboard {...base} righe={righe} andamento={andamento} prossimo={prossimo} />);
    fireEvent.click(screen.getByRole('button', { name: 'Come si calcola?', expanded: false }));
    const classi = Array.from(container.querySelectorAll('[class]'))
      .map((e) => e.getAttribute('class'))
      .join(' ');
    expect(classi).not.toMatch(/green|emerald|teal|lime/);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CardStima } from '@/app/casa/CardStima';
import { proponiStime, type PropostaStima } from '@/lib/calculations/casa/stimaVsReale';
import type { PlanBundle } from '@/lib/data/householdPlans';
import type { BudgetGoal, PlanItem } from '@/lib/types';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/data/stime', () => ({ applicaStima: vi.fn(), ignoraStima: vi.fn() }));
import { applicaStima, ignoraStima } from '@/lib/data/stime';

const voci: PlanItem[] = [
  { id: 'i1', planId: 'P1', nome: 'Luce', categoriaId: 'c1', frequenzaMesi: 2, importoRicorrenza: 110, importoMensile: 55, origineStima: 'suggerita', goalId: 'G1', stimaIgnorataConN: null, ordine: 0 },
  { id: 'i0', planId: 'P1', nome: 'Affitto', categoriaId: null, frequenzaMesi: 1, importoRicorrenza: 1000, importoMensile: 1000, origineStima: 'utente', goalId: null, stimaIgnorataConN: null, ordine: 2 },
  { id: 'i2', planId: 'P1', nome: 'Spesa alimentare', categoriaId: 'c2', frequenzaMesi: 1, importoRicorrenza: 300, importoMensile: 300, origineStima: 'suggerita', goalId: null, stimaIgnorataConN: null, ordine: 1 },
];

function bundle(esceDal: string | null = null): PlanBundle {
  return {
    plan: {
      id: 'P1', householdId: 'H1', validoDal: '2026-10-01', giornoVersamento: 5, regola: 'parti_uguali',
      cuscinettoObiettivo: 100, cuscinettoQuotaMensile: 10, arrotondamento: 10, totaleMensile: 1380, createdAt: '2026-09-20T10:00:00Z',
    },
    items: voci,
    shares: [
      { planId: 'P1', slot: 1, userId: 'u1', displayName: 'Fabio', redditoNettoMensile: 1000, redditoIrregolare: false, percentuale: null, inCasaDal: null, esceDal: null, quotaMensile: 685 },
      { planId: 'P1', slot: 2, userId: 'u2', displayName: 'Anna', redditoNettoMensile: 1000, redditoIrregolare: false, percentuale: null, inCasaDal: null, esceDal, quotaMensile: 685 },
    ],
  };
}

const goal: BudgetGoal = {
  id: 'G1', nome: 'Luce', importoTarget: 110, modalita: 'bloccato', scadenza: '2026-12-31', categoriaId: 'c1',
  ricorrente: true, frequenzaMesi: 2, stato: 'aperto', createdAt: '2026-01-01T00:00:00Z',
};

const spesa = (importo: number, data: string, categoriaId: string) => ({
  tipo: 'expense' as const, importo, data, categoriaId, origine: null,
});
const luce: PropostaStima = proponiStime({
  voci: [voci[0]],
  spese: [spesa(142, '2026-10-05', 'c1'), spesa(142, '2026-08-05', 'c1'), spesa(142, '2026-06-05', 'c1')],
  inizioPiano: '2026-01-01',
  oggi: '2026-11-09',
})[0];
const spesaMese: PropostaStima = proponiStime({
  voci: [voci[2]],
  spese: [spesa(330, '2026-10-05', 'c2'), spesa(330, '2026-09-05', 'c2'), spesa(330, '2026-08-05', 'c2')],
  inizioPiano: '2026-01-01',
  oggi: '2026-11-09',
})[0];

function card(over: Partial<React.ComponentProps<typeof CardStima>> = {}) {
  const onFatto = vi.fn();
  const r = render(
    <CardStima
      proposta={luce}
      bundle={bundle()}
      goal={goal}
      householdId="H1"
      validoDal="2026-12-01"
      programmata={false}
      onFatto={onFatto}
      {...over}
    />,
  );
  return { ...r, onFatto };
}

beforeEach(() => {
  vi.mocked(applicaStima).mockReset();
  vi.mocked(applicaStima).mockResolvedValue(undefined);
  vi.mocked(ignoraStima).mockReset();
  vi.mocked(ignoraStima).mockResolvedValue(undefined);
});

describe('CardStima', () => {
  it('una bolletta: previsto e reale, e cosa cambia nelle quote', () => {
    const { container } = card();
    expect(luce.n).toBe(3);
    expect(screen.getByText('Luce: avete previsto 55 € al mese, le ultime 3 bollette fanno in media 71 € al mese.')).toBeInTheDocument();
    expect(screen.getByText('Con 71 €: Fabio 685 → 695 €, Anna 685 → 695 €.')).toBeInTheDocument();
    expect(
      screen.getByText('La parte messa da parte per questa voce si aggiorna subito; la quota nuova parte da dicembre.'),
    ).toBeInTheDocument();
    assertNessunaParolaVietata(container);
  });

  it('una sola bolletta: la frase non dice "le ultime 3"', () => {
    const una = proponiStime({ voci: [voci[0]], spese: [spesa(142, '2026-10-05', 'c1')], inizioPiano: '2026-01-01', oggi: '2026-11-09' })[0];
    card({ proposta: una });
    expect(screen.getByText("Luce: avete previsto 55 € al mese, l'ultima bolletta fa 71 € al mese.")).toBeInTheDocument();
  });

  it('una voce mensile: la media dei mesi', () => {
    card({ proposta: spesaMese, goal: null });
    expect(
      screen.getByText('Spesa alimentare: avete previsto 300 € al mese, negli ultimi 3 mesi ne sono usciti in media 330 €.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/si aggiorna subito/)).not.toBeInTheDocument();
    expect(screen.getByText('La quota nuova parte da dicembre.')).toBeInTheDocument();
  });

  it('"Come si calcola?" mostra media e passaggi che tornano', () => {
    card();
    fireEvent.click(screen.getByRole('button', { name: 'Come si calcola?' }));
    expect(screen.getByText('Media delle ultime 3 bollette: 142 €')).toBeInTheDocument();
    expect(screen.getByText('Ogni 2 mesi: 142 € / 2 = 71 € al mese')).toBeInTheDocument();
  });

  it('"Usa 71 € al mese" applica una volta sola, anche con il doppio click, poi onFatto', async () => {
    const { onFatto } = card();
    const b = screen.getByRole('button', { name: 'Usa 71 € al mese' });
    fireEvent.click(b);
    fireEvent.click(b);
    await waitFor(() => expect(onFatto).toHaveBeenCalledTimes(1));
    expect(applicaStima).toHaveBeenCalledTimes(1);
    expect(vi.mocked(applicaStima).mock.calls[0][1]).toEqual({
      householdId: 'H1',
      bundle: bundle(),
      proposta: luce,
      goal,
      validoDal: '2026-12-01',
    });
  });

  it('"Non ora" ricorda quante bollette c erano e nasconde la card', async () => {
    const { container } = card();
    fireEvent.click(screen.getByRole('button', { name: 'Non ora' }));
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(ignoraStima).toHaveBeenCalledWith({}, 'H1', 'i1', 3);
    expect(applicaStima).not.toHaveBeenCalled();
  });

  it('errore: messaggio e la card resta', async () => {
    vi.mocked(applicaStima).mockRejectedValue(new Error('boom'));
    const { onFatto } = card();
    fireEvent.click(screen.getByRole('button', { name: 'Usa 71 € al mese' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Salvataggio fallito, controlla la connessione e riprova.');
    expect(onFatto).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Usa 71 € al mese' })).toBeEnabled();
  });

  it('errore su "Non ora": messaggio e la card resta', async () => {
    vi.mocked(ignoraStima).mockRejectedValue(new Error('boom'));
    card();
    fireEvent.click(screen.getByRole('button', { name: 'Non ora' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Non ora' })).toBeInTheDocument();
  });

  it('con una modifica già programmata: niente "Usa", il rimando a Rivedi la quota', () => {
    const { container } = card({ programmata: true });
    expect(screen.queryByRole('button', { name: 'Usa 71 € al mese' })).not.toBeInTheDocument();
    expect(container.textContent).toContain("C'è già una modifica programmata: la trovate in Rivedi la quota.");
    expect(screen.getByRole('link', { name: 'Rivedi la quota' })).toHaveAttribute('href', '/casa/quota');
    assertNessunaParolaVietata(container);
  });

  it('con qualcuno in uscita il piano non si ricalcola: stessa via di uscita', () => {
    const { container } = card({ bundle: bundle('2027-01-01') });
    expect(screen.queryByRole('button', { name: 'Usa 71 € al mese' })).not.toBeInTheDocument();
    // Nessuna versione futura esiste: non si dice che c'è una modifica programmata.
    expect(container.textContent).not.toContain("C'è già una modifica programmata");
    expect(container.textContent).toContain('Per ora non si può aggiornare: rivedi la quota.');
    expect(screen.queryByText(/^Con 71 €/)).not.toBeInTheDocument();
    assertNessunaParolaVietata(container);
  });

  it('chi è già uscito prima del mese nuovo non impedisce la stima', () => {
    card({ bundle: bundle('2026-11-01') });
    expect(screen.getByRole('button', { name: 'Usa 71 € al mese' })).toBeInTheDocument();
  });

  it('"Come si calcola?": gli ingredienti sommano al valore', () => {
    card();
    fireEvent.click(screen.getByRole('button', { name: 'Come si calcola?' }));
    expect(screen.getByText('Stima di prima, al mese')).toBeInTheDocument();
    expect(screen.getByText('Cambia di')).toBeInTheDocument();
    expect(55 + (luce.nuovoMensile - 55)).toBeCloseTo(luce.nuovoMensile, 8);
    const [prima, cambia] = screen.getAllByRole('listitem').map((li) => li.textContent ?? '');
    expect(prima).toContain('55');
    expect(cambia).toContain('16');
  });
});

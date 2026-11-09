import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QuotaWizard } from '@/app/casa/quota/QuotaWizard';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';
import { ESEMPIO_VOCI } from './helpers/esempioCasa';
import { buildPlanVersions } from '@/lib/calculations/casa/pianoVersioni';
import type { PlanBundle, PlanVoceInput } from '@/lib/data/householdPlans';
import type { HouseholdMember, PlanShare } from '@/lib/types';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));
const fakeClient = { id: 'client' };
vi.mock('@/lib/supabase/client', () => ({ createClient: () => fakeClient }));
const savePlan = vi.fn();
vi.mock('@/lib/data/householdPlans', () => ({ savePlan: (...a: unknown[]) => savePlan(...a) }));

const fabio: HouseholdMember = {
  householdId: 'h1',
  userId: 'u1',
  displayName: 'Fabio',
  joinedAt: '2026-01-01',
  slot: 1,
  attivo: true,
};
const giuliaMembro: HouseholdMember = { ...fabio, userId: 'u2', displayName: 'Giulia', slot: 2 };

const share = (over: Partial<PlanShare>): PlanShare => ({
  planId: 'p1',
  slot: 1,
  userId: 'u1',
  displayName: 'Fabio',
  redditoNettoMensile: 1800,
  redditoIrregolare: false,
  percentuale: null,
  inCasaDal: null,
  esceDal: null,
  quotaMensile: 777,
  ...over,
});

function bundle(shares: PlanShare[]): PlanBundle {
  return {
    plan: {
      id: 'p1',
      householdId: 'h1',
      validoDal: '2026-12-01',
      giornoVersamento: 5,
      regola: 'proporzionale',
      cuscinettoObiettivo: 1321,
      cuscinettoQuotaMensile: 59,
      arrotondamento: 10,
      totaleMensile: 1380,
      createdAt: '2026-11-08T00:00:00Z',
    },
    items: ESEMPIO_VOCI.map((v, i) => ({
      id: `i${i}`,
      planId: 'p1',
      nome: v.nome,
      categoriaId: null,
      frequenzaMesi: v.frequenzaMesi,
      importoRicorrenza: v.importoRicorrenza,
      importoMensile: v.importoRicorrenza / v.frequenzaMesi,
      origineStima: 'utente',
      goalId: null,
      stimaIgnorataConN: null,
      ordine: i,
    })),
    shares,
  };
}

function monta(over: Partial<React.ComponentProps<typeof QuotaWizard>> = {}) {
  const onSaved = vi.fn();
  const utente = render(
    <QuotaWizard
      householdId="h1"
      meUserId="u1"
      meseCorrente="2026-12-01"
      membri={[fabio]}
      piani={[]}
      slotMassimo={0}
      onSaved={onSaved}
      {...over}
    />,
  );
  return { onSaved, ...utente };
}

const scrivi = (el: HTMLElement, valore: string) => fireEvent.change(el, { target: { value: valore } });
const avanti = () => fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
const redditi = () => screen.getAllByLabelText(/^Reddito (netto al mese|prudente)$/);

function aggiungiGiulia(reddito = '1400') {
  fireEvent.click(screen.getByRole('button', { name: 'Aggiungi una persona' }));
  scrivi(screen.getByLabelText('Nome'), 'Giulia');
  scrivi(redditi()[1], reddito);
}

// Percorre i passi 1 a 3 con i valori della ricerca: redditi 1800 e 1400, affitto 750,
// assicurazione 96 l'anno, cuscinetto 59. Si ferma sul passo 4.
function finoAlPasso4() {
  scrivi(redditi()[0], '1800');
  aggiungiGiulia();
  avanti();
  scrivi(screen.getByLabelText('Importo Affitto'), '750');
  scrivi(screen.getByLabelText('Importo Assicurazione casa'), '96');
  avanti();
  scrivi(screen.getByLabelText('Ogni mese'), '59');
  avanti();
}

beforeEach(() => {
  savePlan.mockReset();
  savePlan.mockResolvedValue(['plan-1']);
  refresh.mockReset();
});

describe('QuotaWizard: passo 1', () => {
  it('parte dal passo 1 di 5 e Avanti porta al 2 di 5', () => {
    monta();
    expect(screen.getByText('1 di 5')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Quanto entra ogni mese' })).toBeInTheDocument();
    scrivi(redditi()[0], '1800');
    avanti();
    expect(screen.getByText('2 di 5')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Le spese di casa' })).toBeInTheDocument();
  });

  it('chiede i redditi, "Aggiungi una persona" crea un segnaposto con nome e reddito e per ognuno "In casa dal"', () => {
    monta();
    expect(screen.getAllByLabelText('In casa dal')).toHaveLength(1);
    expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi una persona' }));
    expect(screen.getByLabelText('Nome')).toBeInTheDocument();
    expect(redditi()).toHaveLength(2);
    expect(screen.getAllByLabelText('In casa dal')).toHaveLength(2);
  });

  it('con la spunta "il mio reddito cambia" l\'etichetta diventa "Reddito prudente" e compare la frase', () => {
    monta();
    expect(screen.queryByText(/Scrivi una cifra che incassi anche nei mesi magri/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Il mio reddito cambia da mese a mese (partita IVA)'));
    expect(screen.getByLabelText('Reddito prudente')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Scrivi una cifra che incassi anche nei mesi magri. La quota si calcola su questa, il resto lo gestirete a parte.',
      ),
    ).toBeInTheDocument();
  });

  it('mostra "Il reddito che scrivi qui lo vede anche l\'altro."', () => {
    monta();
    expect(screen.getByText("Il reddito che scrivi qui lo vede tutta la casa.")).toBeInTheDocument();
  });

  it('il reddito di una persona legata a un altro membro è in sola lettura quando il piano ha già un valore', () => {
    monta({
      membri: [fabio, giuliaMembro],
      piani: [bundle([share({}), share({ slot: 2, userId: 'u2', displayName: 'Giulia', redditoNettoMensile: 1400 })])],
    });
    const [rFabio, rGiulia] = redditi();
    expect(rFabio).not.toHaveAttribute('readonly');
    expect(rGiulia).toHaveAttribute('readonly');
    expect(rGiulia).toHaveValue('1400');
  });

  it('il reddito di un membro senza valore nel piano è modificabile', () => {
    monta({ membri: [fabio, giuliaMembro], piani: [] });
    const [, rGiulia] = redditi();
    expect(rGiulia).not.toHaveAttribute('readonly');
  });

  it('una posizione con esceDal valorizzato non entra tra le persone di partenza', () => {
    monta({
      piani: [bundle([
        share({}),
        share({ slot: 2, userId: null, displayName: 'Marco', esceDal: '2026-10-01' }),
        share({ slot: 3, userId: null, displayName: 'Giulia', redditoNettoMensile: 1400 }),
      ])],
    });
    expect(redditi()).toHaveLength(2);
    expect(screen.queryByDisplayValue('Marco')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Giulia')).toBeInTheDocument();
  });

  it('redditi vuoti o negativi disabilitano Avanti e nel DOM non compare mai NaN', () => {
    const { container } = monta();
    const avantiBtn = screen.getByRole('button', { name: 'Avanti' });
    expect(avantiBtn).toBeDisabled();
    scrivi(redditi()[0], '-5');
    expect(avantiBtn).toBeDisabled();
    scrivi(redditi()[0], 'abc');
    expect(avantiBtn).toBeDisabled();
    expect(container.textContent).not.toContain('NaN');
  });

  it('1800,5 è accettato', () => {
    monta();
    scrivi(redditi()[0], '1800,5');
    expect(screen.getByRole('button', { name: 'Avanti' })).toBeEnabled();
  });

  it('un segnaposto senza nome blocca Avanti', () => {
    monta();
    scrivi(redditi()[0], '1800');
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi una persona' }));
    scrivi(redditi()[1], '1400');
    expect(screen.getByRole('button', { name: 'Avanti' })).toBeDisabled();
    scrivi(screen.getByLabelText('Nome'), 'Giulia');
    expect(screen.getByRole('button', { name: 'Avanti' })).toBeEnabled();
  });
});

describe('QuotaWizard: passi 2 e 3', () => {
  it('il passo 2 mostra le voci tipiche con "= 55 al mese" per la luce e il totale al mese', () => {
    monta();
    scrivi(redditi()[0], '1800');
    avanti();
    expect(screen.getByLabelText('Importo Luce')).toHaveValue('110');
    expect(screen.getAllByText('= 55 al mese')).toHaveLength(2); // luce e gas
    expect(screen.getByText('= 25 al mese')).toBeInTheDocument(); // TARI
    // senza l'affitto (da scrivere) le altre voci fanno 571,33 euro
    expect(screen.getByText('Totale al mese: 571,33 €')).toBeInTheDocument();
  });

  it("l'affitto è da scrivere: senza cifra Avanti resta disabilitato", () => {
    monta();
    scrivi(redditi()[0], '1800');
    avanti();
    expect(screen.getByRole('button', { name: 'Avanti' })).toBeDisabled();
    scrivi(screen.getByLabelText('Importo Affitto'), '750');
    expect(screen.getByRole('button', { name: 'Avanti' })).toBeEnabled();
    scrivi(screen.getByLabelText('Importo Assicurazione casa'), '96');
    expect(screen.getByText('Totale al mese: 1.321 €')).toBeInTheDocument();
  });

  it('una voce si può togliere e se ne può aggiungere una nuova', () => {
    monta();
    scrivi(redditi()[0], '1800');
    avanti();
    fireEvent.click(screen.getByRole('button', { name: 'Togli Condominio' }));
    expect(screen.queryByLabelText('Importo Condominio')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi una voce' }));
    scrivi(screen.getByLabelText('Nome della voce'), 'Pulizie');
    scrivi(screen.getByLabelText('Importo Pulizie'), '40');
    expect(screen.getByLabelText('Importo Pulizie')).toHaveValue('40');
  });

  it('il passo 3 mostra la definizione di cuscinetto, i mesi di spese e "Sarà pieno tra circa 23 mesi"', () => {
    monta();
    scrivi(redditi()[0], '1800');
    avanti();
    scrivi(screen.getByLabelText('Importo Affitto'), '750');
    scrivi(screen.getByLabelText('Importo Assicurazione casa'), '96');
    avanti();
    expect(screen.getByText('3 di 5')).toBeInTheDocument();
    expect(screen.getByText(/soldi della casa per gli imprevisti/)).toBeInTheDocument();
    expect(screen.getByLabelText('1 mese di spese')).toBeChecked();
    expect(screen.getByText('= 1.321 €')).toBeInTheDocument();
    scrivi(screen.getByLabelText('Ogni mese'), '59');
    expect(screen.getByText('Sarà pieno tra circa 23 mesi.')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('2 mesi di spese'));
    expect(screen.getByText('= 2.642 €')).toBeInTheDocument();
  });
});

describe('QuotaWizard: passo 4 e 5', () => {
  it("cambiando l'assicurazione a 96 l'anno, il cuscinetto a 59 e i redditi a 1800 e 1400, il passo 4 mostra Totale da versare 1.380 € e le tre colonne", () => {
    monta();
    finoAlPasso4();
    expect(screen.getByText('4 di 5')).toBeInTheDocument();
    expect(screen.getByText('Totale da versare ogni mese: 1.380 €')).toBeInTheDocument();

    const testi = (id: string, lista: string) =>
      within(within(screen.getByTestId(`colonna-${id}`)).getByRole('list', { name: lista }))
        .getAllByRole('listitem')
        .map((li) => li.textContent);

    expect(testi('parti_uguali', 'Quote')).toEqual(['Fabio690 €', 'Giulia690 €']);
    expect(testi('parti_uguali', 'Cosa resta')).toEqual(['Fabio1.110 €', 'Giulia710 €']);
    expect(testi('proporzionale', 'Quote')).toEqual(['Fabio777 €', 'Giulia603 €']);
    expect(testi('proporzionale', 'Cosa resta')).toEqual(['Fabio1.023 €', 'Giulia797 €']);
    expect(testi('pari_residuo', 'Quote')).toEqual(['Fabio890 €', 'Giulia490 €']);
    expect(testi('pari_residuo', 'Cosa resta')).toEqual(['Fabio910 €', 'Giulia910 €']);
    expect(testi('proporzionale', 'Peso sul reddito')).toEqual(['Fabio43%', 'Giulia43%']);
  });

  it('la colonna "Secondo il reddito" è selezionata di default e nessuna colonna è presentata come giusta', () => {
    const { container } = monta();
    finoAlPasso4();
    expect(screen.getByRole('radio', { name: 'Secondo il reddito' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Parti uguali' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Stesso residuo' })).not.toBeChecked();
    const testo = (container.textContent ?? '').toLowerCase();
    for (const parola of ['giusta', 'consigliat', 'migliore', 'raccomand']) {
      expect(testo).not.toContain(parola);
    }
    expect(screen.getByText('Ognuno versa la stessa cifra.')).toBeInTheDocument();
    expect(screen.getByText('Ognuno versa la stessa percentuale del proprio reddito.')).toBeInTheDocument();
    expect(screen.getByText('A fine mese restano a tutti gli stessi soldi personali.')).toBeInTheDocument();
  });

  it('il passo 5 mostra "Fabio versa 777 euro e Giulia 603 euro, entro il 5 di ogni mese, da dicembre."', () => {
    monta();
    finoAlPasso4();
    avanti();
    expect(screen.getByText('5 di 5')).toBeInTheDocument();
    expect(
      screen.getByText('Fabio versa 777 euro e Giulia 603 euro, entro il 5 di ogni mese, da dicembre.'),
    ).toBeInTheDocument();
  });

  it('con parti uguali mostra "Ognuno versa 690 euro entro il 5 di ogni mese."', () => {
    monta();
    finoAlPasso4();
    fireEvent.click(screen.getByRole('radio', { name: 'Parti uguali' }));
    avanti();
    expect(screen.getByText('Ognuno versa 690 euro entro il 5 di ogni mese.')).toBeInTheDocument();
  });

  it('se la compagna è un segnaposto mostra "Diventa attivo quando entra anche Giulia"', () => {
    monta();
    finoAlPasso4();
    avanti();
    expect(screen.getByText('Diventa attivo quando entra anche Giulia')).toBeInTheDocument();
  });

  it('partenza non può essere prima di meseCorrente', () => {
    monta();
    finoAlPasso4();
    avanti();
    const select = screen.getByLabelText('Partite dal mese di');
    const opzioni = within(select).getAllByRole('option');
    expect(opzioni).toHaveLength(12);
    expect(opzioni[0]).toHaveTextContent('dicembre 2026');
    expect(opzioni[0]).toHaveValue('2026-12-01');
    expect(within(select).queryByRole('option', { name: 'novembre 2026' })).not.toBeInTheDocument();
    expect(opzioni[11]).toHaveTextContent('novembre 2027');
  });

  it('Confermiamo chiama savePlan con le versioni di buildPlanVersions e poi onSaved', async () => {
    const { onSaved } = monta();
    finoAlPasso4();
    avanti();
    fireEvent.click(screen.getByRole('button', { name: 'Confermiamo' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));

    const voci: PlanVoceInput[] = ESEMPIO_VOCI.map((v, i) => ({
      nome: v.nome,
      categoriaNome: v.nome,
      categoriaId: null,
      frequenzaMesi: v.frequenzaMesi,
      importoRicorrenza: v.importoRicorrenza,
      origineStima: v.chiave === 'affitto' || v.chiave === 'assicurazione' ? 'utente' : 'suggerita',
      goalId: null,
      stimaIgnorataConN: null,
      ordine: i,
    }));
    const atteso = buildPlanVersions({
      persone: [
        { slot: 1, displayName: 'Fabio', userId: 'u1', redditoNetto: 1800, redditoIrregolare: false, inCasaDal: '2026-12-01' },
        { slot: 2, displayName: 'Giulia', userId: null, redditoNetto: 1400, redditoIrregolare: false, inCasaDal: '2026-12-01' },
      ],
      voci,
      cuscinettoObiettivo: 1321,
      cuscinettoQuotaMensile: 59,
      arrotondamento: 10,
      regola: 'proporzionale',
      periodoIniziale: { tipo: 'tutto_a_chi_abita' },
      giornoVersamento: 5,
      partenza: '2026-12-01',
    });
    expect(savePlan).toHaveBeenCalledTimes(1);
    expect(savePlan).toHaveBeenCalledWith(fakeClient, 'h1', atteso);
    expect(atteso).toHaveLength(1);
    expect(atteso[0].quote.map((q) => q.quotaMensile)).toEqual([777, 603]);
    // nessuna scrittura prima di Confermiamo
    expect(onSaved.mock.invocationCallOrder[0]).toBeGreaterThan(savePlan.mock.invocationCallOrder[0]);
  });

  it('non scrive nulla finché non si conferma', () => {
    monta();
    finoAlPasso4();
    avanti();
    expect(savePlan).not.toHaveBeenCalled();
  });

  it('con una sola persona (nessun segnaposto) il wizard calcola e salva con una quota', async () => {
    const { onSaved } = monta();
    scrivi(redditi()[0], '1800');
    avanti();
    scrivi(screen.getByLabelText('Importo Affitto'), '750');
    scrivi(screen.getByLabelText('Importo Assicurazione casa'), '96');
    avanti();
    avanti();
    expect(screen.getByText('4 di 5')).toBeInTheDocument();
    // 1.321 di spese + 66 di cuscinetto (5%), arrotondato a 10
    expect(screen.getByText('Totale da versare ogni mese: 1.390 €')).toBeInTheDocument();
    avanti();
    expect(screen.queryByText(/Diventa attivo/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confermiamo' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const versioni = savePlan.mock.calls[0][2];
    expect(versioni).toHaveLength(1);
    expect(versioni[0].quote).toHaveLength(1);
    expect(versioni[0].quote[0].quotaMensile).toBe(1390);
  });

  it('un errore di salvataggio mostra "Salvataggio fallito, controlla la connessione e riprova."', async () => {
    savePlan.mockRejectedValue(new Error('rete'));
    const { onSaved } = monta();
    finoAlPasso4();
    avanti();
    fireEvent.click(screen.getByRole('button', { name: 'Confermiamo' }));
    expect(await screen.findByText('Salvataggio fallito, controlla la connessione e riprova.')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Confermiamo' })).toBeEnabled();
  });

  it('con redditi a zero la regola secondo il reddito non è disponibile e lo dice in italiano', () => {
    monta();
    scrivi(redditi()[0], '0');
    avanti();
    scrivi(screen.getByLabelText('Importo Affitto'), '750');
    avanti();
    avanti();
    expect(screen.getByRole('radio', { name: 'Secondo il reddito' })).toBeDisabled();
    expect(screen.getByText('Manca il reddito di Fabio.')).toBeInTheDocument();
    // la scelta selezionata non è disponibile: non si va avanti finché non se ne sceglie un'altra
    expect(screen.getByRole('button', { name: 'Avanti' })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'Parti uguali' }));
    expect(screen.getByRole('button', { name: 'Avanti' })).toBeEnabled();
  });
});

describe('QuotaWizard: per questo periodo', () => {
  function conSegnapostoFebbraio() {
    monta();
    scrivi(redditi()[0], '1800');
    aggiungiGiulia();
    scrivi(screen.getAllByLabelText('In casa dal')[1], '2027-02-01');
    avanti();
    scrivi(screen.getByLabelText('Importo Affitto'), '750');
    scrivi(screen.getByLabelText('Importo Assicurazione casa'), '96');
    avanti();
    scrivi(screen.getByLabelText('Ogni mese'), '59');
    avanti();
  }

  it('non compare se tutti abitano in casa dallo stesso mese', () => {
    monta();
    finoAlPasso4();
    expect(screen.queryByText('Per questo periodo')).not.toBeInTheDocument();
  });

  it('se i membri non abitano tutti insieme compare "Per questo periodo" con le tre scelte e le percentuali che non sommano a 100 bloccano', () => {
    conSegnapostoFebbraio();
    expect(screen.getByText('Per questo periodo')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Tutto a chi abita già in casa (100%)' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'La regola normale' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Percentuali a scelta' }));
    scrivi(screen.getByLabelText('Percentuale di Fabio'), '70');
    scrivi(screen.getByLabelText('Percentuale di Giulia'), '20');
    expect(screen.getByText('Le percentuali devono fare 100.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Avanti' })).toBeDisabled();
    scrivi(screen.getByLabelText('Percentuale di Giulia'), '30');
    expect(screen.queryByText('Le percentuali devono fare 100.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Avanti' })).toBeEnabled();
  });

  it('mostra cosa resta a ciascuno per il periodo e salva due versioni', async () => {
    const { onSaved } = monta();
    scrivi(redditi()[0], '1800');
    aggiungiGiulia();
    scrivi(screen.getAllByLabelText('In casa dal')[1], '2027-02-01');
    avanti();
    scrivi(screen.getByLabelText('Importo Affitto'), '750');
    scrivi(screen.getByLabelText('Importo Assicurazione casa'), '96');
    avanti();
    scrivi(screen.getByLabelText('Ogni mese'), '59');
    avanti();
    const periodo = screen.getByTestId('per-questo-periodo');
    expect(periodo).toHaveTextContent('Fabio: versa 1.380 €, resta 420 €');
    expect(periodo).toHaveTextContent('Giulia: versa 0 €, resta 1.400 €');
    avanti();
    expect(screen.getByText('Da dicembre 2026: Fabio versa 1.380 euro, entro il 5 di ogni mese.')).toBeInTheDocument();
    expect(
      screen.getByText('Da marzo 2027: Fabio versa 777 euro e Giulia 603 euro, entro il 5 di ogni mese.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confermiamo' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const versioni = savePlan.mock.calls[0][2];
    expect(versioni.map((v: { validoDal: string }) => v.validoDal)).toEqual(['2026-12-01', '2027-03-01']);
  });

  it('con percentuali 70 e 30 salva 966 e 414 per il primo periodo', async () => {
    const { onSaved } = monta();
    scrivi(redditi()[0], '1800');
    aggiungiGiulia();
    scrivi(screen.getAllByLabelText('In casa dal')[1], '2027-02-01');
    avanti();
    scrivi(screen.getByLabelText('Importo Affitto'), '750');
    scrivi(screen.getByLabelText('Importo Assicurazione casa'), '96');
    avanti();
    scrivi(screen.getByLabelText('Ogni mese'), '59');
    avanti();
    fireEvent.click(screen.getByRole('radio', { name: 'Percentuali a scelta' }));
    scrivi(screen.getByLabelText('Percentuale di Fabio'), '70');
    scrivi(screen.getByLabelText('Percentuale di Giulia'), '30');
    avanti();
    fireEvent.click(screen.getByRole('button', { name: 'Confermiamo' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const versioni = savePlan.mock.calls[0][2];
    expect(versioni[0].quote.map((q: { quotaMensile: number }) => q.quotaMensile)).toEqual([966, 414]);
  });
});

describe('QuotaWizard: riparte dal piano attuale', () => {
  it('riparte dal piano attuale quando pianoAttuale è presente', () => {
    monta({
      piani: [bundle([share({}), share({ slot: 2, userId: null, displayName: 'Giulia', redditoNettoMensile: 1400, quotaMensile: 603 })])],
    });
    expect(redditi()[0]).toHaveValue('1800');
    expect(redditi()[1]).toHaveValue('1400');
    expect(screen.getByDisplayValue('Giulia')).toBeInTheDocument();
    avanti();
    expect(screen.getByLabelText('Importo Affitto')).toHaveValue('750');
    expect(screen.getByLabelText('Importo Assicurazione casa')).toHaveValue('96');
    avanti();
    expect(screen.getByLabelText('Ogni mese')).toHaveValue('59');
    avanti();
    expect(screen.getByText('Totale da versare ogni mese: 1.380 €')).toBeInTheDocument();
  });

  it('rinominare una voce personalizzata esistente manda la stessa categoriaId con il nuovo nome', async () => {
    const piano = bundle([share({})]);
    piano.items = [{ ...piano.items[0], nome: 'Palestra', categoriaId: 'c9', ordine: 0 }];
    monta({ piani: [piano] });
    avanti();
    scrivi(screen.getByLabelText('Nome della voce'), 'Yoga');
    avanti();
    avanti();
    avanti();
    fireEvent.click(screen.getByRole('button', { name: 'Confermiamo' }));
    await waitFor(() => expect(savePlan).toHaveBeenCalled());
    const voci = savePlan.mock.calls[0][2][0].voci;
    expect(voci[0]).toMatchObject({ categoriaId: 'c9', categoriaNome: 'Yoga', nome: 'Yoga' });
  });

  it('una voce aggiunta dopo ha categoriaId null', async () => {
    const piano = bundle([share({})]);
    piano.items = [{ ...piano.items[0], nome: 'Palestra', categoriaId: 'c9', ordine: 0 }];
    monta({ piani: [piano] });
    avanti();
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi una voce' }));
    const nomi = screen.getAllByLabelText('Nome della voce');
    scrivi(nomi[1], 'Pulizie');
    scrivi(screen.getByLabelText('Importo Pulizie'), '40');
    avanti();
    avanti();
    avanti();
    fireEvent.click(screen.getByRole('button', { name: 'Confermiamo' }));
    await waitFor(() => expect(savePlan).toHaveBeenCalled());
    const voci = savePlan.mock.calls[0][2][0].voci;
    expect(voci[0].categoriaId).toBe('c9');
    expect(voci[1]).toMatchObject({ nome: 'Pulizie', categoriaId: null });
  });

  it('un nuovo segnaposto prende lo slot massimo più 1', async () => {
    monta({ piani: [bundle([share({}), share({ slot: 4, userId: null, displayName: 'Giulia', redditoNettoMensile: 1400 })])] });
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi una persona' }));
    scrivi(screen.getAllByLabelText('Nome')[1], 'Marco');
    scrivi(redditi()[2], '900');
    avanti();
    avanti();
    avanti();
    avanti();
    fireEvent.click(screen.getByRole('button', { name: 'Confermiamo' }));
    await waitFor(() => expect(savePlan).toHaveBeenCalled());
    const slots = savePlan.mock.calls[0][2][0].quote.map((q: { slot: number }) => q.slot);
    expect(slots).toEqual([1, 4, 5]);
  });
});

describe('QuotaWizard: testi', () => {
  it('nessuna parola vietata in ogni passo', () => {
    const { container } = monta();
    assertNessunaParolaVietata(container);
    finoAlPassoConControlli(container);
  });
});

function finoAlPassoConControlli(container: HTMLElement) {
  scrivi(redditi()[0], '1800');
  aggiungiGiulia();
  fireEvent.click(screen.getByLabelText('Il mio reddito cambia da mese a mese (partita IVA)'));
  assertNessunaParolaVietata(container);
  avanti();
  scrivi(screen.getByLabelText('Importo Affitto'), '750');
  fireEvent.click(screen.getAllByRole('button', { name: /^Che cos'è / })[0]);
  assertNessunaParolaVietata(container);
  avanti();
  assertNessunaParolaVietata(container);
  avanti();
  assertNessunaParolaVietata(container);
  avanti();
  assertNessunaParolaVietata(container);
  expect(container.textContent).not.toContain('NaN');
}

describe('QuotaWizard: ripartire da tutte le versioni', () => {
  const giulia = (over: Partial<PlanShare> = {}) =>
    share({ slot: 2, userId: 'u2', displayName: 'Giulia', redditoNettoMensile: 1400, ...over });
  const versione = (validoDal: string, shares: PlanShare[], piano: Partial<PlanBundle['plan']> = {}): PlanBundle => {
    const b = bundle(shares);
    return { ...b, plan: { ...b.plan, validoDal, ...piano } };
  };

  it('il reddito e la sola lettura vengono dall\'ultimo valore salvato, non dalla versione del mese', () => {
    monta({
      membri: [fabio, giuliaMembro],
      piani: [
        versione('2026-12-01', [share({}), giulia()]),
        versione('2027-02-01', [share({}), giulia({ redditoNettoMensile: 1500 })]),
      ],
    });
    const [, rGiulia] = redditi();
    expect(rGiulia).toHaveValue('1500');
    expect(rGiulia).toHaveAttribute('readonly');
  });

  it('regola, cuscinetto e voci ripartono dalla versione più recente, non dal passaggio personalizzato', () => {
    monta({
      membri: [fabio, giuliaMembro],
      piani: [
        versione('2026-12-01', [share({ percentuale: 100 }), giulia({ percentuale: 0 })], { regola: 'personalizzata' }),
        versione('2027-02-01', [share({}), giulia()], { regola: 'parti_uguali', cuscinettoQuotaMensile: 20 }),
      ],
    });
    avanti();
    avanti();
    expect(screen.getByLabelText('Ogni mese')).toHaveValue('20');
    avanti();
    expect(screen.getByRole('radio', { name: 'Parti uguali' })).toBeChecked();
    expect(screen.queryByText(/percentuali scelte/)).not.toBeInTheDocument();
  });

  it('se l\'ultima regola è personalizzata lo dice e porta con sé le percentuali', () => {
    monta({
      membri: [fabio, giuliaMembro],
      piani: [versione('2026-12-01', [share({ percentuale: 70 }), giulia({ percentuale: 30 })], { regola: 'personalizzata' })],
    });
    avanti();
    avanti();
    avanti();
    expect(screen.getByText(/Il piano di ora era diviso con percentuali scelte/)).toBeInTheDocument();
  });

  it('una nuova persona prende la posizione più alta mai usata più 1, anche di chi se n\'è andato', async () => {
    monta({ piani: [versione('2026-12-01', [share({})])], slotMassimo: 6 });
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi una persona' }));
    scrivi(screen.getByLabelText('Nome'), 'Marco');
    scrivi(redditi()[1], '900');
    avanti();
    avanti();
    avanti();
    avanti();
    fireEvent.click(screen.getByRole('button', { name: 'Confermiamo' }));
    await waitFor(() => expect(savePlan).toHaveBeenCalled());
    const slots = savePlan.mock.calls[0][2][0].quote.map((q: { slot: number }) => q.slot);
    expect(slots).toEqual([1, 7]);
  });

  it('una quota legata a chi non è più membro non resta tra le persone', () => {
    monta({
      piani: [versione('2026-12-01', [share({}), share({ slot: 3, userId: 'u3', displayName: 'Ex', redditoNettoMensile: 900 })])],
    });
    expect(redditi()).toHaveLength(1);
    expect(screen.queryByText(/Ex/)).not.toBeInTheDocument();
  });

  it.each([
    [
      { message: 'il reddito di un altro membro non si modifica' },
      "Il reddito di un'altra persona lo cambia solo lei. Ricarica la pagina per vedere i valori aggiornati.",
    ],
    [{ message: 'valido_dal nel passato' }, 'Il mese di partenza è passato: ricarica la pagina e riprova.'],
    [{ message: 'altro' }, 'Salvataggio fallito, controlla la connessione e riprova.'],
    [new Error('rete'), 'Salvataggio fallito, controlla la connessione e riprova.'],
  ])('l\'errore %j mostra il testo giusto', async (errore, testo) => {
    savePlan.mockRejectedValue(errore);
    const { container } = monta();
    finoAlPasso4();
    avanti();
    fireEvent.click(screen.getByRole('button', { name: 'Confermiamo' }));
    expect(await screen.findByText(testo)).toBeInTheDocument();
    assertNessunaParolaVietata(container);
  });
});

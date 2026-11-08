import { describe, it, expect } from 'vitest';
import { buildPlanVersions, type PianoDraft, type PianoDraftPersona } from '@/lib/calculations/casa/pianoVersioni';
import { ESEMPIO_VOCI } from '../../helpers/esempioCasa';
import type { PlanVoceInput } from '@/lib/data/householdPlans';

const voci: PlanVoceInput[] = ESEMPIO_VOCI.map((v, i) => ({
  nome: v.nome,
  categoriaNome: v.nome,
  frequenzaMesi: v.frequenzaMesi,
  importoRicorrenza: v.importoRicorrenza,
  origineStima: 'suggerita',
  ordine: i,
}));

const fabio: PianoDraftPersona = {
  slot: 1,
  displayName: 'Fabio',
  userId: 'u1',
  redditoNetto: 1800,
  redditoIrregolare: false,
  inCasaDal: null,
};
const giulia = (inCasaDal: string | null = null): PianoDraftPersona => ({
  slot: 2,
  displayName: 'Giulia',
  userId: null,
  redditoNetto: 1400,
  redditoIrregolare: false,
  inCasaDal,
});
const marco = (inCasaDal: string | null): PianoDraftPersona => ({
  slot: 3,
  displayName: 'Marco',
  userId: null,
  redditoNetto: 1000,
  redditoIrregolare: false,
  inCasaDal,
});

function draft(over: Partial<PianoDraft> = {}): PianoDraft {
  return {
    persone: [fabio, giulia()],
    voci,
    cuscinettoObiettivo: 1321,
    cuscinettoQuotaMensile: 59,
    arrotondamento: 10,
    regola: 'proporzionale',
    periodoIniziale: { tipo: 'normale' },
    giornoVersamento: 5,
    partenza: '2026-12-01',
    ...over,
  };
}

const quote = (v: { quote: { slot: number; quotaMensile: number }[] }) => v.quote.map((q) => q.quotaMensile);

describe('buildPlanVersions', () => {
  it('tutti già in casa: una sola versione dal mese di partenza con le quote 777 e 603', () => {
    const v = buildPlanVersions(draft());
    expect(v).toHaveLength(1);
    expect(v[0].validoDal).toBe('2026-12-01');
    expect(v[0].totaleMensile).toBe(1380);
    expect(v[0].giornoVersamento).toBe(5);
    expect(v[0].cuscinettoObiettivo).toBe(1321);
    expect(v[0].cuscinettoQuotaMensile).toBe(59);
    expect(v[0].regola).toBe('proporzionale');
    expect(quote(v[0])).toEqual([777, 603]);
    expect(v[0].voci).toHaveLength(10);
    expect(v[0].quote[0]).toMatchObject({ slot: 1, displayName: 'Fabio', redditoNettoMensile: 1800, percentuale: null });
  });

  it('la compagna entra dal 2027-02-01 con "tutto a chi abita già": versione 2026-12-01 personalizzata con percentuali 100 e 0 (quote 1380 e 0) e versione 2027-03-01 proporzionale con 777 e 603', () => {
    const v = buildPlanVersions(
      draft({ persone: [fabio, giulia('2027-02-01')], periodoIniziale: { tipo: 'tutto_a_chi_abita' } }),
    );
    expect(v.map((x) => x.validoDal)).toEqual(['2026-12-01', '2027-03-01']);
    expect(v[0].regola).toBe('personalizzata');
    expect(v[0].quote.map((q) => q.percentuale)).toEqual([100, 0]);
    expect(quote(v[0])).toEqual([1380, 0]);
    expect(v[1].regola).toBe('proporzionale');
    expect(quote(v[1])).toEqual([777, 603]);
    expect(v[1].quote.map((q) => q.percentuale)).toEqual([null, null]);
  });

  it('percentuali 70 e 30 per il primo periodo danno 966 e 414', () => {
    const v = buildPlanVersions(
      draft({
        persone: [fabio, giulia('2027-02-01')],
        periodoIniziale: { tipo: 'percentuali', percentuali: { 1: 70, 2: 30 } },
      }),
    );
    expect(v[0].regola).toBe('personalizzata');
    expect(quote(v[0])).toEqual([966, 414]);
    expect(v[0].quote.map((q) => q.percentuale)).toEqual([70, 30]);
  });

  it('periodo iniziale "normale" con la compagna che entra più tardi: una sola versione (la seconda sarebbe identica)', () => {
    const v = buildPlanVersions(draft({ persone: [fabio, giulia('2027-02-01')] }));
    expect(v).toHaveLength(1);
    expect(quote(v[0])).toEqual([777, 603]);
  });

  it('tre persone con ingressi scaglionati (seconda dal 2027-02-01, terza dal 2027-04-01): versioni 2026-12-01, 2027-03-01 e 2027-05-01; a marzo la terza ha quota 0', () => {
    const v = buildPlanVersions(
      draft({
        persone: [fabio, giulia('2027-02-01'), marco('2027-04-01')],
        periodoIniziale: { tipo: 'tutto_a_chi_abita' },
      }),
    );
    expect(v.map((x) => x.validoDal)).toEqual(['2026-12-01', '2027-03-01', '2027-05-01']);
    expect(quote(v[0])).toEqual([1380, 0, 0]);
    expect(v[1].quote[2]).toMatchObject({ slot: 3, quotaMensile: 0, percentuale: null });
    expect(v[1].quote[0].quotaMensile + v[1].quote[1].quotaMensile).toBe(1380);
    expect(v[2].quote.every((q) => q.quotaMensile > 0)).toBe(true);
    expect(v[2].quote.reduce((s, q) => s + q.quotaMensile, 0)).toBe(1380);
  });

  it('una persona già legata con in_casa_dal nel passato non crea versioni extra', () => {
    const v = buildPlanVersions(
      draft({ persone: [{ ...fabio, inCasaDal: '2025-06-01' }, { ...giulia('2026-01-01'), userId: 'u2' }] }),
    );
    expect(v).toHaveLength(1);
    expect(v[0].quote[0].inCasaDal).toBe('2025-06-01');
  });

  it('rivedere il piano rigenera la versione di transizione dall\'in_casa_dal salvato (le versioni successive vengono sostituite)', () => {
    // Piano riaperto: Giulia è ancora un segnaposto con in_casa_dal 2027-02-01.
    const persone = [fabio, giulia('2027-02-01')];
    const prima = buildPlanVersions(draft({ persone, periodoIniziale: { tipo: 'tutto_a_chi_abita' } }));
    const dopo = buildPlanVersions(
      draft({
        persone,
        periodoIniziale: { tipo: 'tutto_a_chi_abita' },
        voci: voci.map((v) => (v.nome === 'Affitto' ? { ...v, importoRicorrenza: 800 } : v)),
      }),
    );
    expect(dopo.map((x) => x.validoDal)).toEqual(prima.map((x) => x.validoDal));
    expect(dopo[1].validoDal).toBe('2027-03-01');
    expect(dopo[1].totaleMensile).toBeGreaterThan(prima[1].totaleMensile);
    // se Giulia anticipa l'ingresso, la versione successiva si sposta: la vecchia va sostituita
    const anticipo = buildPlanVersions(
      draft({ persone: [fabio, giulia('2026-12-01')], periodoIniziale: { tipo: 'tutto_a_chi_abita' } }),
    );
    expect(anticipo.map((x) => x.validoDal)).toEqual(['2026-12-01']);
  });

  it('le percentuali che non sommano a 100 lanciano', () => {
    expect(() =>
      buildPlanVersions(
        draft({
          persone: [fabio, giulia('2027-02-01')],
          periodoIniziale: { tipo: 'percentuali', percentuali: { 1: 70, 2: 20 } },
        }),
      ),
    ).toThrow();
  });

  it('chi non è presente in una versione ha quota 0 e percentuale 0', () => {
    const v = buildPlanVersions(
      draft({ persone: [fabio, giulia('2027-02-01')], periodoIniziale: { tipo: 'tutto_a_chi_abita' } }),
    );
    expect(v[0].quote[1]).toMatchObject({ slot: 2, quotaMensile: 0, percentuale: 0 });
  });

  it('lancia se la quota non è calcolabile (reddito mancante)', () => {
    expect(() => buildPlanVersions(draft({ persone: [fabio, { ...giulia(), redditoNetto: null }] }))).toThrow();
  });
});

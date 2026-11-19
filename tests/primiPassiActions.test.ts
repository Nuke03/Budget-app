import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const createGoal = vi.fn(async () => ({}));
const getOpenGoals = vi.fn(async () => [] as unknown[]);
const salvaPercorso = vi.fn(async () => {});
const leggiPercorso = vi.fn(async () => ({ utente: null as unknown, lezioni: {} }));
const segnaProposta = vi.fn(async () => {});
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({}) }));
vi.mock('@/lib/utenteOLogin', () => ({ utenteOLogin: async () => ({ id: 'u1' }) }));
vi.mock('@/lib/data/goals', () => ({
  createGoal: (...a: unknown[]) => createGoal(...(a as [])),
  getOpenGoals: () => getOpenGoals(),
}));
vi.mock('@/lib/data/percorso', async (orig) => ({
  ...(await orig<typeof import('@/lib/data/percorso')>()),
  salvaPercorso: (...a: unknown[]) => salvaPercorso(...(a as [])),
  leggiPercorso: () => leggiPercorso(),
  segnaProposta: (...a: unknown[]) => segnaProposta(...(a as [])),
}));

import {
  creaFondoImprevisti,
  creaFondiSpeseCerte,
  salvaEntrate,
  ripartiSettimana,
  chiudiSettimana,
} from '@/app/impara/primi-passi/actions';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-19T10:00:00Z'));
  for (const f of [createGoal, getOpenGoals, salvaPercorso, leggiPercorso, segnaProposta]) f.mockClear();
  getOpenGoals.mockResolvedValue([]);
  leggiPercorso.mockResolvedValue({ utente: null, lezioni: {} });
});
afterEach(() => vi.useRealTimers());

describe('azioni primi passi', () => {
  it('imprevisti crea un dilazionato con ruolo imprevisti, scadenza a 10 mesi con 200 e 20', async () => {
    await creaFondoImprevisti({ traguardo: 200, quota: 20 });
    expect(createGoal).toHaveBeenCalledTimes(1);
    expect(createGoal).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        modalita: 'dilazionato',
        ruolo: 'imprevisti',
        ricorrente: false,
        frequenzaMesi: null,
        importoTarget: 200,
        scadenza: '2027-09-19',
        accantonaDa: '2026-11-19',
        categoriaId: null,
      })
    );
  });

  it('imprevisti non ne crea un secondo se c è già', async () => {
    getOpenGoals.mockResolvedValue([{ ruolo: 'imprevisti' }]);
    const r = await creaFondoImprevisti({ traguardo: 200, quota: 20 });
    expect(r.creato).toBe(false);
    expect(createGoal).not.toHaveBeenCalled();
  });

  it('spese certe crea un fondo per voce spuntata', async () => {
    const fatte = await creaFondiSpeseCerte([
      { chiave: 'assicurazione-auto', importo: 500, mese: '2027-03' },
      { chiave: 'gomme', importo: 400, mese: '2028-01' },
    ]);
    expect(fatte).toEqual(['assicurazione-auto', 'gomme']);
    expect(createGoal).toHaveBeenCalledTimes(2);
    expect(createGoal).toHaveBeenNthCalledWith(
      1,
      {},
      expect.objectContaining({
        nome: 'Assicurazione auto',
        importoTarget: 500,
        modalita: 'dilazionato',
        ricorrente: true,
        frequenzaMesi: 12,
        scadenza: '2027-03-31',
        accantonaDa: '2026-11-19',
      })
    );
    expect(createGoal).toHaveBeenNthCalledWith(2, {}, expect.objectContaining({ frequenzaMesi: 24, scadenza: '2028-01-31' }));
  });

  it('spese certe rifiuta voci e mesi non validi senza scrivere', async () => {
    await expect(creaFondiSpeseCerte([{ chiave: 'boh', importo: 5, mese: '2027-03' }])).rejects.toThrow();
    await expect(creaFondiSpeseCerte([{ chiave: 'gomme', importo: 0, mese: '2027-03' }])).rejects.toThrow();
    await expect(creaFondiSpeseCerte([{ chiave: 'gomme', importo: 5, mese: '2026-10' }])).rejects.toThrow();
    expect(createGoal).not.toHaveBeenCalled();
  });

  it('entrate: Non so ancora la data salva entrataAttesaIl null e avvia la settimana', async () => {
    await salvaEntrate({ entrateTipo: 'fisse', entrataAttesa: null, entrataAttesaIl: null, redditoBase: null });
    expect(salvaPercorso).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ entrateTipo: 'fisse', entrataAttesaIl: null, settimanaDal: '2026-11-19' })
    );
  });

  it('entrate: non cambia settimanaDal se già partita', async () => {
    leggiPercorso.mockResolvedValue({ utente: { settimanaDal: '2026-11-10' }, lezioni: {} });
    await salvaEntrate({ entrateTipo: 'irregolari', entrataAttesa: 900, entrataAttesaIl: '2026-12-01', redditoBase: 600 });
    const campi = (salvaPercorso.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(campi).not.toHaveProperty('settimanaDal');
    expect(campi.redditoBase).toBe(600);
  });

  it('settimana: senza spese riparte da oggi; chiudere prima del 7° giorno non scrive', async () => {
    await ripartiSettimana();
    expect(salvaPercorso).toHaveBeenCalledWith({}, { settimanaDal: '2026-11-19' });
    salvaPercorso.mockClear();
    leggiPercorso.mockResolvedValue({ utente: { settimanaDal: '2026-11-15' }, lezioni: {} });
    await expect(chiudiSettimana()).rejects.toThrow();
    expect(salvaPercorso).not.toHaveBeenCalled();
    leggiPercorso.mockResolvedValue({ utente: { settimanaDal: '2026-11-12' }, lezioni: {} });
    await chiudiSettimana();
    expect(salvaPercorso).toHaveBeenCalledWith({}, { settimanaFattaIl: '2026-11-19' });
  });
});

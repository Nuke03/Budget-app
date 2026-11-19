import { describe, it, expect, vi, beforeEach } from 'vitest';

const loadPercorsoData = vi.fn();
const avvisoGiaDato = vi.fn();
const rispostaAvviso = vi.fn(async () => {});
const segnaProposta = vi.fn(async () => {});
const collegaAObiettivo = vi.fn(async () => {});
const getOpenGoals = vi.fn();
const getGoalPersonale = vi.fn();
const closeGoal = vi.fn(async () => {});
const createGoal = vi.fn(async () => ({}));
const reopenGoal = vi.fn(async () => {});
const updateGoalPiano = vi.fn(async () => {});
const revalidatePath = vi.fn();
const utenteOLogin = vi.fn(async () => ({ id: 'u1' }));
// La lettura di una transazione per id (rispondiAvviso).
const riga = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => riga() }) }),
    }),
  }),
}));
vi.mock('@/lib/utenteOLogin', () => ({ utenteOLogin: () => utenteOLogin() }));
vi.mock('@/lib/loadPercorsoData', () => ({ loadPercorsoData: (...a: unknown[]) => loadPercorsoData(...a) }));
vi.mock('@/lib/data/goals', () => ({
  getOpenGoals: (...a: unknown[]) => getOpenGoals(...a),
  getGoalPersonale: (...a: unknown[]) => getGoalPersonale(...a),
  closeGoal: (...a: unknown[]) => closeGoal(...(a as [])),
  createGoal: (...a: unknown[]) => createGoal(...(a as [])),
  reopenGoal: (...a: unknown[]) => reopenGoal(...(a as [])),
  updateGoalPiano: (...a: unknown[]) => updateGoalPiano(...(a as [])),
}));
vi.mock('@/lib/data/percorso', () => ({
  avvisoGiaDato: (...a: unknown[]) => avvisoGiaDato(...a),
  rispostaAvviso: (...a: unknown[]) => rispostaAvviso(...(a as [])),
  segnaProposta: (...a: unknown[]) => segnaProposta(...(a as [])),
  collegaAObiettivo: (...a: unknown[]) => collegaAObiettivo(...(a as [])),
}));

import { valutaDopoSalvataggio, rispondiAvviso } from '@/app/impara/dopoSalvataggio';

const ID = '11111111-2222-3333-4444-555555555555';
const GOAL = 'aaaaaaaa-2222-3333-4444-555555555555';

const conto = (over = {}) => ({
  id: 'c1', nome: 'Conto', saldoAttuale: 0, contaInDisponibile: true, targetSaldo: null, archiviato: false, ...over,
});
const spesa = (over = {}) => ({
  id: ID, tipo: 'expense', importo: 50, data: '2026-11-19', categoriaId: null, accountId: 'c1', goalId: null,
  descrizione: 'x', nota: null, createdAt: '', pagataDaUserId: null, origine: null, userId: 'u1', stima: false, ...over,
});
const fondo = { id: GOAL, nome: 'Imprevisti', importoTarget: 200, stato: 'aperto', ruolo: 'imprevisti', accantonato: 80 };

function dati(over: Record<string, unknown> = {}) {
  return {
    oggi: '2026-11-19',
    transazioni: [spesa()],
    categorie: [],
    goals: [fondo],
    lezioni: {},
    percorso: null,
    disponibileReale: -20,
    ultimaEntrataIl: '2026-11-10',
    primiPassiVisibili: false,
    conti: [conto()],
    riservati: { obiettivi: 80, casa: 0, debiti: 0, tasse: 0 },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  avvisoGiaDato.mockResolvedValue(false);
  loadPercorsoData.mockResolvedValue(dati());
});

describe('valutaDopoSalvataggio', () => {
  it('spesa sotto zero con fondo: avviso con fondo, segnato visto, lezione prima-da-parte', async () => {
    const r = await valutaDopoSalvataggio(ID);
    expect(r).toEqual({
      tipo: 'avviso',
      avviso: { buco: 20, toccati: ['obiettivi'], fondoImprevisti: { goalId: GOAL, accantonato: 80 } },
      transactionId: ID,
      lezione: 'prima-da-parte',
    });
    expect(rispostaAvviso).toHaveBeenCalledWith(expect.anything(), ID, 'visto');
  });

  it('l avviso conta come lezione del giorno: segnaProposta con la lezione dell avviso', async () => {
    await valutaDopoSalvataggio(ID);
    expect(segnaProposta).toHaveBeenCalledWith(expect.anything(), 'prima-da-parte', '2026-11-19');
    expect(rispostaAvviso.mock.invocationCallOrder[0]).toBeLessThan(segnaProposta.mock.invocationCallOrder[0]);
  });

  it('senza fondo l avviso segna la lezione imprevisti', async () => {
    loadPercorsoData.mockResolvedValue(dati({ goals: [] }));
    await valutaDopoSalvataggio(ID);
    expect(segnaProposta).toHaveBeenCalledWith(expect.anything(), 'imprevisti', '2026-11-19');
  });

  it('segnaProposta fallisce nel ramo avviso: null, come per ogni errore', async () => {
    segnaProposta.mockRejectedValueOnce(new Error('rete'));
    expect(await valutaDopoSalvataggio(ID)).toBeNull();
  });

  it('senza fondo imprevisti la lezione è imprevisti', async () => {
    loadPercorsoData.mockResolvedValue(dati({ goals: [] }));
    const r = await valutaDopoSalvataggio(ID);
    expect(r).toMatchObject({ tipo: 'avviso', lezione: 'imprevisti' });
    expect((r as { avviso: { fondoImprevisti: unknown } }).avviso.fondoImprevisti).toBeNull();
  });

  it('spesa già collegata a un obiettivo: l avviso non offre il fondo', async () => {
    loadPercorsoData.mockResolvedValue(dati({ transazioni: [spesa({ goalId: 'altro' })] }));
    const r = await valutaDopoSalvataggio(ID);
    expect(r).toMatchObject({ tipo: 'avviso' });
    expect((r as { avviso: { fondoImprevisti: unknown } }).avviso.fondoImprevisti).toBeNull();
  });

  it('spesa casa: null', async () => {
    // Le righe di casa non stanno fra le transazioni personali.
    loadPercorsoData.mockResolvedValue(dati({ transazioni: [] }));
    expect(await valutaDopoSalvataggio(ID)).toBeNull();
    expect(rispostaAvviso).not.toHaveBeenCalled();
    expect(segnaProposta).not.toHaveBeenCalled();
  });

  it('spesa con data futura: null', async () => {
    loadPercorsoData.mockResolvedValue(dati({ transazioni: [spesa({ data: '2026-11-25' })] }));
    expect(await valutaDopoSalvataggio(ID)).toBeNull();
    expect(rispostaAvviso).not.toHaveBeenCalled();
  });

  it('avviso già dato: niente avviso, eventuale lezione', async () => {
    avvisoGiaDato.mockResolvedValue(true);
    // 200 € senza fondo collegato: la regola propone imprevisti.
    loadPercorsoData.mockResolvedValue(dati({ transazioni: [spesa({ importo: 200 })], disponibileReale: 60 }));
    const r = await valutaDopoSalvataggio(ID);
    expect(r).toEqual({ tipo: 'lezione', lezione: 'imprevisti' });
    expect(rispostaAvviso).not.toHaveBeenCalled();
    expect(segnaProposta).toHaveBeenCalledWith(expect.anything(), 'imprevisti', '2026-11-19');
  });

  it('errore di lettura: null', async () => {
    loadPercorsoData.mockRejectedValue(new Error('rete'));
    expect(await valutaDopoSalvataggio(ID)).toBeNull();
  });

  it('errore nello scrivere "visto": null, niente avviso', async () => {
    rispostaAvviso.mockRejectedValueOnce(new Error('rete'));
    expect(await valutaDopoSalvataggio(ID)).toBeNull();
  });

  it('spesa in contanti: nessun avviso', async () => {
    loadPercorsoData.mockResolvedValue(dati({ transazioni: [spesa({ accountId: null })] }));
    const r = await valutaDopoSalvataggio(ID);
    expect(r === null || r.tipo === 'lezione').toBe(true);
    expect(rispostaAvviso).not.toHaveBeenCalled();
  });

  it('conto fuori dal disponibile: nessun avviso', async () => {
    loadPercorsoData.mockResolvedValue(dati({ conti: [conto({ contaInDisponibile: false })] }));
    const r = await valutaDopoSalvataggio(ID);
    expect(r === null || r.tipo === 'lezione').toBe(true);
    expect(rispostaAvviso).not.toHaveBeenCalled();
  });

  it('disponibile ancora sopra zero: nessun avviso', async () => {
    loadPercorsoData.mockResolvedValue(dati({ disponibileReale: 10 }));
    const r = await valutaDopoSalvataggio(ID);
    expect(r === null || r.tipo === 'lezione').toBe(true);
  });

  it('un id non valido: null, nessuna lettura', async () => {
    expect(await valutaDopoSalvataggio('; drop')).toBeNull();
    expect(loadPercorsoData).not.toHaveBeenCalled();
  });
});

// Un fondo imprevisti vero: 200 € in 10 mesi (20 al mese), nato il 19/6; il 19/11 ci sono 5 mesi, 100 € accantonati.
const fondoVero = (over = {}) => ({
  id: GOAL, nome: 'Imprevisti', importoTarget: 200, modalita: 'dilazionato', scadenza: '2027-04-19',
  categoriaId: null, ricorrente: false, frequenzaMesi: null, stato: 'aperto',
  createdAt: '2026-06-19T10:00:00.000Z', accantonaDa: '2026-06-19', ruolo: 'imprevisti', ...over,
});
function fondoCon(accantonato: number, over = {}) {
  getOpenGoals.mockResolvedValue([fondoVero(over)]);
  loadPercorsoData.mockResolvedValue(dati({ goals: [{ ...fondoVero(over), accantonato }] }));
}
const rigaCon = (over = {}) =>
  riga.mockResolvedValue({
    data: { id: ID, tipo: 'expense', importo: 50, user_id: 'u1', household_id: null, goal_id: null, ...over },
    error: null,
  });

describe('rispondiAvviso: il fondo dopo il "Sì"', () => {
  it('spesa più piccola di quanto accantonato: stesso fondo allungato, poi il collegamento', async () => {
    fondoCon(100);
    rigaCon({ importo: 50 });
    const r = await rispondiAvviso(ID, 'imprevisto', GOAL);
    expect(updateGoalPiano).toHaveBeenCalledWith(expect.anything(), GOAL, { importoTarget: 260, scadenza: '2027-07-19' });
    expect(collegaAObiettivo).toHaveBeenCalledWith(expect.anything(), ID, GOAL);
    expect(closeGoal).not.toHaveBeenCalled();
    expect(createGoal).not.toHaveBeenCalled();
    expect(r).toEqual({ coperto: 50, resto: 0 });
  });

  it('allungare ok ma collegare fallisce: il fondo torna com era e si rilancia', async () => {
    fondoCon(100);
    rigaCon({ importo: 50 });
    collegaAObiettivo.mockRejectedValueOnce(new Error('rete'));
    await expect(rispondiAvviso(ID, 'imprevisto', GOAL)).rejects.toThrow('rete');
    expect(updateGoalPiano).toHaveBeenLastCalledWith(expect.anything(), GOAL, { importoTarget: 200, scadenza: '2027-04-19' });
    expect(rispostaAvviso).not.toHaveBeenCalled();
  });

  it('spesa più grande di quanto accantonato: collega, chiude il vecchio, crea il nuovo con stessa quota', async () => {
    fondoCon(40, { createdAt: '2026-09-19T10:00:00.000Z', accantonaDa: '2026-09-19', scadenza: '2027-07-19' });
    rigaCon({ importo: 300 });
    const r = await rispondiAvviso(ID, 'imprevisto', GOAL);
    const ordine = [collegaAObiettivo, closeGoal, createGoal].map((f) => f.mock.invocationCallOrder[0]);
    expect(ordine).toEqual([...ordine].sort((a, b) => a - b));
    expect(collegaAObiettivo).toHaveBeenCalledWith(expect.anything(), ID, GOAL);
    expect(closeGoal).toHaveBeenCalledWith(expect.anything(), GOAL);
    expect(createGoal).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        importoTarget: 200, modalita: 'dilazionato', ruolo: 'imprevisti', ricorrente: false,
        scadenza: '2027-09-19', accantonaDa: '2026-11-19', categoriaId: null,
      })
    );
    expect(updateGoalPiano).not.toHaveBeenCalled();
    expect(r).toEqual({ coperto: 40, resto: 260 });
    expect(rispostaAvviso).toHaveBeenCalledWith(expect.anything(), ID, 'imprevisto');
  });

  it('creare il nuovo fallisce: il vecchio si riapre, la spesa si scollega e si rilancia', async () => {
    fondoCon(40);
    rigaCon({ importo: 300 });
    createGoal.mockRejectedValueOnce(new Error('indice'));
    await expect(rispondiAvviso(ID, 'imprevisto', GOAL)).rejects.toThrow('indice');
    expect(reopenGoal).toHaveBeenCalledWith(expect.anything(), GOAL);
    expect(collegaAObiettivo).toHaveBeenLastCalledWith(expect.anything(), ID, null);
    expect(rispostaAvviso).not.toHaveBeenCalled();
  });

  it('chiudere fallisce: non si crea niente e la spesa si scollega', async () => {
    fondoCon(40);
    rigaCon({ importo: 300 });
    closeGoal.mockRejectedValueOnce(new Error('rete'));
    await expect(rispondiAvviso(ID, 'imprevisto', GOAL)).rejects.toThrow('rete');
    expect(createGoal).not.toHaveBeenCalled();
    expect(collegaAObiettivo).toHaveBeenLastCalledWith(expect.anything(), ID, null);
  });

  it('spesa già collegata a questo fondo: non si rifà niente', async () => {
    fondoCon(40);
    rigaCon({ importo: 300, goal_id: GOAL });
    await rispondiAvviso(ID, 'imprevisto', GOAL);
    expect(updateGoalPiano).not.toHaveBeenCalled();
    expect(closeGoal).not.toHaveBeenCalled();
    expect(createGoal).not.toHaveBeenCalled();
    expect(collegaAObiettivo).not.toHaveBeenCalled();
    expect(rispostaAvviso).toHaveBeenCalledWith(expect.anything(), ID, 'imprevisto');
  });
});

describe('rispondiAvviso: retry dopo un "ricomincia" a metà', () => {
  const chiuso = { ...fondoVero(), stato: 'chiuso' };
  beforeEach(() => {
    // Il vecchio fondo è già chiuso e la spesa già collegata: non c è più fra gli aperti.
    getOpenGoals.mockResolvedValue([]);
    getGoalPersonale.mockResolvedValue(chiuso);
    rigaCon({ importo: 300, goal_id: GOAL });
  });

  it('spesa già collegata a un fondo imprevisti chiuso: niente rifondazione, solo la risposta', async () => {
    const r = await rispondiAvviso(ID, 'imprevisto', GOAL);
    expect(getGoalPersonale).toHaveBeenCalledWith(expect.anything(), GOAL, 'u1');
    expect(updateGoalPiano).not.toHaveBeenCalled();
    expect(collegaAObiettivo).not.toHaveBeenCalled();
    expect(closeGoal).not.toHaveBeenCalled();
    expect(createGoal).not.toHaveBeenCalled();
    expect(rispostaAvviso).toHaveBeenCalledWith(expect.anything(), ID, 'imprevisto');
    expect(r).toEqual({ coperto: 0, resto: 0 });
  });

  it('il fondo chiuso non è un fondo imprevisti: lancia', async () => {
    getGoalPersonale.mockResolvedValue({ ...chiuso, ruolo: null });
    await expect(rispondiAvviso(ID, 'imprevisto', GOAL)).rejects.toThrow('Obiettivo non valido');
    expect(rispostaAvviso).not.toHaveBeenCalled();
  });

  it('il fondo non esiste o non è dell utente: lancia', async () => {
    getGoalPersonale.mockResolvedValue(null);
    await expect(rispondiAvviso(ID, 'imprevisto', GOAL)).rejects.toThrow('Obiettivo non valido');
    expect(rispostaAvviso).not.toHaveBeenCalled();
  });

  it('la spesa non è collegata a quel fondo: lancia senza nemmeno guardarlo', async () => {
    rigaCon({ importo: 300, goal_id: null });
    await expect(rispondiAvviso(ID, 'imprevisto', GOAL)).rejects.toThrow('Obiettivo non valido');
    expect(getGoalPersonale).not.toHaveBeenCalled();
  });
});

describe('rispondiAvviso', () => {
  beforeEach(() => {
    fondoCon(100);
    riga.mockResolvedValue({
      data: { id: ID, tipo: 'expense', importo: 50, user_id: 'u1', household_id: null, goal_id: null },
      error: null,
    });
  });

  it('imprevisto: collega al fondo e risponde', async () => {
    await rispondiAvviso(ID, 'imprevisto', GOAL);
    expect(collegaAObiettivo).toHaveBeenCalledWith(expect.anything(), ID, GOAL);
    expect(rispostaAvviso).toHaveBeenCalledWith(expect.anything(), ID, 'imprevisto');
    expect(revalidatePath).toHaveBeenCalledWith('/');
  });

  it('normale: solo la risposta', async () => {
    await rispondiAvviso(ID, 'normale');
    expect(collegaAObiettivo).not.toHaveBeenCalled();
    expect(rispostaAvviso).toHaveBeenCalledWith(expect.anything(), ID, 'normale');
  });

  it('imprevisto senza obiettivo: lancia e non scrive', async () => {
    await expect(rispondiAvviso(ID, 'imprevisto')).rejects.toThrow();
    expect(collegaAObiettivo).not.toHaveBeenCalled();
    expect(rispostaAvviso).not.toHaveBeenCalled();
  });

  it('obiettivo che non è il fondo imprevisti dell utente: lancia', async () => {
    getOpenGoals.mockResolvedValue([{ id: GOAL, ruolo: null, stato: 'aperto' }]);
    await expect(rispondiAvviso(ID, 'imprevisto', GOAL)).rejects.toThrow();
    getOpenGoals.mockResolvedValue([]);
    await expect(rispondiAvviso(ID, 'imprevisto', GOAL)).rejects.toThrow();
    expect(collegaAObiettivo).not.toHaveBeenCalled();
  });

  it('transazione di un altro, di casa, o un incasso: lancia', async () => {
    for (const r of [
      { user_id: 'altro', household_id: null, tipo: 'expense', goal_id: null },
      { user_id: 'u1', household_id: 'h1', tipo: 'expense', goal_id: null },
      { user_id: 'u1', household_id: null, tipo: 'income', goal_id: null },
      { user_id: 'u1', household_id: null, tipo: 'expense', goal_id: 'altro-obiettivo' },
    ]) {
      riga.mockResolvedValueOnce({ data: { id: ID, importo: 50, ...r }, error: null });
      await expect(rispondiAvviso(ID, 'imprevisto', GOAL)).rejects.toThrow();
    }
    riga.mockResolvedValueOnce({ data: null, error: null });
    await expect(rispondiAvviso(ID, 'normale')).rejects.toThrow();
    expect(collegaAObiettivo).not.toHaveBeenCalled();
    expect(rispostaAvviso).not.toHaveBeenCalled();
  });

  it('argomenti non validi: lancia prima di toccare altro', async () => {
    await expect(rispondiAvviso('x', 'normale')).rejects.toThrow();
    await expect(rispondiAvviso(ID, 'boh' as never)).rejects.toThrow();
    await expect(rispondiAvviso(ID, 'imprevisto', 'no')).rejects.toThrow();
    await expect(rispondiAvviso(ID, 'normale', GOAL)).rejects.toThrow();
    expect(utenteOLogin).not.toHaveBeenCalled();
  });
});

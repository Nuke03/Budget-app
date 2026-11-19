import { describe, it, expect, vi, beforeEach } from 'vitest';

const loadPercorsoData = vi.fn();
const avvisoGiaDato = vi.fn();
const rispostaAvviso = vi.fn(async () => {});
const segnaProposta = vi.fn(async () => {});
const collegaAObiettivo = vi.fn(async () => {});
const getOpenGoals = vi.fn();
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
vi.mock('@/lib/data/goals', () => ({ getOpenGoals: (...a: unknown[]) => getOpenGoals(...a) }));
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

  it('senza fondo imprevisti la lezione è imprevisti', async () => {
    loadPercorsoData.mockResolvedValue(dati({ goals: [] }));
    const r = await valutaDopoSalvataggio(ID);
    expect(r).toMatchObject({ tipo: 'avviso', lezione: 'imprevisti' });
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
    loadPercorsoData.mockResolvedValue(dati({ transazioni: [spesa({ importo: 200 })], disponibileReale: -20 }));
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

describe('rispondiAvviso', () => {
  beforeEach(() => {
    riga.mockResolvedValue({
      data: { id: ID, tipo: 'expense', user_id: 'u1', household_id: null, goal_id: null },
      error: null,
    });
    getOpenGoals.mockResolvedValue([{ id: GOAL, ruolo: 'imprevisti', stato: 'aperto' }]);
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
      riga.mockResolvedValueOnce({ data: { id: ID, ...r }, error: null });
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

import { describe, it, expect } from 'vitest';
import { casaHomeDati } from '@/lib/calculations/supporto/casaHome';
import type { CasaData } from '@/lib/loadCasaData';
import type { PlanBundle } from '@/lib/data/householdPlans';
import type { HouseholdMember, PlanItem, Transaction } from '@/lib/types';

const OGGI = '2026-11-12';
const membro = (userId: string, nome: string, joinedAt: string): HouseholdMember => ({
  householdId: 'c1', userId, displayName: nome, joinedAt, slot: 1, attivo: true,
});
const fabio = membro('fabio', 'Fabio', '2026-01-01T00:00:00Z');
const giulia = membro('giulia', 'Giulia', '2026-01-02T00:00:00Z');

const voce = (over: Partial<PlanItem>): PlanItem => ({
  id: 'i', planId: 'p', nome: 'Affitto', categoriaId: null, frequenzaMesi: 1, importoRicorrenza: 100,
  importoMensile: 100, origineStima: 'utente', goalId: null, stimaIgnorataConN: null, ordine: 0, ...over,
});
const piano = (items: PlanItem[]): PlanBundle => ({
  plan: {
    id: 'p', householdId: 'c1', validoDal: '2026-01-01', giornoVersamento: 5, regola: 'parti_uguali',
    cuscinettoObiettivo: 0, cuscinettoQuotaMensile: 0, arrotondamento: 1, totaleMensile: 0, createdAt: '2026-01-01',
  },
  items,
  shares: [],
});
const spesa = (over: Partial<Transaction>): Transaction => ({
  id: 's', tipo: 'expense', importo: 10, data: '2026-11-10', categoriaId: null, accountId: 'conto', goalId: null,
  descrizione: 'Spesa', nota: null, createdAt: '2026-11-10T10:00:00Z', pagataDaUserId: null, stima: false, ...over,
});

function dati(over: Partial<CasaData> = {}, membri: HouseholdMember[] = [fabio, giulia]): CasaData {
  return {
    casa: {
      household: { id: 'c1', nome: 'Casa', createdAt: '', archiviataIl: null, createdBy: 'fabio' },
      members: membri, invite: null, me: membri[0],
    },
    aggiunta: {
      householdId: 'c1', meUserId: 'fabio',
      nomi: membri.map((m) => ({ userId: m.userId, nome: m.displayName })),
      conti: [], categorie: [{ id: 'cat', nome: 'Cibo', tipo: 'expense' as never, colore: 'verde', archiviata: false }],
      obiettivi: [],
    },
    transazioni: [], obiettiviConAccantonato: [],
    disponibile: { valore: 500 } as CasaData['disponibile'],
    cuscinetto: null, trasferimenti: [], crediti: {},
    piani: [piano([voce({})])],
    righe: { fabio: [{ mese: '2026-11-01', atteso: 300, versato: 300, mancano: 0 }] },
    debiti: [], controlli: { ultimoControllo: OGGI, ultimoCheckinMese: null },
    ...over,
  } as CasaData;
}

const debito = (debitoreId: string, creditoreId: string, importo: number) => ({ debitoreId, creditoreId, importo, mesi: [] });

describe('casaHomeDati', () => {
  it('gestisce: il creatore attivo', () => {
    expect(casaHomeDati(dati(), 'fabio', OGGI).gestisce).toBe(true);
    expect(casaHomeDati(dati(), 'giulia', OGGI).gestisce).toBe(false);
  });

  it('un promemoria vince sull accantonamento', () => {
    const d = dati({
      crediti: { giulia: 50 },
      piani: [piano([voce({ nome: 'Bolletta', frequenzaMesi: 2, importoMensile: 40 })])],
    });
    expect(casaHomeDati(d, 'fabio', OGGI).daFare?.tipo).toBe('promemoria');
  });

  it('senza promemoria vale l accantonamento con le voci', () => {
    const d = dati({
      piani: [piano([voce({ nome: 'Luce', frequenzaMesi: 2, importoMensile: 40 }), voce({ id: 'j', nome: 'Gas', frequenzaMesi: 3, importoMensile: 20 })])],
    });
    const r = casaHomeDati(d, 'fabio', OGGI).daFare;
    expect(r).toEqual({
      tipo: 'da_parte',
      testo: 'Metti da parte 60 € per Luce e Gas',
      importo: 60,
      voci: [{ nome: 'Luce', importo: 40 }, { nome: 'Gas', importo: 20 }],
    });
  });

  it('senza piano vale quota', () => {
    const r = casaHomeDati(dati({ piani: [], righe: {} }), 'fabio', OGGI);
    expect(r.daFare).toEqual({ tipo: 'quota', testo: 'Calcolate la quota: servono 3 minuti.', href: '/casa/quota' });
    expect(r.previstoMese).toBeNull();
    expect(r.vistaSemplice.quota).toBeNull();
    expect(r.vistaSemplice.entroGiorno).toBeNull();
    expect(r.vistaSemplice.versato).toBe(0);
  });

  it('niente da fare: null', () => {
    expect(casaHomeDati(dati(), 'fabio', OGGI).daFare).toBeNull();
  });

  it('ultime: tu, altro, casa, anticipo in contanti, colore, 3 più recenti', () => {
    const d = dati({
      transazioni: [
        spesa({ id: 'a', data: '2026-11-11', pagataDaUserId: 'fabio', categoriaId: 'cat' }),
        spesa({ id: 'b', data: '2026-11-10', pagataDaUserId: 'giulia' }),
        spesa({ id: 'c', data: '2026-11-09' }),
        spesa({ id: 'd', data: '2026-11-08' }),
        spesa({ id: 'e', data: '2026-11-12', pagataDaUserId: 'fabio', accountId: null }),
      ],
    });
    const u = casaHomeDati(d, 'fabio', OGGI).ultime;
    expect(u.map((x) => x.id)).toEqual(['e', 'a', 'b']);
    expect(u.map((x) => x.chi)).toEqual(['tu', 'tu', 'Giulia']);
    expect(u[1].colore).toBe('verde');
    expect(u[0].colore).toBeNull();
    expect(casaHomeDati(dati({ transazioni: [spesa({})] }), 'fabio', OGGI).ultime[0].chi).toBe('casa');
  });

  it('spesoMese e previstoMese', () => {
    const d = dati({
      transazioni: [spesa({ importo: 30 }), spesa({ id: 'x', importo: 20, data: '2026-10-30' }), spesa({ id: 'y', tipo: 'income', importo: 99 })],
      piani: [piano([voce({ importoMensile: 100 }), voce({ id: 'k', importoMensile: 25.5 })])],
    });
    const r = casaHomeDati(d, 'fabio', OGGI);
    expect(r.spesoMese).toBe(30);
    expect(r.previstoMese).toBe(125.5);
    expect(r.disponibile).toBe(500);
  });

  it('stato: pari, devi, ti_deve', () => {
    expect(casaHomeDati(dati(), 'fabio', OGGI).vistaSemplice.stato).toEqual({ tipo: 'pari' });
    expect(casaHomeDati(dati({ debiti: [debito('fabio', 'giulia', 40)] }), 'fabio', OGGI).vistaSemplice.stato)
      .toEqual({ tipo: 'devi', importo: 40, a: 'Giulia', aUserId: 'giulia' });
    expect(casaHomeDati(dati({ debiti: [debito('giulia', 'fabio', 25)] }), 'fabio', OGGI).vistaSemplice.stato)
      .toEqual({ tipo: 'ti_deve', importo: 25, da: 'Giulia', daUserId: 'giulia' });
    expect(casaHomeDati(dati({ debiti: [debito('giulia', 'fabio', 10), debito('fabio', 'giulia', 10.004)] }), 'fabio', OGGI).vistaSemplice.stato)
      .toEqual({ tipo: 'pari' });
  });

  it('stato: un credito verso la casa da solo non cambia lo stato, va in creditoVersoCasa', () => {
    const r = casaHomeDati(dati({ crediti: { fabio: 30.004, giulia: 12 } }), 'fabio', OGGI).vistaSemplice;
    expect(r.stato).toEqual({ tipo: 'pari' });
    expect(r.creditoVersoCasa).toBe(30);
    expect(casaHomeDati(dati(), 'fabio', OGGI).vistaSemplice.creditoVersoCasa).toBe(0);
  });

  it('stato: il debito fra membri conta a prescindere dai crediti verso la casa', () => {
    const r = casaHomeDati(dati({ crediti: { fabio: 30, giulia: 99 }, debiti: [debito('fabio', 'giulia', 40)] }), 'fabio', OGGI).vistaSemplice;
    expect(r.stato).toEqual({ tipo: 'devi', importo: 40, a: 'Giulia', aUserId: 'giulia' });
    expect(r.creditoVersoCasa).toBe(30);
  });

  it('vista semplice: quota, giorno, versato', () => {
    const d = dati({ righe: { fabio: [{ mese: '2026-11-01', atteso: 300, versato: 120, mancano: 180 }] } });
    expect(casaHomeDati(d, 'fabio', OGGI).vistaSemplice).toMatchObject({ quota: 300, entroGiorno: 5, versato: 120 });
  });

  it('un solo membro: nessun errore, stato pari', () => {
    const d = dati({}, [fabio]);
    const r = casaHomeDati(d, 'fabio', OGGI);
    expect(r.vistaSemplice.stato).toEqual({ tipo: 'pari' });
    expect(r.gestisce).toBe(true);
  });

  it('più di due membri: l altro con il netto più grande', () => {
    const marco = membro('marco', 'Marco', '2026-01-03T00:00:00Z');
    const d = dati({ debiti: [debito('fabio', 'giulia', 10), debito('fabio', 'marco', 70)] }, [fabio, giulia, marco]);
    expect(casaHomeDati(d, 'fabio', OGGI).vistaSemplice.stato).toEqual({ tipo: 'devi', importo: 70, a: 'Marco', aUserId: 'marco' });
  });
});

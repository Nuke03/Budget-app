import { describe, it, expect } from 'vitest';
import { loadCheckin } from '@/lib/loadCheckin';
import type { CasaCorrente } from '@/lib/data/households';
import type { HouseholdMember } from '@/lib/types';
import { statoPromemoria } from '@/lib/calculations/casa/promemoria';
import { createFakeDb } from './helpers/fakeDb';

const T0 = '2026-01-01T00:00:00Z';
const NOW = new Date('2026-11-09T12:00:00Z');

const membro = (userId: string, nome: string, slot: number): HouseholdMember => ({
  householdId: 'H1', userId, displayName: nome, joinedAt: T0, slot, attivo: true,
});
const A = membro('A', 'Fabio', 1);
const B = membro('B', 'Anna', 2);
const casa: CasaCorrente = {
  household: { id: 'H1', nome: 'Casa', createdAt: T0, archiviataIl: null, createdBy: 'u1' },
  members: [A, B],
  invite: null,
  me: A,
};

const piano = (validoDal: string) => ({
  id: 'p1', household_id: 'H1', valido_dal: validoDal, giorno_versamento: 5, regola: 'parti_uguali',
  cuscinetto_obiettivo: 1321, cuscinetto_quota_mensile: 59, arrotondamento: 10, totale_mensile: 1380, created_at: T0,
});
const quota = (slot: number, user: string, q: number) => ({
  plan_id: 'p1', slot, user_id: user, display_name: `U${slot}`, reddito_netto_mensile: 1000,
  reddito_irregolare: false, percentuale: null, in_casa_dal: null, esce_dal: null, quota_mensile: q,
});
const voce = (id: string, importo: number, freq: number) => ({
  id, plan_id: 'p1', nome: id, categoria_nome: 'Casa', categoria_id: null, frequenza_mesi: freq,
  importo_ricorrenza: importo * freq, importo_mensile: importo, origine_stima: 'tipica', goal_id: null,
  stima_ignorata_con_n: null, ordine: 1,
});
const versamento = (id: string, user: string, importo: number, mese: string) => ({
  id, household_id: 'H1', user_id: user, da_account_id: null, a_account_id: null, importo,
  data: '2026-10-05', causale: 'versamento', beneficiario_user_id: null, per_conto_di_user_id: null,
  mese_competenza: mese, solo_registrazione: false, nota: null, created_at: '2026-10-05T10:00:00Z',
});
const spesa = (id: string, importo: number, data: string) => ({
  id, user_id: 'A', household_id: 'H1', tipo: 'expense', importo, data, categoria_id: null, account_id: 'ac',
  goal_id: null, descrizione: id, nota: null, created_at: `${data}T10:00:00Z`,
});
const checkin = (mese: string, esito: string, extra: object = {}) => ({
  id: `c-${mese}`, household_id: 'H1', mese, user_id: 'B', created_at: '2026-11-02T09:00:00Z',
  atteso_totale: 1380, versato_totale: 1380, previsto_mensili: 1288, speso_mensili: 1161, non_registrate: 80,
  avanzo: 47, esito, destinazione_avanzo: 'cuscinetto', goal_id: null, ...extra,
});
const obiettivo = (id: string, nome: string, modalita: string, ricorrente: boolean) => ({
  id, user_id: 'A', household_id: 'H1', nome, importo_target: 500, modalita, scadenza: modalita === 'dilazionato' ? '2027-06-01' : null, categoria_id: null,
  ricorrente, frequenza_mesi: ricorrente ? 2 : null, stato: 'aperto', created_at: T0, accantona_da: null,
});

function base(extra: Record<string, Record<string, unknown>[]> = {}, validoDal = '2026-10-01') {
  return {
    household_plans: [piano(validoDal)],
    household_plan_shares: [quota(1, 'A', 776), quota(2, 'B', 604)],
    household_plan_items: [voce('i1', 1288, 1)],
    accounts: [
      { id: 'ac', user_id: 'A', household_id: 'H1', nome: 'Conto comune', saldo_attuale: 1000, conta_in_disponibile: true, target_saldo: null },
    ],
    budget_goals: [
      obiettivo('g1', 'Vacanza', 'bloccato', false),
      obiettivo('g2', 'Luce', 'bloccato', true),
      obiettivo('g3', 'Altro', 'dilazionato', false),
    ],
    transactions: [spesa('s1', 1161, '2026-10-12')],
    transfers: [versamento('v1', 'A', 776, '2026-10-01'), versamento('v2', 'B', 604, '2026-10-01')],
    ...extra,
  };
}

function carica(seed: Record<string, Record<string, unknown>[]>, now: Date = NOW) {
  const db = createFakeDb(seed, { userId: 'A', membri: { H1: ['A', 'B'] } });
  return loadCheckin(db.client, casa, now);
}

describe('loadCheckin', () => {
  it('da_fare per ottobre', async () => {
    const r = await carica(base());
    expect(r.stato).toBe('da_fare');
    expect(r.mese).toBe('2026-10-01');
    expect(r.calcolo?.attesoTotale).toBe(1380);
    expect(r.calcolo?.spesoMensili).toBe(1161);
    expect(r.fatto).toBeNull();
    expect(r.versamenti).toEqual([
      { userId: 'A', nome: 'Fabio', atteso: 776, versato: 776 },
      { userId: 'B', nome: 'Anna', atteso: 604, versato: 604 },
    ]);
    expect(r.fondiPerAvanzo.map((g) => g.id)).toEqual(['g1']);
    expect(r.conti.map((c) => c.id)).toEqual(['ac']);
    expect(r.nomi).toEqual({ A: 'Fabio', B: 'Anna' });
    expect(r.householdId).toBe('H1');
  });

  it('le stime: una proposta dalle spese già lette, con piano, fondo e mese di partenza', async () => {
    const luce = { ...voce('i1', 55, 2), nome: 'Luce', categoria_id: 'c1', origine_stima: 'suggerita', goal_id: 'g2', importo_ricorrenza: 110 };
    const r = await carica(
      base({
        household_plan_items: [luce],
        transactions: [spesa('s1', 1161, '2026-10-12'), { ...spesa('s2', 142, '2026-10-05'), categoria_id: 'c1' }],
      }),
    );
    expect(r.proposte).toHaveLength(1);
    expect(r.proposte[0]).toMatchObject({ itemId: 'i1', nome: 'Luce', n: 1, nuovoMensile: 71 });
    expect(r.fondiPerVoce.i1.id).toBe('g2');
    expect(r.pianoAttuale?.plan.validoDal).toBe('2026-10-01');
    expect(r.pianiFuturi).toEqual([]);
    expect(r.validoDalStima).toBe('2026-12-01');
  });

  it('le stime: senza voci con categoria nessuna proposta; una versione futura è in pianiFuturi', async () => {
    const r = await carica(base());
    expect(r.proposte).toEqual([]);
    expect(r.fondiPerVoce).toEqual({});
    const piani = [
      { ...piano('2026-10-01') },
      { ...piano('2026-12-01'), id: 'p2' },
    ];
    const f = await carica(base({ household_plans: piani, household_plan_items: [voce('i1', 1288, 1), { ...voce('i9', 100, 1), plan_id: 'p2' }], household_plan_shares: [quota(1, 'A', 776), quota(2, 'B', 604), { ...quota(1, 'A', 800), plan_id: 'p2' }, { ...quota(2, 'B', 600), plan_id: 'p2' }] }));
    expect(f.pianiFuturi.map((p) => p.plan.validoDal)).toEqual(['2026-12-01']);
  });

  it('fatto con la riga salvata e il nome di chi lo ha fatto', async () => {
    const r = await carica(base({ household_checkins: [checkin('2026-10-01', 'avanzo')] }));
    expect(r.stato).toBe('fatto');
    expect(r.calcolo).toBeNull();
    expect(r.fatto?.avanzo).toBe(47);
    expect(r.chi).toBe('Anna');
  });

  it('le stime: dopo una stima accettata, la prova parte dalla prima versione del piano', async () => {
    const gas = { ...voce('i2', 40, 1), nome: 'Gas', categoria_id: 'c2', origine_stima: 'suggerita', importo_ricorrenza: 40 };
    const piani = [{ ...piano('2026-01-01'), id: 'p0' }, { ...piano('2026-11-01'), id: 'p1' }];
    const r = await carica(
      base({
        household_plans: piani,
        household_plan_items: [{ ...gas, plan_id: 'p0' }, { ...gas, plan_id: 'p1' }],
        household_plan_shares: [quota(1, 'A', 776), quota(2, 'B', 604), { ...quota(1, 'A', 776), plan_id: 'p0' }, { ...quota(2, 'B', 604), plan_id: 'p0' }],
        transactions: [{ ...spesa('s2', 90, '2026-10-05'), categoria_id: 'c2' }],
      }),
    );
    expect(r.proposte.map((p) => p.itemId)).toEqual(['i2']);
  });

  it('le stime ci sono anche a check-in fatto', async () => {
    const luce = { ...voce('i1', 55, 2), nome: 'Luce', categoria_id: 'c1', origine_stima: 'suggerita', goal_id: 'g2', importo_ricorrenza: 110 };
    const r = await carica(
      base({
        household_plan_items: [luce],
        transactions: [spesa('s1', 1161, '2026-10-12'), { ...spesa('s2', 142, '2026-10-05'), categoria_id: 'c1' }],
        household_checkins: [checkin('2026-10-01', 'avanzo')],
      }),
    );
    expect(r.stato).toBe('fatto');
    expect(r.proposte).toHaveLength(1);
    expect(r.pianoAttuale?.plan.validoDal).toBe('2026-10-01');
    expect(r.fondiPerVoce.i1.id).toBe('g2');
  });

  it('un membro senza riga del mese vede comunque "Fatto da ..." se il check-in esiste', async () => {
    const db = createFakeDb(base({ household_checkins: [checkin('2026-10-01', 'avanzo')] }), { userId: 'C', membri: { H1: ['A', 'B', 'C'] } });
    const C = { ...membro('C', 'Carla', 3), joinedAt: '2026-11-03T00:00:00Z' };
    const casaC: CasaCorrente = { ...casa, members: [A, B, C], me: C };
    const r = await loadCheckin(db.client, casaC, NOW);
    expect(r.stato).toBe('fatto');
    expect(r.chi).toBe('Anna');
  });

  it('nessun_mese senza piano o con piano partito a novembre', async () => {
    const senza = await carica(base({ household_plans: [], household_plan_shares: [], household_plan_items: [] }));
    expect(senza.stato).toBe('nessun_mese');
    expect(senza.mese).toBeNull();
    const novembre = await carica(base({}, '2026-11-01'));
    expect(novembre.stato).toBe('nessun_mese');
  });

  it('con un ammanco legge anche il check-in del mese prima: secondo ammanco', async () => {
    const r = await carica(
      base({
        transactions: [spesa('s1', 1500, '2026-10-12')],
        household_checkins: [checkin('2026-09-01', 'ammanco')],
      })
    );
    expect(r.calcolo?.esito).toBe('ammanco');
    expect(r.calcolo?.secondoAmmanco).toBe(true);
  });

  it('dopo la mezzanotte italiana il mese dovuto è ottobre, non settembre', async () => {
    const dopo = await carica(base({}, '2026-09-01'), new Date('2026-10-31T23:30:00Z'));
    expect(dopo.mese).toBe('2026-10-01');
    const prima = await carica(base({}, '2026-09-01'), new Date('2026-10-31T21:30:00Z'));
    expect(prima.mese).toBe('2026-09-01');
  });

  it('il mese da fare è lo stesso del promemoria', async () => {
    const r = await carica(base());
    const stato = statoPromemoria({
      piano: null, righe: [{ mese: '2026-10-01', atteso: 776, versato: 776, mancano: 0 }, { mese: '2026-11-01', atteso: 776, versato: 0, mancano: 776 }],
      oggi: '2026-11-09', nomi: {}, crediti: {}, debiti: [], ultimoCheckinMese: null,
    });
    expect(r.mese).toBe(stato.checkin?.mese);
    const fatto = await carica(base({ household_checkins: [checkin('2026-10-01', 'avanzo')] }));
    expect(fatto.stato).toBe('fatto');
    expect(statoPromemoria({ piano: null, righe: [{ mese: '2026-10-01', atteso: 1, versato: 1, mancano: 0 }], oggi: '2026-11-09', nomi: {}, crediti: {}, debiti: [], ultimoCheckinMese: '2026-10-01' }).checkin?.mese).toBeNull();
  });

  it('serveControllo: solo se l ultimo controllo ha più di 14 giorni', async () => {
    expect((await carica(base())).serveControllo).toBe(true);
    const recente = await carica(base({ balance_checks: [{ id: 'b', household_id: 'H1', account_id: 'ac', data: '2026-11-02' }] }));
    expect(recente.serveControllo).toBe(false);
    const vecchio = await carica(base({ balance_checks: [{ id: 'b', household_id: 'H1', account_id: 'ac', data: '2026-10-20' }] }));
    expect(vecchio.serveControllo).toBe(true);
  });
});

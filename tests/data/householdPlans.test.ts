import { describe, it, expect } from 'vitest';
import { getPlanForMonth, savePlan, type PlanVersionInput } from '@/lib/data/householdPlans';
import { createFakeDb } from '../helpers/fakeDb';
import { fakeRpcClient } from '../helpers/fakeRpc';

const H = 'h1';

const piano = (id: string, validoDal: string, extra: object = {}) => ({
  id,
  household_id: H,
  valido_dal: validoDal,
  giorno_versamento: 5,
  regola: 'proporzionale',
  cuscinetto_obiettivo: 1321,
  cuscinetto_quota_mensile: 59,
  arrotondamento: 10,
  totale_mensile: 1380,
  created_at: '2026-11-01T00:00:00Z',
  ...extra,
});

function seed(piani: object[]) {
  return createFakeDb(
    {
      household_plans: piani as Record<string, unknown>[],
      household_plan_items: [
        { id: 'i2', plan_id: 'p1', nome: 'Gas', categoria_id: null, frequenza_mesi: 2, importo_ricorrenza: 110, importo_mensile: 55, origine_stima: 'suggerita', goal_id: null, stima_ignorata_con_n: null, ordine: 1 },
        { id: 'i1', plan_id: 'p1', nome: 'Luce', categoria_id: null, frequenza_mesi: 2, importo_ricorrenza: 110, importo_mensile: 55, origine_stima: 'suggerita', goal_id: null, stima_ignorata_con_n: null, ordine: 0 },
        { id: 'i9', plan_id: 'p2', nome: 'Altro', categoria_id: null, frequenza_mesi: 1, importo_ricorrenza: 5, importo_mensile: 5, origine_stima: 'utente', goal_id: null, stima_ignorata_con_n: null, ordine: 0 },
      ],
      household_plan_shares: [
        { plan_id: 'p1', slot: 2, user_id: null, display_name: 'Giulia', reddito_netto_mensile: 1400, reddito_irregolare: false, percentuale: null, in_casa_dal: null, esce_dal: null, quota_mensile: 603 },
        { plan_id: 'p1', slot: 1, user_id: 'u1', display_name: 'Fabio', reddito_netto_mensile: 1800, reddito_irregolare: false, percentuale: null, in_casa_dal: null, esce_dal: null, quota_mensile: 777 },
      ],
    },
    { userId: 'u1' },
  );
}

describe('getPlanForMonth', () => {
  it('ritorna il piano con valido_dal massimo non oltre il mese, con voci per ordine e quote per slot', async () => {
    const db = seed([piano('p0', '2026-06-01'), piano('p1', '2026-11-01'), piano('p2', '2027-03-01')]);
    const b = await getPlanForMonth(db.client, H, '2026-12-01');
    expect(b?.plan.id).toBe('p1');
    expect(b?.plan.validoDal).toBe('2026-11-01');
    expect(b?.plan.totaleMensile).toBe(1380);
    expect(b?.items.map((i) => i.nome)).toEqual(['Luce', 'Gas']);
    expect(b?.items[0]).toMatchObject({ importoRicorrenza: 110, importoMensile: 55, frequenzaMesi: 2 });
    expect(b?.shares.map((s) => s.displayName)).toEqual(['Fabio', 'Giulia']);
    expect(b?.shares[1]).toMatchObject({ userId: null, quotaMensile: 603, redditoNettoMensile: 1400 });
  });

  it('ritorna il primo piano futuro se nessuno è ancora valido', async () => {
    const db = seed([piano('p2', '2027-03-01'), piano('p1', '2027-01-01')]);
    const b = await getPlanForMonth(db.client, H, '2026-12-01');
    expect(b?.plan.id).toBe('p1');
  });

  it('ritorna null senza piani', async () => {
    const db = seed([]);
    expect(await getPlanForMonth(db.client, H, '2026-12-01')).toBeNull();
  });

  it('non legge i piani di un\'altra casa', async () => {
    const db = seed([piano('px', '2026-06-01', { household_id: 'altra' })]);
    expect(await getPlanForMonth(db.client, H, '2026-12-01')).toBeNull();
  });
});

const versione: PlanVersionInput = {
  validoDal: '2026-12-01',
  giornoVersamento: 5,
  regola: 'proporzionale',
  cuscinettoObiettivo: 1321,
  cuscinettoQuotaMensile: 59,
  arrotondamento: 10,
  totaleMensile: 1380,
  voci: [
    {
      nome: 'Luce',
      categoriaNome: 'Luce',
      frequenzaMesi: 2,
      importoRicorrenza: 110,
      origineStima: 'suggerita',
      goalId: null,
      stimaIgnorataConN: null,
      ordine: 0,
    },
  ],
  quote: [
    {
      slot: 1,
      displayName: 'Fabio',
      redditoNettoMensile: 1800,
      redditoIrregolare: false,
      percentuale: null,
      inCasaDal: null,
      esceDal: null,
      quotaMensile: 777,
    },
  ],
};

describe('savePlan', () => {
  it('chiama save_household_plan con p_household e p_payload in snake_case e ritorna gli id', async () => {
    const { client, calls } = fakeRpcClient({ save_household_plan: { data: ['plan-1'] } });
    const ids = await savePlan(client, H, [versione]);
    expect(ids).toEqual(['plan-1']);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('save_household_plan');
    expect(calls[0].args).toEqual({
      p_household: H,
      p_payload: {
        versioni: [
          {
            valido_dal: '2026-12-01',
            giorno_versamento: 5,
            regola: 'proporzionale',
            cuscinetto_obiettivo: 1321,
            cuscinetto_quota_mensile: 59,
            arrotondamento: 10,
            totale_mensile: 1380,
            voci: [
              {
                nome: 'Luce',
                categoria_nome: 'Luce',
                frequenza_mesi: 2,
                importo_ricorrenza: 110,
                origine_stima: 'suggerita',
                goal_id: null,
                stima_ignorata_con_n: null,
                ordine: 0,
              },
            ],
            quote: [
              {
                slot: 1,
                display_name: 'Fabio',
                reddito_netto_mensile: 1800,
                reddito_irregolare: false,
                percentuale: null,
                in_casa_dal: null,
                esce_dal: null,
                quota_mensile: 777,
              },
            ],
          },
        ],
      },
    });
  });

  it("rilancia l'errore dell'RPC", async () => {
    const { client } = fakeRpcClient({ save_household_plan: { error: { message: 'valido_dal nel passato' } } });
    await expect(savePlan(client, H, [versione])).rejects.toMatchObject({ message: 'valido_dal nel passato' });
  });
});

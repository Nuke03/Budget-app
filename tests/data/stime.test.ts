import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ignoraStima, applicaStima } from '@/lib/data/stime';
import { updateGoal } from '@/lib/data/goals';
import { savePlan, type PlanBundle } from '@/lib/data/householdPlans';
import type { BudgetGoal } from '@/lib/types';
import { createFakeDb } from '../helpers/fakeDb';
import { proponiStime, type PropostaStima } from '@/lib/calculations/casa/stimaVsReale';

vi.mock('@/lib/data/goals', () => ({ updateGoal: vi.fn() }));
vi.mock('@/lib/data/householdPlans', () => ({ savePlan: vi.fn() }));

const bundle: PlanBundle = {
  plan: {
    id: 'P1',
    householdId: 'H1',
    validoDal: '2026-10-01',
    giornoVersamento: 5,
    regola: 'parti_uguali',
    cuscinettoObiettivo: 100,
    cuscinettoQuotaMensile: 10,
    arrotondamento: 10,
    totaleMensile: 80,
    createdAt: '2026-09-20T10:00:00Z',
  },
  items: [
    { id: 'i1', planId: 'P1', nome: 'Luce', categoriaId: 'c1', frequenzaMesi: 2, importoRicorrenza: 110, importoMensile: 55, origineStima: 'suggerita', goalId: 'G1', stimaIgnorataConN: 2, ordine: 0 },
    { id: 'i2', planId: 'P1', nome: 'Gas', categoriaId: 'c2', frequenzaMesi: 2, importoRicorrenza: 40, importoMensile: 20, origineStima: 'suggerita', goalId: null, stimaIgnorataConN: 1, ordine: 1 },
  ],
  shares: [
    { planId: 'P1', slot: 1, userId: 'u1', displayName: 'Fabio', redditoNettoMensile: 1000, redditoIrregolare: false, percentuale: null, inCasaDal: null, esceDal: null, quotaMensile: 40 },
    { planId: 'P1', slot: 2, userId: 'u2', displayName: 'Anna', redditoNettoMensile: 1000, redditoIrregolare: false, percentuale: null, inCasaDal: null, esceDal: null, quotaMensile: 40 },
  ],
};

const proposta: PropostaStima = proponiStime({
  voci: [{ ...bundle.items[0], stimaIgnorataConN: null }],
  spese: [{ tipo: 'expense', importo: 142, data: '2026-10-05', categoriaId: 'c1', origine: null }],
  inizioPiano: '2026-01-01',
  oggi: '2026-11-09',
})[0];

const goal: BudgetGoal = {
  id: 'G1',
  nome: 'Luce',
  importoTarget: 110,
  modalita: 'bloccato',
  scadenza: '2026-12-31',
  categoriaId: 'c1',
  ricorrente: true,
  frequenzaMesi: 2,
  stato: 'aperto',
  createdAt: '2026-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.mocked(updateGoal).mockReset();
  vi.mocked(savePlan).mockReset();
});

describe('ignoraStima', () => {
  it('passa casa, voce e conteggio alla rpc', async () => {
    const db = createFakeDb({}, { userId: 'U1' });
    db.registerRpc('set_plan_item_stima_ignorata', () => ({ data: 1 }));
    await ignoraStima(db.client, 'H1', 'i1', 3);
    expect(db.rpcCalls).toEqual([
      { name: 'set_plan_item_stima_ignorata', args: { p_household: 'H1', p_item: 'i1', p_n: 3 } },
    ]);
  });

  it('l errore della rpc sale', async () => {
    const db = createFakeDb({}, { userId: 'U1' });
    db.registerRpc('set_plan_item_stima_ignorata', () => ({ error: { message: 'casa non scrivibile' } }));
    await expect(ignoraStima(db.client, 'H1', 'i1', 3)).rejects.toMatchObject({ message: 'casa non scrivibile' });
  });
});

describe('applicaStima', () => {
  const sb = {} as never;

  it('aggiorna prima l obiettivo e poi il piano', async () => {
    const ordine: string[] = [];
    vi.mocked(updateGoal).mockImplementation(async () => {
      ordine.push('goal');
      return goal;
    });
    vi.mocked(savePlan).mockImplementation(async () => {
      ordine.push('piano');
      return [];
    });
    await applicaStima(sb, { householdId: 'H1', bundle, proposta, goal, validoDal: '2026-12-01' });
    expect(ordine).toEqual(['goal', 'piano']);
  });

  it('dell obiettivo cambia solo l importo', async () => {
    vi.mocked(updateGoal).mockResolvedValue(goal);
    vi.mocked(savePlan).mockResolvedValue([]);
    await applicaStima(sb, { householdId: 'H1', bundle, proposta, goal, validoDal: '2026-12-01' });
    expect(updateGoal).toHaveBeenCalledWith(sb, 'G1', {
      nome: 'Luce',
      importoTarget: 142,
      modalita: 'bloccato',
      scadenza: '2026-12-31',
      categoriaId: 'c1',
      ricorrente: true,
      frequenzaMesi: 2,
    });
  });

  it('senza obiettivo salva solo il piano, con le altre voci intatte', async () => {
    vi.mocked(savePlan).mockResolvedValue([]);
    await applicaStima(sb, { householdId: 'H1', bundle, proposta, goal: null, validoDal: '2026-12-01' });
    expect(updateGoal).not.toHaveBeenCalled();
    expect(savePlan).toHaveBeenCalledTimes(1);
    const [, casa, versioni] = vi.mocked(savePlan).mock.calls[0];
    expect(casa).toBe('H1');
    expect(versioni).toHaveLength(1);
    expect(versioni[0].validoDal).toBe('2026-12-01');
    const luce = versioni[0].voci.find((v) => v.nome === 'Luce')!;
    const gas = versioni[0].voci.find((v) => v.nome === 'Gas')!;
    expect(luce).toMatchObject({ importoRicorrenza: 142, origineStima: 'reale', stimaIgnorataConN: null, goalId: 'G1' });
    expect(gas).toMatchObject({ importoRicorrenza: 40, goalId: null, stimaIgnorataConN: 1 });
  });

  it('se l obiettivo non si aggiorna il piano non si salva', async () => {
    vi.mocked(updateGoal).mockRejectedValue(new Error('rete'));
    await expect(
      applicaStima(sb, { householdId: 'H1', bundle, proposta, goal, validoDal: '2026-12-01' }),
    ).rejects.toThrow('rete');
    expect(savePlan).not.toHaveBeenCalled();
  });

  it('se il piano non è aggiornabile non tocca nemmeno l obiettivo', async () => {
    const conUscita = { ...bundle, shares: [{ ...bundle.shares[0], esceDal: '2027-01-01' }, bundle.shares[1]] };
    await expect(
      applicaStima(sb, { householdId: 'H1', bundle: conUscita, proposta, goal, validoDal: '2026-12-01' }),
    ).rejects.toThrow();
    expect(updateGoal).not.toHaveBeenCalled();
    expect(savePlan).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Rientro } from '@/lib/calculations/rientri';

let props: Record<string, unknown> = {};
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({}) }));
vi.mock('@/lib/utenteOLogin', () => ({ utenteECasa: async () => ({ casa: { household: { id: 'h1' } } }) }));
vi.mock('@/lib/data/householdPlans', () => ({ getPlanVersions: async () => [] }));
vi.mock('@/lib/data/goals', () => ({ getOpenGoals: vi.fn() }));
vi.mock('@/lib/data/goalSpending', () => ({ getSpecoCollegatoPerObiettivi: async () => ({ g1: 300 }) }));
vi.mock('@/lib/data/rientri', () => ({ getRientri: vi.fn() }));
vi.mock('@/app/casa/da-parte/DaParte', () => ({
  DaParte: (p: Record<string, unknown>) => {
    props = p;
    return null;
  },
}));
import { getOpenGoals } from '@/lib/data/goals';
import { getRientri } from '@/lib/data/rientri';
import DaPartePage from '@/app/casa/da-parte/page';

describe('pagina Da parte della Casa', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-20T10:00:00Z'));
    vi.mocked(getOpenGoals).mockResolvedValue([
      {
        id: 'g1', nome: 'Gas', importoTarget: 1000, modalita: 'bloccato', scadenza: null, categoriaId: 'c1',
        ricorrente: false, frequenzaMesi: null, stato: 'aperto', createdAt: '2026-11-01T10:00:00Z', accantonaDa: null,
      },
    ] as never);
    const rientro: Rientro = {
      id: 'r1', userId: 'u', householdId: 'h1', goalId: 'g1', accountId: null, importo: 100, mesi: 2,
      creatoIl: '2026-11-05', stato: 'aperto', fermatoIl: null,
    };
    vi.mocked(getRientri).mockResolvedValue([rientro]);
  });

  it('le card tengono conto del rientro maturato (stesso numero del disponibile)', async () => {
    const el = (await DaPartePage()) as { props: Record<string, unknown> };
    props = el.props;
    const unaVolta = props.unaVolta as { accantonato: number; spiegazione: { ingredienti: { etichetta: string }[] } }[];
    // bloccato 1000, speso 300, rientro maturato 50 (1 mese su 2): 750
    expect(unaVolta[0].accantonato).toBe(750);
    expect(unaVolta[0].spiegazione.ingredienti.map((i) => i.etichetta)).toContain('Rientro');
  });
});

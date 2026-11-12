import { describe, it, expect, vi } from 'vitest';
import CasaPage from '@/app/casa/page';

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({}) }));
vi.mock('@/lib/utenteOLogin', () => ({
  utenteECasa: async () => ({
    user: { id: 'u1' },
    casa: { household: { id: 'h1' }, members: [], invite: null, me: { userId: 'u1' } },
  }),
}));
vi.mock('@/lib/data/accounts', () => ({ getAccounts: vi.fn() }));
vi.mock('@/lib/loadCasaData', () => ({ loadCasaData: vi.fn() }));
vi.mock('@/lib/calculations/supporto/casaHome', () => ({ casaHomeDati: vi.fn() }));
vi.mock('@/app/casa/CasaHome', () => ({ CasaHome: function CasaHome() { return null; } }));
vi.mock('@/app/casa/VistaSemplice', () => ({ VistaSemplice: function VistaSemplice() { return null; } }));
vi.mock('@/app/casa/CasaSenzaCasa', () => ({ CasaSenzaCasa: () => null }));
import { getAccounts } from '@/lib/data/accounts';
import { loadCasaData } from '@/lib/loadCasaData';
import { casaHomeDati } from '@/lib/calculations/supporto/casaHome';

describe('pagina Casa', () => {
  it('legge i conti personali mentre i dati della casa sono ancora in lettura', async () => {
    let finisci: () => void = () => {};
    vi.mocked(loadCasaData).mockReturnValue(new Promise<never>((_r, rej) => { finisci = () => rej(new Error('x')); }));
    vi.mocked(getAccounts).mockResolvedValue([]);
    const pagina = CasaPage();
    await vi.waitFor(() => expect(getAccounts).toHaveBeenCalledTimes(1));
    finisci();
    await pagina;
    expect(loadCasaData).toHaveBeenCalledTimes(1);
  });

  it('se i dati della casa non si leggono la Casa si apre senza libretto', async () => {
    vi.mocked(loadCasaData).mockRejectedValue(new Error('x'));
    vi.mocked(getAccounts).mockResolvedValue([]);
    const el = (await CasaPage()) as { props: { libretto?: unknown; vociDaParte: unknown[] } };
    expect(el.props.libretto).toBeUndefined();
    expect(el.props.vociDaParte).toEqual([]);
  });

  it('con i dati passa alla Casa il libretto, la spiegazione e le voci da mettere da parte', async () => {
    vi.mocked(casaHomeDati).mockReturnValue({ gestisce: true, disponibile: 10 } as never);
    vi.mocked(loadCasaData).mockResolvedValue({
      piani: [],
      righe: {},
      debiti: [],
      obiettiviConAccantonato: [],
      aggiunta: { conti: [] },
      disponibile: { valore: 10, spiegazione: { valore: 10, formula: 'f', ingredienti: [] } },
    } as never);
    vi.mocked(getAccounts).mockResolvedValue([]);
    const el = (await CasaPage()) as { props: Record<string, unknown> };
    expect(casaHomeDati).toHaveBeenCalledWith(expect.anything(), 'u1', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(el.props.libretto).toEqual({ gestisce: true, disponibile: 10 });
    expect(el.props.spiegazione).toEqual({ valore: 10, formula: 'f', ingredienti: [] });
    expect(el.props.vociDaParte).toEqual([]);
  });

  describe('vista semplice', () => {
    const dati = {
      piani: [], righe: {}, debiti: [], obiettiviConAccantonato: [], aggiunta: { conti: [] },
      disponibile: { valore: 10, spiegazione: { valore: 10, formula: 'f', ingredienti: [] } },
    } as never;
    const tipo = async (gestisce: boolean, sp?: { vista?: string }) => {
      vi.mocked(casaHomeDati).mockReturnValue({ gestisce, vistaSemplice: { quota: 1 } } as never);
      vi.mocked(loadCasaData).mockResolvedValue(dati);
      vi.mocked(getAccounts).mockResolvedValue([]);
      const el = (await CasaPage({ searchParams: Promise.resolve(sp ?? {}) })) as { type: unknown };
      return (el.type as { name?: string }).name;
    };
    it('chi non gestisce vede la vista semplice', async () => {
      expect(await tipo(false)).toBe('VistaSemplice');
    });
    it('chi gestisce vede la Casa piena', async () => {
      expect(await tipo(true)).toBe('CasaHome');
    });
    it('con ?vista=completa anche chi non gestisce vede la Casa piena', async () => {
      expect(await tipo(false, { vista: 'completa' })).toBe('CasaHome');
    });
  });
});

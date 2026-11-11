import { describe, it, expect, vi } from 'vitest';
import CasaPage from '@/app/casa/page';

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({}) }));
vi.mock('@/lib/utenteOLogin', () => ({ utenteOLogin: async () => ({ id: 'u1' }) }));
vi.mock('@/lib/data/households', () => ({
  getMyHousehold: async () => ({ household: { id: 'h1' }, members: [], invite: null, me: { userId: 'u1' } }),
}));
vi.mock('@/lib/data/accounts', () => ({ getAccounts: vi.fn() }));
vi.mock('@/lib/data/householdPlans', () => ({ getPlanForMonth: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/loadCasaData', () => ({ loadCasaData: vi.fn() }));
vi.mock('@/app/casa/CasaHome', () => ({ CasaHome: () => null }));
vi.mock('@/app/casa/CasaSenzaCasa', () => ({ CasaSenzaCasa: () => null }));
import { getAccounts } from '@/lib/data/accounts';
import { loadCasaData } from '@/lib/loadCasaData';

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
});

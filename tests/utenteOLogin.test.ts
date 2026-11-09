import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import { utenteOLogin } from '@/lib/utenteOLogin';

const client = (risposta: unknown) => ({ auth: { getUser: async () => risposta } }) as never;

describe('utenteOLogin', () => {
  it('restituisce l utente', async () => {
    const user = { id: 'u1' };
    await expect(utenteOLogin(client({ data: { user }, error: null }))).resolves.toBe(user);
  });

  it('senza utente va al login', async () => {
    await expect(utenteOLogin(client({ data: { user: null }, error: null }))).rejects.toThrow('REDIRECT:/login');
  });

  it('con errore 4xx va al login', async () => {
    const error = Object.assign(new Error('x'), { status: 401 });
    await expect(utenteOLogin(client({ data: { user: null }, error }))).rejects.toThrow('REDIRECT:/login');
  });

  it.each([0, 500, 503])('con errore %s rilancia l errore', async (status) => {
    const error = Object.assign(new Error('fetch failed'), { status });
    await expect(utenteOLogin(client({ data: { user: null }, error }))).rejects.toBe(error);
  });
});

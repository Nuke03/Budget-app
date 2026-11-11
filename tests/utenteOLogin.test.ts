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

describe('leggiSessione e conUtente', () => {
  const token = `x.${btoa('{"sub":"u1"}').replace(/=+$/, '')}.y`;
  const conSessione = (user: unknown, sessione: unknown = { access_token: token }) =>
    ({
      auth: {
        getSession: async () => ({ data: { session: sessione } }),
        getUser: async (jwt?: string) => ({ data: { user: jwt === token ? user : null }, error: null }),
      },
    }) as never;

  it("legge l'id dal token senza chiamate di rete", async () => {
    const { leggiSessione } = await import('@/lib/utenteOLogin');
    await expect(leggiSessione(conSessione(null))).resolves.toEqual({ userId: 'u1', token });
  });

  it('senza sessione o con token rotto ritorna null', async () => {
    const { leggiSessione } = await import('@/lib/utenteOLogin');
    await expect(leggiSessione(conSessione(null, null))).resolves.toEqual({ userId: null, token: null });
    await expect(leggiSessione(conSessione(null, { access_token: 'rotto' }))).resolves.toEqual({
      userId: null,
      token: null,
    });
  });

  it('le letture partono prima della verifica e si usano se l utente coincide', async () => {
    const { conUtente } = await import('@/lib/utenteOLogin');
    const chiamate: (string | null)[] = [];
    const r = await conUtente(conSessione({ id: 'u1' }), async (id) => (chiamate.push(id), `dati di ${id}`));
    expect(r).toEqual({ user: { id: 'u1' }, dati: 'dati di u1' });
    expect(chiamate).toEqual(['u1']);
  });

  it('se l utente verificato è un altro le letture si rifanno con lui', async () => {
    const { conUtente } = await import('@/lib/utenteOLogin');
    const chiamate: (string | null)[] = [];
    const r = await conUtente(conSessione({ id: 'u2' }), async (id) => (chiamate.push(id), id));
    expect(r.dati).toBe('u2');
    expect(chiamate).toEqual(['u1', 'u2']);
  });

  it('senza utente va al login anche se le letture falliscono', async () => {
    const { conUtente } = await import('@/lib/utenteOLogin');
    await expect(
      conUtente(conSessione(null), async () => {
        throw new Error('rete');
      })
    ).rejects.toThrow('REDIRECT:/login');
  });
});

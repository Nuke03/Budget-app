import { describe, it, expect, vi, beforeEach } from 'vitest';

const signIn = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { signInWithPassword: signIn } }),
}));

import { login } from '@/app/login/actions';

function form(campi: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(campi)) f.set(k, v);
  return f;
}

beforeEach(() => {
  signIn.mockReset();
  signIn.mockResolvedValue({ error: null });
});

describe('login: ritorno alla pagina richiesta', () => {
  it('dopo l accesso torna al percorso interno indicato', async () => {
    const next = '/casa/inizia?modo=entra&codice=K7M2QX9P';
    await expect(login(form({ email: 'a@b.it', password: 'x', next }))).rejects.toThrow(`REDIRECT:${next}`);
  });

  it('senza next va alla home', async () => {
    await expect(login(form({ email: 'a@b.it', password: 'x' }))).rejects.toThrow('REDIRECT:/');
  });

  it.each(['//evil.com', 'https://evil.com', '\\evil.com', 'http:x'])('rifiuta next %s', async (next) => {
    await expect(login(form({ email: 'a@b.it', password: 'x', next }))).rejects.toThrow('REDIRECT:/');
  });

  it('con password errata resta sul login e conserva next', async () => {
    signIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    const next = '/casa/inizia?modo=entra';
    await expect(login(form({ email: 'a@b.it', password: 'x', next }))).rejects.toThrow(
      `REDIRECT:/login?error=${encodeURIComponent('Email o password errati.')}&next=${encodeURIComponent(next)}`
    );
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

const stato = vi.hoisted(() => ({ risposta: null as unknown }));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => stato.risposta } }),
}));
vi.mock('@/lib/loadHomeData', () => ({ loadHomeData: vi.fn() }));
vi.mock('@/app/HomeDashboard', () => ({ HomeDashboard: () => null }));

import HomePage from '@/app/page';

beforeEach(() => {
  stato.risposta = null;
});

describe('HomePage: utente non trovato', () => {
  it('senza sessione porta al login', async () => {
    stato.risposta = {
      data: { user: null },
      error: Object.assign(new Error('Auth session missing!'), { name: 'AuthSessionMissingError', status: 400 }),
    };
    await expect(HomePage()).rejects.toThrow('REDIRECT:/login');
  });

  it('senza errore e senza utente porta al login', async () => {
    stato.risposta = { data: { user: null }, error: null };
    await expect(HomePage()).rejects.toThrow('REDIRECT:/login');
  });

  it('con Supabase che non risponde l errore sale alla pagina del database, senza redirect', async () => {
    const errore = Object.assign(new Error('fetch failed'), { name: 'AuthRetryableFetchError', status: 0 });
    stato.risposta = { data: { user: null }, error: errore };
    await expect(HomePage()).rejects.toBe(errore);
  });

  it('un errore 503 sale alla pagina del database', async () => {
    const errore = Object.assign(new Error('unavailable'), { status: 503 });
    stato.risposta = { data: { user: null }, error: errore };
    await expect(HomePage()).rejects.toBe(errore);
  });
});

import { describe, it, expect, vi } from 'vitest';

const dati = vi.hoisted(() => ({ segna: vi.fn(async () => {}) }));
const azione = vi.hoisted(() => ({ segna: vi.fn(async () => {}) }));

vi.mock('next/navigation', () => ({
  redirect: (u: string) => {
    throw new Error(`REDIRECT:${u}`);
  },
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }),
      getSession: async () => ({ data: { session: null } }),
    },
  }),
}));
vi.mock('@/lib/data/agevolazioni', () => ({
  getSituazione: async () => {
    throw new Error('db');
  },
  getStatiVoci: async () => {
    throw new Error('db');
  },
  segnaSezioneApertaDati: dati.segna,
}));
vi.mock('@/app/agevolazioni/actions', () => ({
  segnaSezioneAperta: azione.segna,
  salvaSituazione: vi.fn(),
  segnaVoce: vi.fn(),
}));
vi.mock('@/app/agevolazioni/AgevolazioniVista', () => ({ AgevolazioniVista: () => null }));

import Pagina from '@/app/agevolazioni/page';

describe('pagina Agevolazioni', () => {
  it('segna la sezione aperta col livello dati, non con l azione, e si apre anche se le letture falliscono', async () => {
    const el = await Pagina();
    expect(el.props.situazione.isee).toBeNull();
    expect(el.props.stati).toEqual([]);
    expect(dati.segna).toHaveBeenCalledTimes(1);
    expect(azione.segna).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

const dati = vi.hoisted(() => ({ segna: vi.fn(async () => {}), letta: vi.fn() }));
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
  getSituazioneConApertura: (...a: unknown[]) => dati.letta(...a),
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
  beforeEach(() => {
    dati.segna.mockClear();
    dati.letta.mockReset();
    dati.letta.mockRejectedValue(new Error('db'));
  });
  it('segna la sezione aperta col livello dati, non con l azione, e si apre anche se le letture falliscono', async () => {
    const el = await Pagina();
    expect(el.props.situazione.isee).toBeNull();
    expect(el.props.stati).toEqual([]);
    expect(dati.segna).toHaveBeenCalledTimes(1);
    expect(azione.segna).not.toHaveBeenCalled();
  });
  const vuota = { isee: null, dsuData: null, comune: null, inAffitto: null, studente: null, piva: false };
  it('segna la sezione aperta una volta sola: se la riga lo dice già, non scrive', async () => {
    dati.letta.mockResolvedValue({ situazione: vuota, aperta: true });
    await Pagina();
    expect(dati.segna).not.toHaveBeenCalled();
    dati.letta.mockResolvedValue({ situazione: vuota, aperta: false });
    await Pagina();
    expect(dati.segna).toHaveBeenCalledTimes(1);
  });
});

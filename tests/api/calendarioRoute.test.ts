// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ rpc })) }));

import { GET } from '@/app/api/calendario/[token]/route';

const TOKEN = 'a'.repeat(43);
const feedDb = {
  nome_casa: 'Casa Rossi',
  membro: 'Fabio',
  giorno_versamento: 5,
  quota_mensile: 777,
  obiettivi: [],
  credito_proprio: 0,
  credito_altri: 0,
  ultimo_controllo: null,
  ultimo_checkin: null,
};
const chiama = (token: string) =>
  GET(new Request(`http://localhost/api/calendario/${token}`), { params: Promise.resolve({ token }) });

beforeEach(() => {
  rpc.mockReset();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
});

describe('GET /api/calendario/[token]', () => {
  it('token sconosciuto o revocato: 404 con lo stesso corpo', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    const a = await chiama(TOKEN);
    const b = await chiama('corto');
    expect(a.status).toBe(404);
    expect(b.status).toBe(404);
    expect(await a.text()).toBe(await b.text());
  });

  it('token corto o con caratteri strani: 404 senza chiamare rpc', async () => {
    for (const t of ['x', 'a'.repeat(31), 'a'.repeat(40) + '!!', 'a'.repeat(40) + '%20']) {
      expect((await chiama(t)).status).toBe(404);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it('token valido: 200, text/calendar; charset=utf-8, no-store e BEGIN:VCALENDAR', async () => {
    rpc.mockResolvedValueOnce({ data: feedDb, error: null });
    const r = await chiama(TOKEN);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('text/calendar; charset=utf-8');
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(await r.text()).toContain('BEGIN:VCALENDAR');
    expect(rpc).toHaveBeenCalledWith('get_calendar_feed', { p_token: TOKEN });
  });

  it('il suffisso .ics viene ignorato', async () => {
    rpc.mockResolvedValueOnce({ data: feedDb, error: null });
    const r = await chiama(`${TOKEN}.ics`);
    expect(r.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('get_calendar_feed', { p_token: TOKEN });
  });

  it('forma non valida: 404 uguale agli altri', async () => {
    rpc.mockResolvedValueOnce({ data: { x: 1 }, error: null });
    const r = await chiama(TOKEN);
    expect(r.status).toBe(404);
    expect(await r.text()).toBe('Non trovato');
  });

  it('errore della rpc: 503', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    const r = await chiama(TOKEN);
    expect(r.status).toBe(503);
    expect(await r.text()).toBe('Servizio non disponibile');
  });

  it('non richiede nessuna sessione né cookie', async () => {
    rpc.mockResolvedValueOnce({ data: feedDb, error: null });
    const req = new Request('http://localhost/x');
    expect(req.headers.get('cookie')).toBeNull();
    const r = await GET(req, { params: Promise.resolve({ token: TOKEN }) });
    expect(r.status).toBe(200);
  });
});

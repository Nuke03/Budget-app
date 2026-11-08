import { describe, it, expect } from 'vitest';
import { pingDatabase, isAuthorizedCron } from '@/lib/data/keepAlive';
import { fakeSelectClient } from '../helpers/fakeSupabase';

describe('pingDatabase', () => {
  it('riporta ok quando il database risponde', async () => {
    await expect(pingDatabase(fakeSelectClient([]))).resolves.toEqual({ ok: true });
  });

  it('riporta il messaggio quando il database risponde con un errore', async () => {
    const builder: any = {
      select: () => builder,
      limit: () => Promise.resolve({ data: null, error: { message: 'fetch failed' } }),
    };
    const client = { from: () => builder } as any;
    await expect(pingDatabase(client)).resolves.toEqual({ ok: false, error: 'fetch failed' });
  });

  it('non lancia eccezioni se la richiesta fallisce del tutto', async () => {
    const client = { from: () => { throw new Error('rete giù'); } } as any;
    await expect(pingDatabase(client)).resolves.toEqual({ ok: false, error: 'rete giù' });
  });
});

describe('isAuthorizedCron', () => {
  it('accetta tutto se CRON_SECRET non è impostato', () => {
    expect(isAuthorizedCron(null, undefined)).toBe(true);
  });

  it('accetta il token corretto', () => {
    expect(isAuthorizedCron('Bearer segreto', 'segreto')).toBe(true);
  });

  it('rifiuta un token sbagliato o mancante', () => {
    expect(isAuthorizedCron('Bearer altro', 'segreto')).toBe(false);
    expect(isAuthorizedCron(null, 'segreto')).toBe(false);
  });
});

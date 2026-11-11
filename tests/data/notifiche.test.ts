/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { salvaIscrizione, rispondiNotifiche, segnaNessunaSpesa } from '@/lib/data/notifiche';

function clientUpsert(error: unknown = null) {
  const upsert = vi.fn().mockResolvedValue({ error });
  const from = vi.fn(() => ({ upsert }));
  return { client: { from } as any, from, upsert };
}

const SUB = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
  keys: { p256dh: 'P', auth: 'A' },
};

describe('salvaIscrizione', () => {
  it('fa upsert su endpoint', async () => {
    const { client, from, upsert } = clientUpsert();
    await salvaIscrizione(client, SUB);
    expect(from).toHaveBeenCalledWith('push_iscrizioni');
    expect(upsert).toHaveBeenCalledWith(
      { endpoint: SUB.endpoint, p256dh: 'P', auth: 'A' },
      { onConflict: 'endpoint' },
    );
  });

  it('rifiuta un endpoint fuori dalla lista dei servizi push, senza scrivere', async () => {
    const { client, upsert } = clientUpsert();
    await expect(salvaIscrizione(client, { ...SUB, endpoint: 'https://evil.example.com/x' })).rejects.toThrow();
    await expect(salvaIscrizione(client, { ...SUB, endpoint: 'http://fcm.googleapis.com/x' })).rejects.toThrow();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('rifiuta chiavi mancanti', async () => {
    const { client, upsert } = clientUpsert();
    await expect(salvaIscrizione(client, { endpoint: SUB.endpoint })).rejects.toThrow();
    await expect(salvaIscrizione(client, { endpoint: SUB.endpoint, keys: { p256dh: 'P' } })).rejects.toThrow();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rilancia l'errore del database", async () => {
    const { client } = clientUpsert({ message: 'rls' });
    await expect(salvaIscrizione(client, SUB)).rejects.toEqual({ message: 'rls' });
  });
});

describe('rispondiNotifiche', () => {
  it('fa upsert su promemoria_utente con la risposta', async () => {
    const { client, from, upsert } = clientUpsert();
    await rispondiNotifiche(client, true);
    expect(from).toHaveBeenCalledWith('promemoria_utente');
    expect(upsert).toHaveBeenCalledWith({ notifiche_attive: true }, { onConflict: 'user_id' });
    await rispondiNotifiche(client, false);
    expect(upsert).toHaveBeenLastCalledWith({ notifiche_attive: false }, { onConflict: 'user_id' });
  });
});

describe('segnaNessunaSpesa', () => {
  it('fa upsert di nessuna_spesa_fino_al', async () => {
    const { client, upsert } = clientUpsert();
    await segnaNessunaSpesa(client, '2026-11-11');
    expect(upsert).toHaveBeenCalledWith({ nessuna_spesa_fino_al: '2026-11-11' }, { onConflict: 'user_id' });
  });

  it('rifiuta una data che non è YYYY-MM-DD', async () => {
    const { client, upsert } = clientUpsert();
    await expect(segnaNessunaSpesa(client, 'domani')).rejects.toThrow();
    expect(upsert).not.toHaveBeenCalled();
  });
});

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import {
  salvaIscrizione,
  rispondiNotifiche,
  segnaNessunaSpesa,
  unisciRimandati,
  leggiRimandati,
  salvaRimandato,
} from '@/lib/data/notifiche';

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

describe('rimandati (Più tardi e Va bene così, per tutti i telefoni)', () => {
  it('unisciRimandati aggiunge una chiave senza toccare le altre ancora valide', () => {
    expect(unisciRimandati({ a: '2026-12-01' }, 'b', '2026-11-20', '2026-11-19')).toEqual({
      a: '2026-12-01',
      b: '2026-11-20',
    });
  });

  it('unisciRimandati toglie le chiavi scadute (la data è il primo giorno in cui ricompaiono)', () => {
    expect(
      unisciRimandati({ vecchia: '2026-11-19', ieri: '2026-11-10', valida: '2026-11-20' }, 'b', '2026-11-25', '2026-11-19')
    ).toEqual({ valida: '2026-11-20', b: '2026-11-25' });
  });

  it('unisciRimandati sovrascrive la stessa chiave e scarta i valori che non sono date', () => {
    expect(unisciRimandati({ a: '2026-11-20', x: 'domani' as string }, 'a', '2027-05-19', '2026-11-19')).toEqual({
      a: '2027-05-19',
    });
  });

  it('unisciRimandati non scrive una data che è già passata', () => {
    expect(unisciRimandati({}, 'a', '2026-11-19', '2026-11-19')).toEqual({});
  });

  it('leggiRimandati torna la mappa, ripulita; senza riga è vuota', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { rimandati: { a: '2026-11-20', b: 5 } }, error: null });
    const client: any = { from: vi.fn(() => ({ select: () => ({ maybeSingle }) })) };
    expect(await leggiRimandati(client)).toEqual({ a: '2026-11-20' });
    maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await leggiRimandati(client)).toEqual({});
  });

  it("leggiRimandati rilancia l'errore (il chiamante ripiega su localStorage)", async () => {
    const client: any = { from: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'no' } }) }) }) };
    await expect(leggiRimandati(client)).rejects.toEqual({ message: 'no' });
  });

  it('salvaRimandato legge la riga, unisce una sola chiave e fa upsert su user_id', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { rimandati: { vecchia: '2026-11-01', ok: '2026-12-01' } }, error: null });
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const client: any = { from: vi.fn(() => ({ select: () => ({ maybeSingle }), upsert })) };
    const r = await salvaRimandato(client, 'p1', '2027-05-19', '2026-11-19');
    expect(upsert).toHaveBeenCalledWith({ rimandati: { ok: '2026-12-01', p1: '2027-05-19' } }, { onConflict: 'user_id' });
    expect(r).toEqual({ ok: '2026-12-01', p1: '2027-05-19' });
  });

  it("salvaRimandato rilancia l'errore di scrittura", async () => {
    const client: any = {
      from: () => ({
        select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        upsert: async () => ({ error: { message: 'rls' } }),
      }),
    };
    await expect(salvaRimandato(client, 'p1', '2027-05-19', '2026-11-19')).rejects.toEqual({ message: 'rls' });
  });
});

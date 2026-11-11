import { describe, it, expect } from 'vitest';
import { leggiStatiPersone } from '@/lib/data/statoNotifiche';
import { createFakeDb } from '../helpers/fakeDb';

const FCM = 'https://fcm.googleapis.com/fcm/send/';
const OGGI = '2026-11-11';

function casaConDue() {
  return createFakeDb(
    {
      push_iscrizioni: [
        { id: 's1', user_id: 'U1', endpoint: `${FCM}a`, p256dh: 'p1', auth: 'a1' },
        { id: 's2', user_id: 'U1', endpoint: `${FCM}b`, p256dh: 'p2', auth: 'a2' },
        { id: 's3', user_id: 'U2', endpoint: `${FCM}c`, p256dh: 'p3', auth: 'a3' },
      ],
      promemoria_utente: [{ user_id: 'U1', notifiche_attive: true, ultima_notifica_il: '2026-11-01' }],
      transactions: [
        // 23:30 UTC del 10 è già l'11 a Roma
        { id: 't1', user_id: 'U1', created_at: '2026-11-10T23:30:00Z' },
        { id: 't2', user_id: 'U1', created_at: '2026-11-02T10:00:00Z' },
      ],
      households: [{ id: 'H1', nome: 'Casa', created_at: '2026-01-01T00:00:00Z', archiviata_il: null, created_by: 'U1' }],
      household_members: [
        { household_id: 'H1', user_id: 'U1', display_name: 'A', joined_at: '2026-01-01T00:00:00Z', slot: 1, attivo: true },
        { household_id: 'H1', user_id: 'U2', display_name: 'B', joined_at: '2026-01-02T00:00:00Z', slot: 2, attivo: true },
      ],
      household_plans: [
        {
          id: 'P1', household_id: 'H1', valido_dal: '2026-01-01', giorno_versamento: 12, regola: 'proporzionale',
          cuscinetto_obiettivo: 0, cuscinetto_quota_mensile: 0, arrotondamento: 0, totale_mensile: 700,
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      household_plan_shares: [
        { plan_id: 'P1', slot: 1, user_id: 'U1', display_name: 'A', reddito_netto_mensile: 1, reddito_irregolare: false, percentuale: null, in_casa_dal: null, esce_dal: null, quota_mensile: 400 },
        { plan_id: 'P1', slot: 2, user_id: 'U2', display_name: 'B', reddito_netto_mensile: 1, reddito_irregolare: false, percentuale: null, in_casa_dal: null, esce_dal: null, quota_mensile: 300 },
      ],
    },
    { userId: 'service', senzaRls: true },
  );
}

describe('leggiStatiPersone', () => {
  it('nessuna iscrizione: lista vuota', async () => {
    const db = createFakeDb({}, { userId: 'service', senzaRls: true });
    await expect(leggiStatiPersone(db.client, OGGI)).resolves.toEqual([]);
  });

  it('stato per persona: iscrizioni, ultima creazione a Roma, promemoria, gestore, versamento, check-in', async () => {
    const out = await leggiStatiPersone(casaConDue().client, OGGI);
    const u1 = out.find((p) => p.stato.userId === 'U1')!;
    const u2 = out.find((p) => p.stato.userId === 'U2')!;

    expect(u1.iscrizioni.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(u1.iscrizioni[0]).toEqual({ id: 's1', endpoint: `${FCM}a`, p256dh: 'p1', auth: 'a1' });
    expect(u1.stato).toMatchObject({
      iscritta: true,
      notificheAttive: true,
      ultimaCreazione: OGGI,
      ultimaNotificaIl: '2026-11-01',
      gestisce: true,
      checkinDaFare: '2026-10-01',
      versamento: { giorno: 12, importo: 400, versato: 0, mese: '2026-11-01' },
    });

    expect(u2.stato).toMatchObject({
      notificheAttive: null,
      ultimaCreazione: null,
      ultimaNotificaIl: null,
      gestisce: false,
      checkinDaFare: null,
      versamento: { giorno: 12, importo: 300, versato: 0, mese: '2026-11-01' },
    });
  });

  it('casa archiviata: nessun dato di casa, restano i promemoria personali', async () => {
    const db = casaConDue();
    db.tables.households[0].archiviata_il = '2026-10-01T00:00:00Z';
    const [u1] = (await leggiStatiPersone(db.client, OGGI)).filter((p) => p.stato.userId === 'U1');
    expect(u1.stato).toMatchObject({ gestisce: false, checkinDaFare: null, versamento: null });
  });
});

// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createFakeDb } from '../helpers/fakeDb';

const { sendNotification, setVapidDetails } = vi.hoisted(() => ({
  sendNotification: vi.fn(),
  setVapidDetails: vi.fn(),
}));
vi.mock('web-push', () => ({ setVapidDetails, sendNotification }));

let db: ReturnType<typeof createFakeDb>;
let selects: { tabella: string; colonne: string }[];
const createClient = vi.fn((..._args: unknown[]) => {
  return {
    from(nome: string) {
      const b = db.client.from(nome);
      const select = b.select;
      b.select = (colonne: string) => {
        selects.push({ tabella: nome, colonne });
        return select(colonne);
      };
      return b;
    },
    rpc: db.client.rpc,
  };
});
vi.mock('@supabase/supabase-js', () => ({ createClient: (...a: unknown[]) => createClient(...a) }));

import { GET } from '@/app/api/promemoria/route';

const SEGRETO = 's3gr3to';
const OGGI = '2026-11-11';
const sub = (id: string, endpoint: string, user = 'U1') => ({
  id,
  user_id: user,
  endpoint,
  p256dh: `p-${id}`,
  auth: `a-${id}`,
});
const FCM = 'https://fcm.googleapis.com/fcm/send/';

function seed(extra: Partial<Record<string, any[]>> = {}) {
  db = createFakeDb(
    {
      push_iscrizioni: [sub('s1', `${FCM}a`), sub('s2', `${FCM}b`)],
      promemoria_utente: [{ user_id: 'U1', notifiche_attive: true }],
      // quattro giorni senza spese: scatta il promemoria "spese"
      transactions: [{ id: 't1', user_id: 'U1', created_at: '2026-11-07T10:00:00Z', importo: 12.34 }],
      ...extra,
    },
    { userId: 'service', senzaRls: true },
  );
}

const chiama = (autorizzazione: string | null = `Bearer ${SEGRETO}`) =>
  GET(
    new Request('http://localhost/api/promemoria', {
      headers: autorizzazione ? { authorization: autorizzazione } : {},
    }),
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-11T16:00:00Z'));
  sendNotification.mockReset().mockResolvedValue({ statusCode: 201 });
  setVapidDetails.mockReset();
  createClient.mockClear();
  selects = [];
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  process.env.CRON_SECRET = SEGRETO;
  process.env.VAPID_SUBJECT = 'mailto:test@example.com';
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'pub';
  process.env.VAPID_PRIVATE_KEY = 'priv';
  seed();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('GET /api/promemoria', () => {
  it('senza il segreto giusto: 401 e nessun client creato', async () => {
    expect((await chiama(null)).status).toBe(401);
    expect((await chiama('Bearer sbagliato')).status).toBe(401);
    expect(createClient).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('CRON_SECRET non impostato: 401 (la route usa la chiave di servizio, non resta mai aperta)', async () => {
    delete process.env.CRON_SECRET;
    expect((await chiama(null)).status).toBe(401);
    expect((await chiama('Bearer undefined')).status).toBe(401);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('chiave di servizio mancante: 500 senza dettagli', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const r = await chiama();
    expect(r.status).toBe(500);
    expect(await r.text()).not.toContain('SERVICE');
  });

  it('persona da avvisare con 2 iscrizioni: 2 invii e promemoria aggiornato una volta', async () => {
    const aggiornamenti: any[] = [];
    const from = createClient.getMockImplementation()!;
    createClient.mockImplementationOnce((...a: unknown[]) => {
      const c: any = from(...a);
      const fromOriginale = c.from;
      c.from = (nome: string) => {
        const b = fromOriginale(nome);
        const update = b.update;
        b.update = (p: any) => {
          if (nome === 'promemoria_utente') aggiornamenti.push(p);
          return update(p);
        };
        return b;
      };
      return c;
    });
    const r = await chiama();
    expect(await r.json()).toEqual({ inviate: 2, rimosse: 0 });
    expect(sendNotification).toHaveBeenCalledTimes(2);
    expect(setVapidDetails).toHaveBeenCalledWith('mailto:test@example.com', 'pub', 'priv');
    expect(aggiornamenti).toEqual([{ ultima_spese_il: OGGI, ultima_notifica_il: OGGI }]);
    expect(db.tables.promemoria_utente[0]).toMatchObject({
      user_id: 'U1',
      notifiche_attive: true,
      ultima_spese_il: OGGI,
      ultima_notifica_il: OGGI,
    });
  });

  it('chi ha già ricevuto la notifica oggi non la riceve di nuovo', async () => {
    await chiama();
    sendNotification.mockClear();
    const r = await chiama();
    expect(await r.json()).toEqual({ inviate: 0, rimosse: 0 });
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('iscrizione che risponde 410: cancellata, le altre proseguono', async () => {
    sendNotification.mockImplementation(async (s: any) => {
      if (s.endpoint.endsWith('/a')) throw Object.assign(new Error('gone'), { statusCode: 410 });
      return { statusCode: 201 };
    });
    const r = await chiama();
    expect(await r.json()).toEqual({ inviate: 1, rimosse: 1 });
    expect(db.tables.push_iscrizioni.map((x) => x.id)).toEqual(['s2']);
    expect(db.tables.promemoria_utente[0].ultima_spese_il).toBe(OGGI);
  });

  it('un errore qualsiasi non cancella l\'iscrizione e non segna la notifica come mandata', async () => {
    sendNotification.mockRejectedValue(Object.assign(new Error('boom'), { statusCode: 500 }));
    const r = await chiama();
    expect(await r.json()).toEqual({ inviate: 0, rimosse: 0 });
    expect(db.tables.push_iscrizioni).toHaveLength(2);
    expect(db.tables.promemoria_utente[0].ultima_notifica_il).toBeUndefined();
  });

  it('errore su una persona non ferma le altre', async () => {
    seed({
      push_iscrizioni: [sub('s1', `${FCM}a`, 'U1'), sub('s2', `${FCM}b`, 'U2')],
      promemoria_utente: [
        { user_id: 'U1', notifiche_attive: true },
        { user_id: 'U2', notifiche_attive: true },
      ],
      transactions: [
        { id: 't1', user_id: 'U1', created_at: '2026-11-07T10:00:00Z' },
        { id: 't2', user_id: 'U2', created_at: '2026-11-07T10:00:00Z' },
      ],
    });
    sendNotification.mockImplementation(async (s: any) => {
      if (s.endpoint.endsWith('/a')) throw new TypeError('rete giù');
      return { statusCode: 201 };
    });
    const r = await chiama();
    expect(await r.json()).toEqual({ inviate: 1, rimosse: 0 });
    const righe = db.tables.promemoria_utente;
    expect(righe.find((x) => x.user_id === 'U2')?.ultima_notifica_il).toBe(OGGI);
    expect(righe.find((x) => x.user_id === 'U1')?.ultima_notifica_il).toBeUndefined();
  });

  it('un endpoint fuori dalla lista dei servizi push non viene mai chiamato', async () => {
    seed({
      push_iscrizioni: [sub('s1', 'https://evil.example.com/x'), sub('s2', `${FCM}b`)],
    });
    const r = await chiama();
    expect(await r.json()).toEqual({ inviate: 1, rimosse: 0 });
    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(sendNotification.mock.calls[0][0].endpoint).toBe(`${FCM}b`);
    expect(console.error).toHaveBeenCalled();
  });

  it('la query sulle transazioni seleziona solo created_at', async () => {
    await chiama();
    const tx = selects.filter((s) => s.tabella === 'transactions');
    expect(tx.length).toBeGreaterThan(0);
    for (const s of tx) expect(s.colonne).toBe('created_at');
  });

  it('con una casa (percorso casa eseguito) le transazioni restano lette solo per created_at', async () => {
    seed({
      transactions: [{ id: 't1', user_id: 'U1', created_at: '2026-11-10T10:00:00Z', importo: 99.99, pagata_da_user_id: 'U1' }],
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
    });
    const r = await chiama();
    expect(await r.json()).toEqual({ inviate: 2, rimosse: 0 });
    expect(selects.some((s) => s.tabella === 'household_plans')).toBe(true);
    const tx = selects.filter((s) => s.tabella === 'transactions');
    expect(tx.length).toBeGreaterThan(0);
    for (const s of tx) expect(s.colonne).toBe('created_at');
    const dati = JSON.parse(sendNotification.mock.calls[0][1]);
    expect(dati.url).toBe('/casa');
    expect(dati.testo).not.toContain('99');
  });

  it('il payload della notifica spese non contiene importi personali', async () => {
    await chiama();
    const [subscription, payload] = sendNotification.mock.calls[0];
    expect(subscription).toEqual({ endpoint: `${FCM}a`, keys: { p256dh: 'p-s1', auth: 'a-s1' } });
    const dati = JSON.parse(payload);
    expect(Object.keys(dati).sort()).toEqual(['testo', 'titolo', 'url']);
    expect(dati.url).toBe('/in-pari');
    expect(payload).not.toMatch(/\d|€|12[.,]34/);
  });

  it('chi non ha detto sì alle notifiche non riceve niente', async () => {
    seed({ promemoria_utente: [{ user_id: 'U1', notifiche_attive: null }] });
    const r = await chiama();
    expect(await r.json()).toEqual({ inviate: 0, rimosse: 0 });
    expect(sendNotification).not.toHaveBeenCalled();
  });
});

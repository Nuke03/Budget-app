import { describe, it, expect } from 'vitest';
import { getMyCalendarFeed, rotateCalendarFeed, revokeCalendarFeed } from '@/lib/data/calendarFeeds';
import { createFakeDb } from '../helpers/fakeDb';
import { fakeRpcClient } from '../helpers/fakeRpc';

const riga = (id: string, created: string, revocato: string | null) => ({
  id,
  household_id: 'h1',
  user_id: 'u1',
  token: `tok-${id}`,
  created_at: created,
  revocato_il: revocato,
});

describe('calendarFeeds', () => {
  it('getMyCalendarFeed mappa il feed attivo e ignora i revocati', async () => {
    const db = createFakeDb({
      calendar_feeds: [
        riga('f1', '2026-11-01T00:00:00Z', '2026-11-02T00:00:00Z'),
        riga('f2', '2026-11-03T00:00:00Z', null),
      ],
    }, { userId: 'u1' });
    const feed = await getMyCalendarFeed(db.client);
    expect(feed).toEqual({
      id: 'f2',
      householdId: 'h1',
      userId: 'u1',
      token: 'tok-f2',
      createdAt: '2026-11-03T00:00:00Z',
      revocatoIl: null,
    });
  });

  it('getMyCalendarFeed senza feed attivo ritorna null', async () => {
    const db = createFakeDb({ calendar_feeds: [riga('f1', '2026-11-01T00:00:00Z', '2026-11-02T00:00:00Z')] }, { userId: 'u1' });
    expect(await getMyCalendarFeed(db.client)).toBeNull();
  });

  it('rotateCalendarFeed chiama rotate_calendar_feed e ritorna il token', async () => {
    const { client, calls } = fakeRpcClient({ rotate_calendar_feed: { data: 'nuovotoken' } });
    expect(await rotateCalendarFeed(client)).toBe('nuovotoken');
    expect(calls[0].name).toBe('rotate_calendar_feed');
  });

  it('revokeCalendarFeed chiama revoke_calendar_feed', async () => {
    const { client, calls } = fakeRpcClient({ revoke_calendar_feed: { data: null } });
    await revokeCalendarFeed(client);
    expect(calls[0].name).toBe('revoke_calendar_feed');
  });

  it('rilancia gli errori delle RPC', async () => {
    const { client } = fakeRpcClient({
      rotate_calendar_feed: { error: { message: 'boom' } },
      revoke_calendar_feed: { error: { message: 'boom' } },
    });
    await expect(rotateCalendarFeed(client)).rejects.toBeTruthy();
    await expect(revokeCalendarFeed(client)).rejects.toBeTruthy();
  });
});

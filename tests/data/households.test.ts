import { describe, it, expect } from 'vitest';
import {
  getMyHousehold,
  createHousehold,
  createInvite,
  revokeInvite,
  joinHousehold,
  leaveHousehold,
  closeHousehold,
  CasaBloccataError,
  formatCodiceInvito,
} from '@/lib/data/households';
import { createFakeDb } from '../helpers/fakeDb';
import { fakeRpcClient } from '../helpers/fakeRpc';

const H = 'h1';
const passato = '2020-01-01T00:00:00Z';
const futuro = '2999-01-01T00:00:00Z';

function seed(extra: { members?: object[]; invites?: object[]; households?: object[] } = {}) {
  return createFakeDb(
    {
      households: (extra.households as Record<string, unknown>[]) ?? [
        { id: H, nome: 'Casa mia', created_at: passato, archiviata_il: null, created_by: 'u1' },
      ],
      household_members: (extra.members as Record<string, unknown>[]) ?? [
        { household_id: H, user_id: 'u2', display_name: 'Anna', joined_at: passato, slot: 2, attivo: true },
        { household_id: H, user_id: 'u1', display_name: 'Fabio', joined_at: passato, slot: 1, attivo: true },
        { household_id: H, user_id: 'u3', display_name: 'Ex', joined_at: passato, slot: 3, attivo: false },
      ],
      household_invites: (extra.invites as Record<string, unknown>[]) ?? [],
    },
    { userId: 'u1' }
  );
}

describe('getMyHousehold', () => {
  it('ritorna null per chi non ha una riga di membro', async () => {
    const db = createFakeDb({ households: [], household_members: [], household_invites: [] }, { userId: 'u1' });
    expect(await getMyHousehold(db.client, 'u1')).toBeNull();
  });

  it('ritorna null per un membro con attivo false (casa chiusa)', async () => {
    const db = seed({
      households: [{ id: H, nome: 'Casa mia', created_at: passato, archiviata_il: passato, created_by: 'u1' }],
      members: [{ household_id: H, user_id: 'u1', display_name: 'Fabio', joined_at: passato, slot: 1, attivo: false }],
    });
    expect(await getMyHousehold(db.client, 'u1')).toBeNull();
  });

  it('ritorna casa, solo i membri attivi ordinati per slot e il membro corrente', async () => {
    const db = seed();
    const casa = await getMyHousehold(db.client, 'u1');
    expect(casa?.household).toEqual({ id: H, nome: 'Casa mia', createdAt: passato, archiviataIl: null, createdBy: 'u1' });
    expect(casa?.members.map((m) => m.displayName)).toEqual(['Fabio', 'Anna']);
    expect(casa?.me.userId).toBe('u1');
    expect(casa?.invite).toBeNull();
  });

  it('ritorna null se la casa è archiviata', async () => {
    const db = seed({ households: [{ id: H, nome: 'x', created_at: passato, archiviata_il: passato }] });
    expect(await getMyHousehold(db.client, 'u1')).toBeNull();
  });

  it('ignora inviti revocati e scaduti e prende il più recente valido', async () => {
    const db = seed({
      invites: [
        { id: 'i1', household_id: H, codice: 'AAAAAAAA', created_at: '2026-01-01T00:00:00Z', scade_il: futuro, revocato_il: null },
        { id: 'i2', household_id: H, codice: 'BBBBBBBB', created_at: '2026-03-01T00:00:00Z', scade_il: futuro, revocato_il: passato },
        { id: 'i3', household_id: H, codice: 'CCCCCCCC', created_at: '2026-04-01T00:00:00Z', scade_il: passato, revocato_il: null },
        { id: 'i4', household_id: H, codice: 'DDDDDDDD', created_at: '2026-02-01T00:00:00Z', scade_il: futuro, revocato_il: null },
      ],
    });
    const casa = await getMyHousehold(db.client, 'u1');
    expect(casa?.invite?.codice).toBe('DDDDDDDD');
  });
});

describe('RPC', () => {
  it("createHousehold chiama create_household con p_nome e p_display_name e ritorna l'id", async () => {
    const { client, calls } = fakeRpcClient({ create_household: { data: 'h9' } });
    const id = await createHousehold(client, { nome: 'Casa', displayName: 'Fabio' });
    expect(id).toBe('h9');
    expect(calls[0]).toEqual({ name: 'create_household', args: { p_nome: 'Casa', p_display_name: 'Fabio' } });
  });

  it('createInvite chiama create_invite con p_household e ritorna il codice', async () => {
    const { client, calls } = fakeRpcClient({ create_invite: { data: 'K7M2QX9P' } });
    expect(await createInvite(client, 'h1')).toBe('K7M2QX9P');
    expect(calls[0]).toEqual({ name: 'create_invite', args: { p_household: 'h1' } });
  });

  it('revokeInvite chiama revoke_invite', async () => {
    const { client, calls } = fakeRpcClient({ revoke_invite: {} });
    await revokeInvite(client, 'h1');
    expect(calls[0]).toEqual({ name: 'revoke_invite', args: { p_household: 'h1' } });
  });

  it('joinHousehold passa il codice digitato senza spazi ai bordi', async () => {
    const { client, calls } = fakeRpcClient({ join_household: { data: 'h1' } });
    await joinHousehold(client, { codice: ' k7m2-qx9p ', displayName: 'Anna' });
    expect(calls[0]).toEqual({ name: 'join_household', args: { p_codice: 'k7m2-qx9p', p_display_name: 'Anna' } });
  });

  it("joinHousehold rilancia l'errore dell'RPC", async () => {
    const { client } = fakeRpcClient({ join_household: { error: { message: 'Codice non valido o scaduto' } } });
    await expect(joinHousehold(client, { codice: 'x', displayName: 'A' })).rejects.toMatchObject({
      message: 'Codice non valido o scaduto',
    });
  });

  it.each([
    ['CREDITO_APERTO', 'credito'],
    ['DEBITO_APERTO', 'debito'],
    ['ARRETRATI_APERTI', 'arretrati'],
    ['ULTIMO_MEMBRO', 'ultimo_membro'],
  ])('leaveHousehold traduce %s in CasaBloccataError con reason %s', async (msg, reason) => {
    const { client } = fakeRpcClient({ leave_household: { error: { message: msg } } });
    const err = await leaveHousehold(client).catch((e) => e);
    expect(err).toBeInstanceOf(CasaBloccataError);
    expect(err.reason).toBe(reason);
  });

  it("leaveHousehold rilancia gli altri errori com'è", async () => {
    const { client } = fakeRpcClient({ leave_household: { error: { message: 'boom' } } });
    const err = await leaveHousehold(client).catch((e) => e);
    expect(err).not.toBeInstanceOf(CasaBloccataError);
    expect(err.message).toBe('boom');
  });

  it('closeHousehold traduce NON_ULTIMO_MEMBRO', async () => {
    const { client } = fakeRpcClient({ close_household: { error: { message: 'NON_ULTIMO_MEMBRO' } } });
    const err = await closeHousehold(client).catch((e) => e);
    expect(err).toBeInstanceOf(CasaBloccataError);
    expect(err.reason).toBe('non_ultimo_membro');
  });
});

describe('formatCodiceInvito', () => {
  it('mette il trattino a metà', () => {
    expect(formatCodiceInvito('K7M2QX9P')).toBe('K7M2-QX9P');
  });
});

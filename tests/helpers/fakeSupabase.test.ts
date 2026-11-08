import { describe, it, expect } from 'vitest';
import { fakeSelectClient } from './fakeSupabase';

describe('fakeSelectClient', () => {
  it('la catena select().is().order() risolve con le righe', async () => {
    const rows = [{ id: 1 }, { id: 2 }];
    const client = fakeSelectClient(rows);
    const { data, error } = await client.from('accounts').select('id').is('household_id', null).order('nome');
    expect(error).toBeNull();
    expect(data).toEqual(rows);
  });

  it('select().is().eq().limit() resta thenable e risolve con le righe', async () => {
    const rows = [{ id: 1 }];
    const client = fakeSelectClient(rows);
    const { data, error } = await client
      .from('transactions')
      .select('importo')
      .is('household_id', null)
      .eq('tipo', 'expense')
      .limit(3);
    expect(error).toBeNull();
    expect(data).toEqual(rows);
  });
});

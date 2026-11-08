import { describe, it, expect } from 'vitest';
import { applyScope, casa, PERSONALE, scopeHouseholdId } from '@/lib/data/scope';
import { createRecordingClient, callsOf } from '../helpers/recordingSupabase';

function query() {
  const { client, calls } = createRecordingClient();
  return { q: client.from('accounts').select('id'), calls };
}

describe('scope', () => {
  it('applyScope personale chiama is(household_id, null)', () => {
    const { q, calls } = query();
    applyScope(q, PERSONALE);
    expect(callsOf(calls[0], 'is')).toEqual([['household_id', null]]);
    expect(callsOf(calls[0], 'eq')).toEqual([]);
  });

  it('applyScope casa chiama eq(household_id, id)', () => {
    const { q, calls } = query();
    applyScope(q, casa('h1'));
    expect(callsOf(calls[0], 'eq')).toEqual([['household_id', 'h1']]);
    expect(callsOf(calls[0], 'is')).toEqual([]);
  });

  it("scopeHouseholdId ritorna null per personale e l'id per casa", () => {
    expect(scopeHouseholdId(PERSONALE)).toBeNull();
    expect(scopeHouseholdId(casa('h1'))).toBe('h1');
  });
});

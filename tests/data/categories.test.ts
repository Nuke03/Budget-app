import { describe, it, expect } from 'vitest';
import { getCategories, createCategory, updateCategory, archiveCategory } from '@/lib/data/categories';
import { fakeSelectClient, fakeMutationClient } from '../helpers/fakeSupabase';
import { createRecordingClient, callsOf } from '../helpers/recordingSupabase';

describe('getCategories', () => {
  it('mappa le righe in oggetti Category', async () => {
    const supabase = fakeSelectClient([
      { id: '1', nome: 'Groceries', tipo: 'expense', colore: '#22c55e', archiviata: false, ruolo: null },
    ]);

    const result = await getCategories(supabase);

    expect(result).toEqual([
      { id: '1', nome: 'Groceries', tipo: 'expense', colore: '#22c55e', archiviata: false, ruolo: null, icona: null },
    ]);
  });
});

describe('createCategory', () => {
  it('inserisce e ritorna la categoria mappata', async () => {
    const supabase = fakeMutationClient({
      id: '2',
      nome: 'Viaggi',
      tipo: 'expense',
      colore: null,
      archiviata: false,
    });

    const result = await createCategory(supabase, { nome: 'Viaggi', tipo: 'expense', colore: null });

    expect(result.nome).toBe('Viaggi');
  });
});

describe('updateCategory', () => {
  it('aggiorna e ritorna la categoria mappata', async () => {
    const supabase = fakeMutationClient({
      id: '1',
      nome: 'Bollette',
      tipo: 'expense',
      colore: '#3B9AE1',
      archiviata: false,
    });

    const result = await updateCategory(supabase, '1', { nome: 'Bollette', colore: '#3B9AE1' });

    expect(result.nome).toBe('Bollette');
    expect(result.colore).toBe('#3B9AE1');
  });
});

describe('archiveCategory', () => {
  it('non lancia errori quando la scrittura va a buon fine', async () => {
    const supabase = fakeMutationClient(null);
    await expect(archiveCategory(supabase, '1')).resolves.toBeUndefined();
  });
});

describe('ruolo categoria', () => {
  it('mappa ruolo dalla riga, null se assente', async () => {
    const supabase = fakeSelectClient([
      { id: '1', nome: 'Auto', tipo: 'expense', colore: null, archiviata: false, ruolo: 'certa' },
      { id: '2', nome: 'Altro', tipo: 'expense', colore: null, archiviata: false },
    ]);
    const result = await getCategories(supabase);
    expect(result.map((c) => c.ruolo)).toEqual(['certa', null]);
  });

  it('updateCategory scrive ruolo solo se passato', async () => {
    const { client, calls } = createRecordingClient([
      { id: '1', nome: 'Auto', tipo: 'expense', colore: null, archiviata: false, ruolo: 'svago' },
    ]);
    const r = await updateCategory(client, '1', { nome: 'Auto', colore: null, ruolo: 'svago' });
    expect(callsOf(calls[0], 'update')[0][0]).toEqual({ nome: 'Auto', colore: null, ruolo: 'svago' });
    expect(r.ruolo).toBe('svago');
    const b = createRecordingClient([{ id: '1', nome: 'A', tipo: 'expense', colore: null, archiviata: false }]);
    await updateCategory(b.client, '1', { nome: 'A', colore: null });
    expect(callsOf(b.calls[0], 'update')[0][0]).toEqual({ nome: 'A', colore: null });
  });
});

describe('icona categoria', () => {
  it('getCategories legge icona, null se la colonna manca', async () => {
    const supabase = fakeSelectClient([
      { id: '1', nome: 'Spesa', tipo: 'expense', colore: null, archiviata: false, icona: 'carrello' },
      { id: '2', nome: 'Altro', tipo: 'expense', colore: null, archiviata: false },
    ]);
    expect((await getCategories(supabase)).map((c) => c.icona)).toEqual(['carrello', null]);
  });

  it('createCategory scrive icona solo se scelta', async () => {
    const riga = { id: '1', nome: 'A', tipo: 'expense', colore: null, archiviata: false };
    const a = createRecordingClient([{ ...riga, icona: 'casa' }]);
    const r = await createCategory(a.client, { nome: 'A', tipo: 'expense', colore: null, icona: 'casa' });
    expect(callsOf(a.calls[0], 'insert')[0][0]).toMatchObject({ icona: 'casa' });
    expect(r.icona).toBe('casa');
    const b = createRecordingClient([riga]);
    await createCategory(b.client, { nome: 'A', tipo: 'expense', colore: null, icona: null });
    expect(callsOf(b.calls[0], 'insert')[0][0]).not.toHaveProperty('icona');
  });

  it('updateCategory scrive icona solo se passata (anche null per toglierla)', async () => {
    const riga = { id: '1', nome: 'A', tipo: 'expense', colore: null, archiviata: false };
    const a = createRecordingClient([riga]);
    await updateCategory(a.client, '1', { nome: 'A', colore: null, icona: 'auto' });
    expect(callsOf(a.calls[0], 'update')[0][0]).toEqual({ nome: 'A', colore: null, icona: 'auto' });
    const b = createRecordingClient([riga]);
    await updateCategory(b.client, '1', { nome: 'A', colore: null, icona: null });
    expect(callsOf(b.calls[0], 'update')[0][0]).toEqual({ nome: 'A', colore: null, icona: null });
    const c = createRecordingClient([riga]);
    await updateCategory(c.client, '1', { nome: 'A', colore: null });
    expect(callsOf(c.calls[0], 'update')[0][0]).not.toHaveProperty('icona');
  });
});

import { describe, it, expect } from 'vitest';
import { getCategories, createCategory, updateCategory, archiveCategory } from '@/lib/data/categories';
import { fakeSelectClient, fakeMutationClient } from '../helpers/fakeSupabase';

describe('getCategories', () => {
  it('mappa le righe in oggetti Category', async () => {
    const supabase = fakeSelectClient([
      { id: '1', nome: 'Groceries', tipo: 'expense', colore: '#22c55e', archiviata: false },
    ]);

    const result = await getCategories(supabase);

    expect(result).toEqual([
      { id: '1', nome: 'Groceries', tipo: 'expense', colore: '#22c55e', archiviata: false },
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

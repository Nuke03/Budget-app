import { describe, it, expect } from 'vitest';
import { getOpenGoals, createGoal, updateGoal, closeGoal } from '@/lib/data/goals';
import { fakeSelectClient, fakeMutationClient } from '../helpers/fakeSupabase';

const row = {
  id: '1',
  nome: 'Telepass',
  importo_target: 130,
  modalita: 'bloccato',
  scadenza: null,
  categoria_id: null,
  ricorrente: false,
  frequenza_mesi: null,
  stato: 'aperto',
  created_at: '2026-02-01T00:00:00Z',
};

describe('getOpenGoals', () => {
  it('mappa le righe in oggetti BudgetGoal', async () => {
    const supabase = fakeSelectClient([row]);
    const result = await getOpenGoals(supabase);

    expect(result).toEqual([
      {
        id: '1',
        nome: 'Telepass',
        importoTarget: 130,
        modalita: 'bloccato',
        scadenza: null,
        categoriaId: null,
        ricorrente: false,
        frequenzaMesi: null,
        stato: 'aperto',
        createdAt: '2026-02-01T00:00:00Z',
      },
    ]);
  });
});

describe('createGoal', () => {
  it('inserisce e ritorna l\'obiettivo mappato', async () => {
    const supabase = fakeMutationClient(row);
    const result = await createGoal(supabase, {
      nome: 'Telepass',
      importoTarget: 130,
      modalita: 'bloccato',
      scadenza: null,
      categoriaId: null,
      ricorrente: false,
      frequenzaMesi: null,
    });

    expect(result.nome).toBe('Telepass');
  });
});

describe('updateGoal', () => {
  it('aggiorna e ritorna l\'obiettivo mappato', async () => {
    const supabase = fakeMutationClient(row);
    const result = await updateGoal(supabase, '1', {
      nome: 'Telepass',
      importoTarget: 150,
      modalita: 'bloccato',
      scadenza: null,
      categoriaId: null,
      ricorrente: false,
      frequenzaMesi: null,
    });

    expect(result.nome).toBe('Telepass');
  });
});

describe('closeGoal', () => {
  it('non lancia errori quando la scrittura va a buon fine', async () => {
    const supabase = fakeMutationClient(null);
    await expect(closeGoal(supabase, '1')).resolves.toBeUndefined();
  });
});

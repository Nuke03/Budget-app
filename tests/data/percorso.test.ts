import { describe, it, expect } from 'vitest';
import {
  leggiPercorso,
  salvaPercorso,
  aggiungiAttesa,
  decidiAttesa,
  collegaAObiettivo,
} from '@/lib/data/percorso';
import { createRecordingClient, callsOf } from '../helpers/recordingSupabase';

describe('leggiPercorso', () => {
  it('senza righe dà utente null e lezioni vuote', async () => {
    const { client } = createRecordingClient([]);
    const r = await leggiPercorso(client);
    expect(r.utente).toBeNull();
    expect(r.lezioni).toEqual({});
  });
});

describe('salvaPercorso', () => {
  it('fa upsert su user_id con i nomi colonna snake_case', async () => {
    const { client, calls } = createRecordingClient([]);
    await salvaPercorso(client, { entrateTipo: 'piva', speseCerteNessuna: true });
    expect(calls[0].table).toBe('percorso_utente');
    const [args] = callsOf(calls[0], 'upsert');
    expect(args[0]).toEqual({ entrate_tipo: 'piva', spese_certe_nessuna: true });
    expect(args[1]).toEqual({ onConflict: 'user_id' });
  });
});

describe('aggiungiAttesa', () => {
  it('mette rivedi_il a oggi + 7', async () => {
    const { client, calls } = createRecordingClient([
      { id: 'a', nome: 'Cuffie', importo: 80, aggiunto_il: '2026-11-19', rivedi_il: '2026-11-26', stato: 'in_attesa' },
    ]);
    const v = await aggiungiAttesa(client, 'Cuffie', 80, '2026-11-19');
    const [ins] = callsOf(calls[0], 'insert');
    expect((ins[0] as { rivedi_il: string }).rivedi_il).toBe('2026-11-26');
    expect(v.rivediIl).toBe('2026-11-26');
  });
});

describe('decidiAttesa', () => {
  it('aggiorna solo una voce ancora in attesa e già da rivedere', async () => {
    const { client, calls } = createRecordingClient([{ id: 'a1' }]);
    await decidiAttesa(client, 'a1', 'voluto', '2026-11-19');
    expect(callsOf(calls[0], 'update')[0][0]).toEqual({ stato: 'voluto' });
    expect(callsOf(calls[0], 'eq')).toEqual([['id', 'a1'], ['stato', 'in_attesa']]);
    expect(callsOf(calls[0], 'lte')[0]).toEqual(['rivedi_il', '2026-11-19']);
    expect(callsOf(calls[0], 'select')[0]).toEqual(['id']);
  });

  it('nessuna riga aggiornata: errore', async () => {
    const { client } = createRecordingClient([]);
    await expect(decidiAttesa(client, 'a1', 'non_piu', '2026-11-19')).rejects.toThrow('Voce non valida');
  });
});

describe('collegaAObiettivo', () => {
  it('aggiorna solo goal_id', async () => {
    const { client, calls } = createRecordingClient([]);
    await collegaAObiettivo(client, 't1', 'g1');
    expect(calls[0].table).toBe('transactions');
    expect(callsOf(calls[0], 'update')[0][0]).toEqual({ goal_id: 'g1' });
    expect(callsOf(calls[0], 'eq')[0]).toEqual(['id', 't1']);
  });
});

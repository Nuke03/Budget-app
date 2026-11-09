import { describe, it, expect } from 'vitest';
import { scopertoEliminandoSpesa, scopertoAnnullandoVersamento } from '@/lib/calculations/casa/scoperto';
import type { Transaction, Transfer } from '@/lib/types';

function spesa(over: Partial<Transaction>): Transaction {
  return {
    id: 's1', tipo: 'expense', importo: 100, data: '2026-11-05', categoriaId: null, accountId: 'ap',
    goalId: null, descrizione: 'Spesa', nota: null, createdAt: '', pagataDaUserId: 'u1', ...over,
  };
}
function tr(over: Partial<Transfer>): Transfer {
  return {
    id: 't1', householdId: 'h1', userId: 'u1', daAccountId: null, aAccountId: null, importo: 100,
    data: '2026-11-05', causale: 'versamento', beneficiarioUserId: null, perContoDiUserId: null,
    meseCompetenza: '2026-11-01', soloRegistrazione: false, nota: null, createdAt: '', ...over,
  };
}

describe('scopertoEliminandoSpesa', () => {
  it('una spesa ancora da rimborsare si elimina senza scoperto', () => {
    expect(scopertoEliminandoSpesa(spesa({}), [spesa({})], [])).toBeNull();
  });
  it('una spesa già rimborsata per intero lascia scoperto l intero importo', () => {
    const rimborso = tr({ causale: 'rimborso', userId: 'u2', beneficiarioUserId: 'u1', importo: 100 });
    expect(scopertoEliminandoSpesa(spesa({}), [spesa({})], [rimborso])).toEqual({
      tipo: 'credito', userId: 'u1', controparteId: null, importo: 100,
    });
  });
  it('un rimborso parziale scopre solo la parte oltre le altre spese anticipate', () => {
    const altra = spesa({ id: 's2', importo: 60 });
    const rimborso = tr({ causale: 'rimborso', userId: 'u2', beneficiarioUserId: 'u1', importo: 120 });
    expect(scopertoEliminandoSpesa(spesa({}), [spesa({}), altra], [rimborso])?.importo).toBe(60);
  });
  it('una spesa pagata dal conto comune non ha scoperto', () => {
    expect(scopertoEliminandoSpesa(spesa({ pagataDaUserId: undefined }), [], [])).toBeNull();
  });
});

describe('scopertoAnnullandoVersamento', () => {
  const prestito = tr({ id: 'p', userId: 'u1', perContoDiUserId: 'u2', importo: 200 });
  it('un debito ancora aperto si annulla senza scoperto', () => {
    expect(scopertoAnnullandoVersamento(prestito, [prestito])).toBeNull();
  });
  it('un debito già restituito lascia scoperto chi ha restituito', () => {
    const restituzione = tr({ id: 'r', causale: 'restituzione', userId: 'u2', beneficiarioUserId: 'u1', importo: 200, meseCompetenza: null });
    expect(scopertoAnnullandoVersamento(prestito, [prestito, restituzione])).toEqual({
      tipo: 'debito', userId: 'u2', controparteId: 'u1', importo: 200,
    });
  });
  it('un versamento senza "per conto di" non ha scoperto', () => {
    expect(scopertoAnnullandoVersamento(tr({}), [tr({})])).toBeNull();
  });
});

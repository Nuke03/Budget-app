import { describe, it, expect } from 'vitest';
import { righeNeutreStorico } from '@/lib/calculations/casa/righeNeutre';
import type { Transaction, Transfer } from '@/lib/types';

const nomi = { u1: 'Fabio', u2: 'Anna' };

function tr(p: Partial<Transfer>): Transfer {
  return {
    id: 'x1',
    householdId: 'h1',
    userId: 'u1',
    daAccountId: 'a1',
    aAccountId: null,
    importo: 776,
    data: '2026-11-03',
    causale: 'versamento',
    beneficiarioUserId: null,
    perContoDiUserId: null,
    meseCompetenza: '2026-11-01',
    soloRegistrazione: false,
    nota: null,
    createdAt: '2026-11-03T10:00:00Z',
    ...p,
  };
}

function righe(trasferimenti: Transfer[], transazioni: Transaction[] = [], userId = 'u1') {
  return righeNeutreStorico({ userId, transazioni, trasferimenti, nomi });
}

describe('righeNeutreStorico', () => {
  it('versamento proprio: esce, con il mese di competenza', () => {
    expect(righe([tr({})])).toEqual([
      { id: 'tr-x1', data: '2026-11-03', etichetta: 'Versamento alla casa, novembre', importo: 776, verso: 'esce' },
    ]);
  });

  it('versamento per conto di un altro membro', () => {
    const [r] = righe([tr({ importo: 200, perContoDiUserId: 'u2' })]);
    expect(r.etichetta).toBe('Versamento alla casa per conto di Anna, novembre');
    expect(r.verso).toBe('esce');
  });

  it('versamento a favore di un altro membro', () => {
    const [r] = righe([tr({ beneficiarioUserId: 'u2', meseCompetenza: null })]);
    expect(r.etichetta).toBe('Versamento alla casa a favore di Anna');
  });

  it('versamento solo registrazione si mostra senza cambiare verso', () => {
    const [r] = righe([tr({ soloRegistrazione: true })]);
    expect(r.verso).toBe('esce');
  });

  it('rimborso ricevuto: entra', () => {
    const [r] = righe([
      tr({ causale: 'rimborso', importo: 45, userId: 'u2', daAccountId: null, aAccountId: 'a1', beneficiarioUserId: 'u1' }),
    ]);
    expect(r).toMatchObject({ etichetta: 'Rimborso dalla casa', importo: 45, verso: 'entra' });
  });

  it('restituzione a un altro membro: esce', () => {
    const [r] = righe([tr({ causale: 'restituzione', importo: 64.2, beneficiarioUserId: 'u2' })]);
    expect(r).toMatchObject({ etichetta: 'Restituzione a Anna', importo: 64.2, verso: 'esce' });
  });

  it('restituzione ricevuta: entra', () => {
    const [r] = righe([tr({ causale: 'restituzione', userId: 'u2', beneficiarioUserId: 'u1' })]);
    expect(r).toMatchObject({ etichetta: 'Restituzione da Anna', verso: 'entra' });
  });

  it('spesa di casa pagata da te: esce', () => {
    const t: Transaction = {
      id: 's1',
      tipo: 'expense',
      importo: 200,
      data: '2026-11-05',
      categoriaId: null,
      accountId: null,
      goalId: null,
      descrizione: 'Bolletta',
      nota: null,
      createdAt: '', stima: false,
      pagataDaUserId: 'u1',
    };
    expect(righe([], [t])).toEqual([
      { id: 'tx-s1', data: '2026-11-05', etichetta: 'Spesa di casa pagata da te: Bolletta', importo: 200, verso: 'esce' },
    ]);
  });

  it('non compare nulla dell altro membro: un versamento di u2 non produce righe per u1', () => {
    expect(righe([tr({ userId: 'u2' })])).toEqual([]);
  });

  it('rimborso solo registrazione fatto da un altro membro: la riga compare', () => {
    const [r] = righe([
      tr({ causale: 'rimborso', userId: 'u2', soloRegistrazione: true, beneficiarioUserId: 'u1', aAccountId: null, daAccountId: null }),
    ]);
    expect(r).toMatchObject({ etichetta: 'Rimborso dalla casa (da aggiornare nel tuo saldo)', verso: 'entra' });
  });

  it('restituzione solo registrazione: compare per il debitore e per il creditore', () => {
    const base = { causale: 'restituzione' as const, soloRegistrazione: true };
    const [d] = righe([tr({ ...base, userId: 'u1', beneficiarioUserId: 'u2' })]);
    expect(d).toMatchObject({ etichetta: 'Restituzione a Anna', verso: 'esce' });
    const [c] = righe([tr({ ...base, userId: 'u2', beneficiarioUserId: 'u1' })]);
    expect(c).toMatchObject({ etichetta: 'Restituzione da Anna (da aggiornare nel tuo saldo)', verso: 'entra' });
  });

  it('le righe già applicate ai saldi non hanno il suffisso', () => {
    const [rimborso] = righe([
      tr({ causale: 'rimborso', userId: 'u2', beneficiarioUserId: 'u1', aAccountId: 'a1', daAccountId: null }),
    ]);
    expect(rimborso.etichetta).toBe('Rimborso dalla casa');
    const [restituzione] = righe([tr({ causale: 'restituzione', userId: 'u2', beneficiarioUserId: 'u1' })]);
    expect(restituzione.etichetta).toBe('Restituzione da Anna');
  });

  it('le rinunce non compaiono', () => {
    expect(
      righe([
        tr({ causale: 'rimborso', soloRegistrazione: true, userId: 'u1', beneficiarioUserId: 'u1', aAccountId: null, daAccountId: null }),
        tr({ id: 'x2', causale: 'restituzione', perContoDiUserId: 'u2', soloRegistrazione: true, beneficiarioUserId: 'u1' }),
        tr({ id: 'x3', causale: 'restituzione', perContoDiUserId: 'u2', beneficiarioUserId: 'u1' }),
      ])
    ).toEqual([]);
  });

  it('ordine per data decrescente', () => {
    const r = righe([
      tr({ id: 'a', data: '2026-10-01' }),
      tr({ id: 'b', data: '2026-11-20' }),
      tr({ id: 'c', data: '2026-11-02' }),
    ]);
    expect(r.map((x) => x.id)).toEqual(['tr-b', 'tr-c', 'tr-a']);
  });
});

describe('saldo_iniziale', () => {
  it('non compare nello storico (non e un movimento di soldi)', () => {
    const s = tr({ id: 's', causale: 'saldo_iniziale', userId: 'u1', beneficiarioUserId: 'u1', perContoDiUserId: 'u2', soloRegistrazione: true });
    expect(righe([s])).toEqual([]);
    expect(righeNeutreStorico({ userId: 'u2', transazioni: [], trasferimenti: [s], nomi: {} })).toEqual([]);
  });
});

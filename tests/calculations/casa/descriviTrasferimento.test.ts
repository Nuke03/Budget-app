import { describe, it, expect } from 'vitest';
import { descriviTrasferimento } from '@/lib/calculations/casa/descriviTrasferimento';
import { PAROLE_VIETATE } from '../../helpers/paroleVietate';
import type { Transfer } from '@/lib/types';

const nomi = { u1: 'Fabio', u2: 'Anna' };

function tr(over: Partial<Transfer>): Transfer {
  return {
    id: 't', householdId: 'h1', userId: 'u1', daAccountId: null, aAccountId: null, importo: 100,
    data: '2026-11-05', causale: 'versamento', beneficiarioUserId: null, perContoDiUserId: null,
    meseCompetenza: null, soloRegistrazione: false, nota: null, createdAt: '', ...over,
  };
}

describe('descriviTrasferimento', () => {
  it('versamento con mese', () => {
    expect(descriviTrasferimento(tr({ meseCompetenza: '2026-11-01' }), nomi)).toEqual({
      titolo: 'Versamento di Fabio',
      dettaglio: 'novembre',
    });
  });

  it('versamento per conto di un altro', () => {
    expect(descriviTrasferimento(tr({ perContoDiUserId: 'u2', meseCompetenza: '2026-11-01' }), nomi)).toEqual({
      titolo: 'Versamento di Fabio',
      dettaglio: 'per conto di Anna, novembre',
    });
  });

  it('versamento a favore di un membro', () => {
    expect(descriviTrasferimento(tr({ beneficiarioUserId: 'u2' }), nomi).titolo).toBe(
      'Versamento di Fabio a favore di Anna',
    );
  });

  it('rimborso', () => {
    expect(descriviTrasferimento(tr({ causale: 'rimborso', userId: 'u2', beneficiarioUserId: 'u1' }), nomi).titolo).toBe(
      'Rimborso a Fabio',
    );
  });

  it('rimborso rinunciato', () => {
    const t = tr({ causale: 'rimborso', beneficiarioUserId: 'u1', soloRegistrazione: true });
    expect(descriviTrasferimento(t, nomi).titolo).toBe('Fabio rinuncia a un rimborso');
  });

  it('restituzione', () => {
    const t = tr({ causale: 'restituzione', userId: 'u2', beneficiarioUserId: 'u1' });
    expect(descriviTrasferimento(t, nomi).titolo).toBe('Restituzione di Anna a Fabio');
  });

  it('restituzione rinunciata', () => {
    const t = tr({ causale: 'restituzione', beneficiarioUserId: 'u1', perContoDiUserId: 'u2', soloRegistrazione: true });
    expect(descriviTrasferimento(t, nomi).titolo).toBe('Fabio rinuncia a una restituzione di Anna');
  });

  it('nessun titolo contiene parole vietate', () => {
    const casi = [
      tr({ meseCompetenza: '2026-11-01', perContoDiUserId: 'u2' }),
      tr({ beneficiarioUserId: 'u2' }),
      tr({ causale: 'rimborso', beneficiarioUserId: 'u1' }),
      tr({ causale: 'restituzione', beneficiarioUserId: 'u1', perContoDiUserId: 'u2' }),
      tr({ causale: 'altro' }),
    ];
    for (const c of casi) {
      const { titolo, dettaglio } = descriviTrasferimento(c, nomi);
      const testo = `${titolo} ${dettaglio ?? ''}`.toLowerCase();
      for (const p of PAROLE_VIETATE) expect(testo).not.toContain(p);
    }
  });
});

describe('descriviTrasferimento: saldo_iniziale', () => {
  it('racconta il saldo di partenza da Tricount', () => {
    const t = tr({ causale: 'saldo_iniziale', beneficiarioUserId: 'u1', perContoDiUserId: 'u2', soloRegistrazione: true });
    expect(descriviTrasferimento(t, nomi)).toEqual({
      titolo: 'Saldo di partenza da Tricount',
      dettaglio: 'Anna deve a Fabio',
    });
  });
});

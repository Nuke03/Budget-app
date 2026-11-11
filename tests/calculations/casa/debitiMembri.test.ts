import { describe, it, expect } from 'vitest';
import { debitiMembri, debitoVersoMembri } from '@/lib/calculations/casa/debitiMembri';
import type { Transfer } from '@/lib/types';

const tr = (extra: Partial<Transfer>): Transfer => ({
  id: 't',
  householdId: 'h1',
  userId: 'u1',
  daAccountId: null,
  aAccountId: null,
  importo: 0,
  data: '2026-10-05',
  causale: 'versamento',
  beneficiarioUserId: null,
  perContoDiUserId: null,
  meseCompetenza: null,
  soloRegistrazione: false,
  nota: null,
  createdAt: '2026-10-05T00:00:00Z',
  ...extra,
});

const prestito = (importo: number, mese = '2026-10-01', autore = 'u1', perConto = 'u2') =>
  tr({ importo, perContoDiUserId: perConto, meseCompetenza: mese, userId: autore });

describe('debitiMembri', () => {
  it('u1 versa 603 per conto di u2: u2 deve 603 a u1', () => {
    expect(debitiMembri([prestito(603)])).toEqual([
      { debitoreId: 'u2', creditoreId: 'u1', importo: 603, mesi: [{ mese: '2026-10-01', importo: 603, versato: 603 }] },
    ]);
  });

  it('una restituzione diretta di 200 lo porta a 403', () => {
    const rest = tr({ causale: 'restituzione', userId: 'u2', beneficiarioUserId: 'u1', importo: 200 });
    expect(debitiMembri([prestito(603), rest])[0].importo).toBe(403);
  });

  it('un versamento di restituzione di 100 lo porta a 303', () => {
    const rest = tr({ causale: 'restituzione', userId: 'u2', beneficiarioUserId: 'u1', importo: 200 });
    const vers = tr({ causale: 'versamento', userId: 'u2', beneficiarioUserId: 'u1', importo: 100 });
    expect(debitiMembri([prestito(603), rest, vers])[0].importo).toBe(303);
  });

  it('una rinuncia di u1 di 100 lo porta a 203', () => {
    const rest = tr({ causale: 'restituzione', userId: 'u2', beneficiarioUserId: 'u1', importo: 200 });
    const vers = tr({ causale: 'versamento', userId: 'u2', beneficiarioUserId: 'u1', importo: 100 });
    const rinuncia = tr({
      causale: 'restituzione',
      userId: 'u1',
      beneficiarioUserId: 'u1',
      perContoDiUserId: 'u2',
      soloRegistrazione: true,
      importo: 100,
    });
    expect(debitiMembri([prestito(603), rest, vers, rinuncia])[0].importo).toBe(203);
  });

  it('non va mai sotto zero: niente coppia se il restituito supera il prestato', () => {
    const rest = tr({ causale: 'restituzione', userId: 'u2', beneficiarioUserId: 'u1', importo: 900 });
    expect(debitiMembri([prestito(603), rest])).toEqual([]);
  });

  it('i mesi applicano il restituito al più vecchio e tengono solo il residuo', () => {
    const rest = tr({ causale: 'restituzione', userId: 'u2', beneficiarioUserId: 'u1', importo: 700 });
    const d = debitiMembri([prestito(603, '2026-11-01'), prestito(603, '2026-10-01'), rest]);
    expect(d).toHaveLength(1);
    expect(d[0].importo).toBe(506);
    expect(d[0].mesi).toEqual([{ mese: '2026-11-01', importo: 506, versato: 603 }]);
  });

  it('con tre membri ci sono tre coppie e il debito verso i membri si somma per debitore', () => {
    const d = debitiMembri([
      prestito(100, '2026-10-01', 'u1', 'u2'),
      prestito(50, '2026-10-01', 'u1', 'u3'),
      prestito(20, '2026-10-01', 'u2', 'u3'),
    ]);
    expect(d).toHaveLength(3);
    expect(debitoVersoMembri('u2', d)).toBe(100);
    expect(debitoVersoMembri('u3', d)).toBe(70);
    expect(debitoVersoMembri('u1', d)).toBe(0);
  });
});

describe('debitiMembri: saldo_iniziale', () => {
  const saldo = (importo: number, creditore = 'u1', debitore = 'u2', autore = 'u1') =>
    tr({ causale: 'saldo_iniziale', userId: autore, beneficiarioUserId: creditore, perContoDiUserId: debitore, importo, data: '2026-11-10', soloRegistrazione: true });

  it('saldo_iniziale crea un debito del debitore verso il creditore', () => {
    expect(debitiMembri([saldo(120)])).toEqual([
      { debitoreId: 'u2', creditoreId: 'u1', importo: 120, mesi: [{ mese: '2026-11-01', importo: 120, versato: 120, origine: 'tricount' }] },
    ]);
  });

  it('conta anche se a registrarlo e il debitore', () => {
    expect(debitiMembri([saldo(120, 'u1', 'u2', 'u2')])[0]).toMatchObject({ debitoreId: 'u2', creditoreId: 'u1', importo: 120 });
  });

  it('una restituzione successiva lo copre', () => {
    const rest = tr({ causale: 'restituzione', userId: 'u2', beneficiarioUserId: 'u1', importo: 70 });
    expect(debitiMembri([saldo(120), rest])[0].importo).toBe(50);
    expect(debitiMembri([saldo(120), { ...rest, importo: 120 }])).toEqual([]);
  });

  it('si somma ai prestiti dello stesso verso, il restituito copre il mese piu vecchio', () => {
    const rest = tr({ causale: 'restituzione', userId: 'u2', beneficiarioUserId: 'u1', importo: 120 });
    const d = debitiMembri([prestito(603, '2026-12-01'), saldo(120), rest]);
    expect(d[0].importo).toBe(603);
    expect(d[0].mesi).toEqual([{ mese: '2026-12-01', importo: 603, versato: 603 }]);
  });
});

describe('debitiMembri: origine tricount', () => {
  it('un mese con saldo e versamento per conto di resta una quota, senza origine', () => {
    const saldo = tr({ causale: 'saldo_iniziale', userId: 'u1', beneficiarioUserId: 'u1', perContoDiUserId: 'u2', importo: 50, data: '2026-11-10', soloRegistrazione: true });
    const vers = tr({ causale: 'versamento', userId: 'u1', perContoDiUserId: 'u2', importo: 100, data: '2026-11-03' });
    expect(debitiMembri([saldo, vers])[0].mesi[0].origine).toBeUndefined();
  });
});

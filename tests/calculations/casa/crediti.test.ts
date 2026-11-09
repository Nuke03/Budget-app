import { describe, it, expect } from 'vitest';
import { creditoMembro, creditiPerMembro } from '@/lib/calculations/casa/crediti';
import type { Transfer } from '@/lib/types';

const tr = (extra: Partial<Transfer>): Transfer => ({
  id: 't',
  householdId: 'h1',
  userId: 'u2',
  daAccountId: null,
  aAccountId: null,
  importo: 0,
  data: '2026-11-01',
  causale: 'rimborso',
  beneficiarioUserId: null,
  perContoDiUserId: null,
  meseCompetenza: null,
  soloRegistrazione: false,
  nota: null,
  createdAt: '2026-11-01T00:00:00Z',
  ...extra,
});

const spesa = (importo: number, pagataDaUserId: string | null, tipo: 'expense' | 'income' = 'expense') => ({
  tipo,
  importo,
  pagataDaUserId,
});

describe('creditoMembro', () => {
  it('una spesa pagata da u1 meno il rimborso ricevuto', () => {
    expect(creditoMembro('u1', [spesa(45, 'u1')], [tr({ importo: 20, beneficiarioUserId: 'u1' })])).toBe(25);
  });

  it('un rimborso più grande del credito lo azzera', () => {
    expect(creditoMembro('u1', [spesa(45, 'u1')], [tr({ importo: 60, beneficiarioUserId: 'u1' })])).toBe(0);
  });

  it('un versamento di restituzione a favore di u1 aumenta il credito', () => {
    const v = tr({ causale: 'versamento', importo: 10, beneficiarioUserId: 'u1' });
    expect(creditoMembro('u1', [spesa(45, 'u1')], [tr({ importo: 20, beneficiarioUserId: 'u1' }), v])).toBe(35);
  });

  it('una rinuncia (rimborso solo registrazione a sé) chiude il credito', () => {
    const rinuncia = tr({ userId: 'u1', importo: 45, beneficiarioUserId: 'u1', soloRegistrazione: true });
    expect(creditoMembro('u1', [spesa(45, 'u1')], [rinuncia])).toBe(0);
  });

  it('le entrate e le spese senza pagante non contano', () => {
    expect(creditoMembro('u1', [spesa(45, 'u1', 'income'), spesa(30, null), spesa(10, 'u2')], [])).toBe(0);
  });

  it('arrotonda a due decimali', () => {
    expect(creditoMembro('u1', [spesa(0.1, 'u1'), spesa(0.2, 'u1')], [])).toBe(0.3);
  });
});

describe('creditiPerMembro', () => {
  it('calcola il credito di ciascun membro', () => {
    const r = creditiPerMembro(
      ['u1', 'u2', 'u3'],
      [spesa(45, 'u1'), spesa(30, 'u2')],
      [tr({ importo: 20, beneficiarioUserId: 'u1' })],
    );
    expect(r).toEqual({ u1: 25, u2: 30, u3: 0 });
  });
});

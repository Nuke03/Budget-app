import { describe, expect, it } from 'vitest';
import {
  maturatoPerCassetto,
  maturatoRientro,
  rataRientro,
  situazioneRientriConti,
  totaleDaSpostare,
  ultimoMeseRientro,
  type Rientro,
  type Spostamento,
} from '@/lib/calculations/rientri';

function rientro(o: Partial<Rientro> = {}): Rientro {
  return {
    id: 'r1',
    userId: 'u1',
    householdId: null,
    goalId: null,
    accountId: null,
    importo: 300,
    mesi: 3,
    creatoIl: '2026-11-20',
    stato: 'aperto',
    fermatoIl: null,
    ...o,
  };
}

function spost(o: Partial<Spostamento> = {}): Spostamento {
  return {
    id: 's1',
    daAccountId: 'corr',
    aAccountId: 'risp',
    importo: 100,
    data: '2026-11-25',
    createdAt: '2026-11-25T10:00:00Z',
    ...o,
  };
}

const pesano = new Set(['corr']);

describe('rataRientro', () => {
  it('divide e arrotonda ai centesimi', () => {
    expect(rataRientro({ importo: 300, mesi: 3 })).toBe(100);
    expect(rataRientro({ importo: 100, mesi: 3 })).toBe(33.33);
  });
});

describe('maturatoRientro', () => {
  const r = rientro({ importo: 100, mesi: 3, creatoIl: '2026-11-30' });
  it('matura per mese di calendario', () => {
    expect(maturatoRientro(r, '2026-11-30')).toBe(33.33);
    expect(maturatoRientro(r, '2026-12-01')).toBe(66.66);
    expect(maturatoRientro(r, '2027-01-15')).toBe(100);
    expect(maturatoRientro(r, '2027-05-01')).toBe(100);
  });
  it('prima della creazione e zero', () => {
    expect(maturatoRientro(r, '2026-10-31')).toBe(0);
  });
  it('fermato: conta fino a fermatoIl', () => {
    const f = rientro({ stato: 'fermato', fermatoIl: '2026-12-10' });
    expect(maturatoRientro(f, '2027-03-01')).toBe(200);
  });
});

describe('ultimoMeseRientro', () => {
  it('ultimo mese del rientro', () => {
    expect(ultimoMeseRientro({ creatoIl: '2026-11-20', mesi: 3 })).toBe('2027-01');
    expect(ultimoMeseRientro({ creatoIl: '2026-11-20', mesi: 2 })).toBe('2026-12');
  });
});

describe('maturatoPerCassetto', () => {
  it('ignora chiusi, altri cassetti e conti', () => {
    const rs = [
      rientro({ id: 'a', goalId: 'g1' }),
      rientro({ id: 'b', goalId: 'g1', stato: 'chiuso' }),
      rientro({ id: 'c', goalId: 'g2' }),
      rientro({ id: 'd', accountId: 'risp' }),
      rientro({ id: 'e', goalId: 'g1', stato: 'fermato', fermatoIl: '2026-12-10' }),
    ];
    // a: mese 1 a 2026-11-28 = 100; e fermato a dic = mese 2 = 200
    expect(maturatoPerCassetto(rs, 'g1', '2026-11-28')).toBe(300);
  });
});

describe('situazioneRientriConti', () => {
  const r = rientro({ accountId: 'risp' });

  it('spostamento valido', () => {
    const [s] = situazioneRientriConti([r], [spost()], pesano, '2026-11-28');
    expect(s.maturato).toBe(100);
    expect(s.spostato).toBe(100);
    expect(s.daSpostare).toBe(0);
    const [s2] = situazioneRientriConti([r], [spost()], pesano, '2026-12-05');
    expect(s2.daSpostare).toBe(100);
  });

  it('ignora rientri verso cassetti', () => {
    expect(situazioneRientriConti([rientro({ goalId: 'g1' })], [], pesano, '2026-11-28')).toEqual([]);
  });

  it('spostamenti non validi non contano', () => {
    const nonPesa = spost({ daAccountId: 'altro' });
    const altroConto = spost({ aAccountId: 'altro' });
    const prima = spost({ data: '2026-11-19' });
    const nullo = spost({ daAccountId: null });
    for (const s of [nonPesa, altroConto, prima, nullo]) {
      const [x] = situazioneRientriConti([r], [s], pesano, '2026-11-28');
      expect(x.spostato).toBe(0);
    }
  });

  it('un spostamento va al rientro piu vecchio, il resto al successivo', () => {
    const a = rientro({ id: 'a', accountId: 'risp', importo: 100, creatoIl: '2026-11-01' });
    const b = rientro({ id: 'b', accountId: 'risp', importo: 200, creatoIl: '2026-11-10' });
    const res = situazioneRientriConti([b, a], [spost({ importo: 150 })], pesano, '2026-11-28');
    const ra = res.find((x) => x.rientro.id === 'a')!;
    const rb = res.find((x) => x.rientro.id === 'b')!;
    expect(ra.spostato).toBe(100);
    expect(ra.finito).toBe(true);
    expect(rb.spostato).toBe(50);
    expect(rb.finito).toBe(false);
  });

  it('spostato oltre il dovuto', () => {
    const s = spost({ importo: 250 });
    expect(situazioneRientriConti([r], [s], pesano, '2026-11-28')[0].daSpostare).toBe(0);
    expect(situazioneRientriConti([r], [s], pesano, '2027-01-10')[0].daSpostare).toBe(50);
  });

  it('chiuso: daSpostare 0 e nessuno spostamento', () => {
    const c = rientro({ accountId: 'risp', stato: 'chiuso', fermatoIl: '2026-11-22' });
    const [x] = situazioneRientriConti([c], [spost()], pesano, '2026-12-05');
    expect(x.daSpostare).toBe(0);
    expect(x.spostato).toBe(0);
  });

  it('totaleDaSpostare somma senza drift', () => {
    const a = rientro({ id: 'a', accountId: 'risp', importo: 100 });
    const b = rientro({ id: 'b', accountId: 'risp', importo: 100 });
    const res = situazioneRientriConti([a, b], [], pesano, '2026-11-28');
    expect(totaleDaSpostare(res)).toBe(66.66);
  });
});

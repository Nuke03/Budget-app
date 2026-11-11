import { describe, it, expect } from 'vitest';
import { decidiNotifica, periodoDaRecuperare, type StatoPersona } from '@/lib/calculations/supporto/notifiche';
import { PAROLE_VIETATE } from '../../helpers/paroleVietate';

const OGGI = '2026-11-11';

const base: StatoPersona = {
  userId: 'u1',
  iscritta: true,
  notificheAttive: true,
  ultimaCreazione: null,
  ultimaSpeseIl: null,
  ultimaCheckinIl: null,
  ultimoVersamentoMese: null,
  ultimaNotificaIl: null,
  nessunaSpesaFinoAl: null,
  gestisce: false,
  checkinDaFare: null,
  versamento: null,
};
const st = (o: Partial<StatoPersona>): StatoPersona => ({ ...base, ...o });
const vers = (giorno: number, o: Partial<{ importo: number; versato: number }> = {}) => ({
  giorno, importo: 450, versato: 0, mese: '2026-11-01', ...o,
});

describe('periodoDaRecuperare', () => {
  it('ultima il 9: dal 10 al 11', () => {
    expect(periodoDaRecuperare('2026-11-09', null, OGGI)).toEqual({ dal: '2026-11-10', al: OGGI });
  });
  it('ultima il 10 o oggi: niente', () => {
    expect(periodoDaRecuperare('2026-11-10', null, OGGI)).toBeNull();
    expect(periodoDaRecuperare('2026-11-11', null, OGGI)).toBeNull();
  });
  it('nessuna transazione mai: niente', () => {
    expect(periodoDaRecuperare(null, null, OGGI)).toBeNull();
    expect(periodoDaRecuperare(null, '2026-11-01', OGGI)).toBeNull();
  });
  it('"non ho speso" fino al 10: niente', () => {
    expect(periodoDaRecuperare('2026-11-05', '2026-11-10', OGGI)).toBeNull();
  });
  it('"non ho speso" più vecchio dell\'ultima transazione non conta', () => {
    expect(periodoDaRecuperare('2026-11-09', '2026-11-01', OGGI)).toEqual({ dal: '2026-11-10', al: OGGI });
  });
});

describe('decidiNotifica: spese', () => {
  it('ultima il 9: spese', () => {
    const n = decidiNotifica(st({ ultimaCreazione: '2026-11-09' }), OGGI);
    expect(n?.tipo).toBe('spese');
    expect(n?.url).toBe('/in-pari');
    expect(n?.testo).toBe('Sono due giorni senza spese segnate. Ti va di rimetterti in pari? Ci vuole un minuto.');
  });
  it('ultima il 10: niente', () => {
    expect(decidiNotifica(st({ ultimaCreazione: '2026-11-10' }), OGGI)).toBeNull();
  });
  it('nessuna transazione mai: niente', () => {
    expect(decidiNotifica(st({}), OGGI)).toBeNull();
  });
  it('"non ho speso" fino al 10: niente', () => {
    expect(decidiNotifica(st({ ultimaCreazione: '2026-11-01', nessunaSpesaFinoAl: '2026-11-10' }), OGGI)).toBeNull();
  });
  it('mandata l\'8: il 10 niente, l\'11 sì', () => {
    const s = st({ ultimaCreazione: '2026-11-01', ultimaSpeseIl: '2026-11-08' });
    expect(decidiNotifica(s, '2026-11-10')).toBeNull();
    expect(decidiNotifica(s, '2026-11-11')?.tipo).toBe('spese');
  });
});

describe('decidiNotifica: tetto giornaliero e requisiti', () => {
  it('già mandata oggi, di qualsiasi tipo: niente', () => {
    const s = { ultimaCreazione: '2026-11-01' };
    expect(decidiNotifica(st({ ...s, ultimaSpeseIl: OGGI }), OGGI)).toBeNull();
    expect(decidiNotifica(st({ ...s, ultimaCheckinIl: OGGI }), OGGI)).toBeNull();
    expect(decidiNotifica(st({ ...s, ultimaNotificaIl: OGGI }), OGGI)).toBeNull();
  });
  it('versamento mandato oggi (ultimaNotificaIl): niente spese', () => {
    expect(
      decidiNotifica(
        st({ ultimaCreazione: '2026-11-01', ultimaNotificaIl: OGGI, ultimoVersamentoMese: '2026-11-01' }),
        OGGI,
      ),
    ).toBeNull();
  });
  it('notificheAttive false o null: niente', () => {
    expect(decidiNotifica(st({ ultimaCreazione: '2026-11-01', notificheAttive: false }), OGGI)).toBeNull();
    expect(decidiNotifica(st({ ultimaCreazione: '2026-11-01', notificheAttive: null }), OGGI)).toBeNull();
  });
  it('non iscritta: niente', () => {
    expect(decidiNotifica(st({ ultimaCreazione: '2026-11-01', iscritta: false }), OGGI)).toBeNull();
  });
});

describe('decidiNotifica: versamento', () => {
  const s = (o: Partial<StatoPersona> = {}) => st({ versamento: vers(5), ...o });
  it('giorno 5: dal 2 al 5 sì, il 1 no, il 6 no', () => {
    for (const g of ['02', '03', '04', '05']) expect(decidiNotifica(s(), `2026-11-${g}`)?.tipo).toBe('versamento');
    expect(decidiNotifica(s(), '2026-11-01')).toBeNull();
    expect(decidiNotifica(s(), '2026-11-06')).toBeNull();
  });
  it('giorno 2: finestra dal 1', () => {
    expect(decidiNotifica(st({ versamento: vers(2) }), '2026-11-01')?.tipo).toBe('versamento');
  });
  it('testo e url', () => {
    const n = decidiNotifica(s(), '2026-11-04');
    expect(n?.testo).toBe('La tua quota di novembre: 450 € entro il 5.');
    expect(n?.url).toBe('/casa');
  });
  it('versato in parte: dice quanto manca', () => {
    const n = decidiNotifica(s({ versamento: vers(5, { versato: 200 }) }), '2026-11-04');
    expect(n?.testo).toBe('La tua quota di novembre: ti mancano 250 € entro il 5.');
  });
  it('già versato: niente', () => {
    expect(decidiNotifica(s({ versamento: vers(5, { versato: 450 }) }), '2026-11-04')).toBeNull();
  });
  it('già avvisata per il mese: niente', () => {
    expect(decidiNotifica(s({ ultimoVersamentoMese: '2026-11-01' }), '2026-11-04')).toBeNull();
  });
  it('versamento e spese insieme: solo versamento', () => {
    expect(decidiNotifica(s({ ultimaCreazione: '2026-10-20' }), '2026-11-04')?.tipo).toBe('versamento');
  });
});

describe('decidiNotifica: check-in', () => {
  const s = (o: Partial<StatoPersona> = {}) => st({ gestisce: true, checkinDaFare: '2026-10-01', ...o });
  it('a chi gestisce', () => {
    const n = decidiNotifica(s(), OGGI);
    expect(n?.tipo).toBe('checkin');
    expect(n?.testo).toBe('Ottobre è chiuso: controlliamolo in 2 minuti.');
    expect(n?.url).toBe('/casa/controllo');
  });
  it('non a chi non gestisce', () => {
    expect(decidiNotifica(s({ gestisce: false }), OGGI)).toBeNull();
  });
  it('senza mese da controllare: niente', () => {
    expect(decidiNotifica(s({ checkinDaFare: null }), OGGI)).toBeNull();
  });
  it('mandato 2 giorni fa: no, 3 giorni fa: sì', () => {
    expect(decidiNotifica(s({ ultimaCheckinIl: '2026-11-09' }), OGGI)).toBeNull();
    expect(decidiNotifica(s({ ultimaCheckinIl: '2026-11-08' }), OGGI)?.tipo).toBe('checkin');
  });
  it('check-in prima delle spese', () => {
    expect(decidiNotifica(s({ ultimaCreazione: '2026-11-01' }), OGGI)?.tipo).toBe('checkin');
  });
});

describe('testi', () => {
  it('nessuna parola vietata', () => {
    const tutte = [
      decidiNotifica(st({ ultimaCreazione: '2026-11-01' }), OGGI),
      decidiNotifica(st({ gestisce: true, checkinDaFare: '2026-10-01' }), OGGI),
      decidiNotifica(st({ versamento: vers(12) }), OGGI),
    ];
    for (const n of tutte) {
      expect(n).not.toBeNull();
      const t = `${n!.titolo} ${n!.testo}`.toLowerCase();
      for (const p of PAROLE_VIETATE) expect(t).not.toContain(p);
    }
  });
});

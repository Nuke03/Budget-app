import { describe, it, expect } from 'vitest';
import { computeReminders, statoPromemoria, type StatoPromemoria } from '@/lib/calculations/casa/promemoria';
import { PAROLE_VIETATE } from '../../helpers/paroleVietate';

const me = { userId: 'u1' };
const base: StatoPromemoria = {
  giornoVersamento: 5,
  mesePiano: '2026-11-01',
  versamentoMese: { atteso: 776, versato: 0 },
  nomi: { u1: 'Fabio', u2: 'Anna', u3: 'Luca' },
  crediti: {},
  debiti: [],
};
const debito = (debitoreId: string, creditoreId: string) => ({
  debitoreId,
  creditoreId,
  importo: 603,
  mesi: [{ mese: '2026-11-01', importo: 603, versato: 603 }],
});

describe('computeReminders', () => {
  it('3 giorni prima del giorno di versamento compare il versamento con testo e azione Registra', () => {
    const r = computeReminders(base, me, '2026-11-02');
    expect(r).toHaveLength(1);
    expect(r[0].testo).toBe('Il tuo versamento di 776 € è da fare entro il 5.');
    expect(r[0].azione).toEqual({ tipo: 'versamento', etichetta: 'Registra', importo: 776 });
  });

  it('prima di quella data non compare', () => {
    expect(computeReminders(base, me, '2026-11-01')).toEqual([]);
  });

  it('dopo il giorno il tono resta neutro e senza la parola ritardo', () => {
    const r = computeReminders(base, me, '2026-11-20');
    expect(r[0].testo).toBe('Il versamento di novembre è ancora da registrare. Già fatto? Registralo con la spunta "già riflesso".');
    expect(r[0].testo.toLowerCase()).not.toContain('ritardo');
  });

  it('l importo è quanto manca', () => {
    const r = computeReminders({ ...base, versamentoMese: { atteso: 776, versato: 300 } }, me, '2026-11-03');
    expect(r[0].azione?.importo).toBe(476);
  });

  it('versato uguale ad atteso: silenzio', () => {
    expect(computeReminders({ ...base, versamentoMese: { atteso: 776, versato: 776 } }, me, '2026-11-20')).toEqual([]);
  });

  it('il creditore vede In attesa del rimborso senza azione, gli altri membri Rimborsa', () => {
    const s = { ...base, giornoVersamento: null, crediti: { u1: 45 } };
    const mio = computeReminders(s, me, '2026-11-03');
    expect(mio[0].testo).toBe('In attesa del rimborso: 45 €.');
    expect(mio[0].azione).toBeNull();

    const altro = computeReminders(s, { userId: 'u2' }, '2026-11-03');
    expect(altro[0].testo).toBe('A Fabio spettano 45 € per spese anticipate.');
    expect(altro[0].azione).toEqual({ tipo: 'rimborso', etichetta: 'Rimborsa', importo: 45, altroUserId: 'u1' });

    const terzo = computeReminders(s, { userId: 'u3' }, '2026-11-03');
    expect(terzo[0].azione?.altroUserId).toBe('u1');
  });

  it('il debitore vede Restituisci, il creditore solo l informazione', () => {
    const s = { ...base, giornoVersamento: null, debiti: [debito('u1', 'u2')] };
    const d = computeReminders(s, me, '2026-11-03');
    expect(d[0].testo).toBe('Resta da restituire a Anna: 603 € (quota di novembre). Anche a rate, quando puoi.');
    expect(d[0].azione).toEqual({ tipo: 'restituisci', etichetta: 'Restituisci', importo: 603, altroUserId: 'u2' });

    const c = computeReminders(s, { userId: 'u2' }, '2026-11-03');
    expect(c[0].testo).toBe('Fabio deve ancora 603 € a te.');
    expect(c[0].azione).toBeNull();
  });

  it('al massimo due promemoria nell ordine versamento, credito, debito', () => {
    const s = { ...base, crediti: { u1: 45 }, debiti: [debito('u2', 'u1')] };
    const r = computeReminders(s, me, '2026-11-03');
    expect(r.map((p) => p.tipo)).toEqual(['versamento', 'credito']);
  });

  it('nessun testo contiene colpa, ritardo, scaduto o parole vietate', () => {
    const s = { ...base, crediti: { u1: 45, u2: 10 }, debiti: [debito('u1', 'u2'), debito('u2', 'u1')] };
    for (const oggi of ['2026-11-02', '2026-11-20']) {
      for (const utente of [me, { userId: 'u2' }]) {
        for (const p of computeReminders(s, utente, oggi)) {
          for (const v of [...PAROLE_VIETATE, 'colpa', 'ritardo', 'scaduto']) expect(p.testo.toLowerCase()).not.toContain(v);
        }
      }
    }
  });
});

describe('statoPromemoria', () => {
  it('ricava giorno, mese e versamento dal piano e dalla riga del mese corrente', () => {
    const piano = { plan: { giornoVersamento: 5 } } as never;
    const righe = [
      { mese: '2026-10-01', atteso: 700, versato: 0, mancano: 700 },
      { mese: '2026-11-01', atteso: 776, versato: 100, mancano: 676 },
    ];
    const s = statoPromemoria({ piano, righe, oggi: '2026-11-03', nomi: {}, crediti: {}, debiti: [] });
    expect(s).toMatchObject({ giornoVersamento: 5, mesePiano: '2026-11-01', versamentoMese: { atteso: 776, versato: 100 } });
  });

  it('senza riga del mese non c e versamento', () => {
    const s = statoPromemoria({ piano: null, righe: [], oggi: '2026-11-03', nomi: {}, crediti: {}, debiti: [] });
    expect(s).toMatchObject({ giornoVersamento: null, mesePiano: null, versamentoMese: null });
  });
});

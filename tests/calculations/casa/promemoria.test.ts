import { describe, it, expect } from 'vitest';
import { computeReminders, statoPromemoria, type StatoPromemoria } from '@/lib/calculations/casa/promemoria';
import { giornoEMeseScadenza } from '@/lib/format';
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

describe('giornoEMeseScadenza', () => {
  it('solo il primo del mese porta il °', () => {
    expect(giornoEMeseScadenza('2026-11-01', 1)).toBe('1° novembre');
    expect(giornoEMeseScadenza('2026-11-01', 5)).toBe('5 novembre');
    expect(giornoEMeseScadenza('2026-12-01', 11)).toBe('11 dicembre');
  });
});

describe('computeReminders', () => {
  it('3 giorni prima del giorno di versamento compare il versamento con testo e azione Registra', () => {
    const r = computeReminders(base, me, '2026-11-02');
    expect(r).toHaveLength(1);
    expect(r[0].testo).toBe('Il tuo versamento di 776 € è da fare entro il 5 novembre.');
    expect(r[0].azione).toEqual({ tipo: 'versamento', etichetta: 'Registra', importo: 776 });
  });

  it('un debito da Tricount parla di saldo di partenza, non di quota', () => {
    const d = { ...debito('u1', 'u2'), mesi: [{ mese: '2026-11-01', importo: 603, versato: 603, origine: 'tricount' as const }] };
    const r = computeReminders({ ...base, giornoVersamento: null, debiti: [d] }, me, '2026-11-03');
    expect(r[0].testo).toBe('Resta da restituire a Anna: 603 € (saldo di partenza da Tricount). Anche a rate, quando puoi.');
  });

  it('prima di quella data non compare', () => {
    expect(computeReminders(base, me, '2026-11-01')).toEqual([]);
  });

  it('dopo il giorno il tono resta neutro e senza la parola ritardo', () => {
    const r = computeReminders(base, me, '2026-11-20');
    expect(r[0].testo).toBe("Il versamento di novembre non risulta ancora. L'hai già fatto? Segnalalo qui.");
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

  it('restituisce tutti i promemoria nell ordine versamento, credito, debito (il taglio a due lo fa la striscia)', () => {
    const s = { ...base, crediti: { u1: 45 }, debiti: [debito('u2', 'u1')] };
    const r = computeReminders(s, me, '2026-11-03');
    expect(r.map((p) => p.tipo)).toEqual(['versamento', 'credito', 'debito']);
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

describe('controllo del saldo dopo 14 giorni', () => {
  const conControllo = (controllo: StatoPromemoria['controllo']): StatoPromemoria => ({ ...base, controllo });
  const testoControllo = 'Un controllo veloce del conto comune? Confrontate il saldo con quello della banca.';

  it('dopo più di 14 giorni dall ultimo controllo compare con href', () => {
    const r = computeReminders(
      conControllo({ ultimo: '2026-10-25', riferimento: '2026-10-01', haConto: true }),
      me,
      '2026-11-09'
    );
    const controllo = r.find((p) => p.tipo === 'controllo');
    expect(controllo?.testo).toBe(testoControllo);
    expect(controllo?.azione).toEqual({ tipo: 'controllo', etichetta: 'Controlla', href: '/casa/controllo/conto' });
  });

  it('a 14 giorni esatti non compare', () => {
    const r = computeReminders(
      conControllo({ ultimo: '2026-10-26', riferimento: '2026-10-01', haConto: true }),
      me,
      '2026-11-09'
    );
    expect(r.some((p) => p.tipo === 'controllo')).toBe(false);
  });

  it('senza nessun controllo conta dal riferimento', () => {
    const r = computeReminders(
      conControllo({ ultimo: null, riferimento: '2026-10-20', haConto: true }),
      me,
      '2026-11-09'
    );
    expect(r.some((p) => p.tipo === 'controllo')).toBe(true);
  });

  it('senza conto non compare mai', () => {
    const r = computeReminders(
      conControllo({ ultimo: null, riferimento: '2026-01-01', haConto: false }),
      me,
      '2026-11-09'
    );
    expect(r.some((p) => p.tipo === 'controllo')).toBe(false);
  });

  it('viene dopo versamento, crediti e debiti', () => {
    const r = computeReminders(
      {
        ...conControllo({ ultimo: null, riferimento: '2026-01-01', haConto: true }),
        crediti: { u1: 45 },
        debiti: [debito('u2', 'u1')],
      },
      me,
      '2026-11-09'
    );
    expect(r.map((p) => p.tipo)).toEqual(['versamento', 'credito', 'debito', 'controllo']);
  });

  it('senza il campo controllo i promemoria restano quelli di prima', () => {
    expect(computeReminders(base, me, '2026-11-20').map((p) => p.tipo)).toEqual(['versamento']);
  });
});

describe('check-in', () => {
  const conCheckin = (mese: string | null): StatoPromemoria => ({ ...base, giornoVersamento: null, checkin: { mese } });

  it('check-in pronto', () => {
    const r = computeReminders(conCheckin('2026-10-01'), me, '2026-11-09');
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe('checkin:2026-10-01');
    expect(r[0].tipo).toBe('checkin');
    expect(r[0].testo).toBe("Il check-in di ottobre è pronto: due minuti per vedere com'è andato il mese.");
    expect(r[0].azione).toEqual({ tipo: 'checkin', etichetta: 'Apri', href: '/casa/controllo' });
  });

  it('mese null: nessun promemoria', () => {
    expect(computeReminders(conCheckin(null), me, '2026-11-09')).toEqual([]);
  });

  it('viene dopo i debiti e prima del controllo del saldo', () => {
    const r = computeReminders(
      {
        ...conCheckin('2026-10-01'),
        debiti: [debito('u2', 'u1')],
        controllo: { ultimo: null, riferimento: '2026-01-01', haConto: true },
      },
      me,
      '2026-11-09'
    );
    expect(r.map((p) => p.tipo)).toEqual(['debito', 'checkin', 'controllo']);
  });

  it('statoPromemoria calcola il mese con ultimoCheckinMese', () => {
    const input = {
      piano: null,
      righe: [{ mese: '2026-09-01', atteso: 1, versato: 1, mancano: 0 }, { mese: '2026-10-01', atteso: 1, versato: 1, mancano: 0 }],
      oggi: '2026-11-09',
      nomi: {},
      crediti: {},
      debiti: [],
    };
    expect(statoPromemoria({ ...input, ultimoCheckinMese: '2026-09-01' }).checkin).toEqual({ mese: '2026-10-01' });
    expect(statoPromemoria({ ...input, ultimoCheckinMese: '2026-10-01' }).checkin).toEqual({ mese: null });
    expect(statoPromemoria(input).checkin).toBeUndefined();
  });
});

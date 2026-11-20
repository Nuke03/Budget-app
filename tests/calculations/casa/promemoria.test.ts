import { describe, it, expect, beforeEach } from 'vitest';
import { computeReminders, motivoRivediQuota, statoPromemoria, type StatoPromemoria } from '@/lib/calculations/casa/promemoria';
import { giornoEMeseScadenza } from '@/lib/format';
import { dataFraMesi, promemoriaRimandato, rimandaFinoAl, rimandaPromemoria } from '@/app/casa/rimandaPromemoria';
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

describe('rivedi la quota', () => {
  const piano = (validoDal: string, previsto = 1000) =>
    ({ plan: { validoDal, giornoVersamento: 5 }, items: [{ frequenzaMesi: 1, importoMensile: previsto, goalId: null }], shares: [] }) as never;
  const spesa = (data: string, importo: number) =>
    ({ tipo: 'expense', importo, data, categoriaId: null, origine: 'manuale', goalId: null }) as never;
  const oggi = '2026-11-19';
  const input = (over: Partial<Parameters<typeof motivoRivediQuota>[0]> = {}) => ({
    gestisce: true,
    piani: [piano('2026-06-01')],
    spese: [spesa('2026-09-10', 1200), spesa('2026-10-10', 1200)],
    oggi,
    ...over,
  });

  it('due mesi completi sopra il previsto del 10%: scatta per le spese', () => {
    expect(motivoRivediQuota(input())).toBe('spese');
  });

  it('un solo mese sopra: non scatta', () => {
    expect(motivoRivediQuota(input({ spese: [spesa('2026-09-10', 1000), spesa('2026-10-10', 1200)] }))).toBeNull();
  });

  it('9,9% sopra: non scatta, e il 10% esatto nemmeno', () => {
    expect(motivoRivediQuota(input({ spese: [spesa('2026-09-10', 1099), spesa('2026-10-10', 1099)] }))).toBeNull();
    expect(motivoRivediQuota(input({ spese: [spesa('2026-09-10', 1100), spesa('2026-10-10', 1100)] }))).toBeNull();
  });

  it('il mese in corso non conta', () => {
    expect(motivoRivediQuota(input({ spese: [spesa('2026-10-10', 1200), spesa('2026-11-10', 1200)] }))).toBeNull();
  });

  it('se un mese era fuori dal piano non scatta per le spese', () => {
    expect(motivoRivediQuota(input({ piani: [piano('2026-10-01')] }))).toBeNull();
  });

  it('sei mesi dall inizio del piano in vigore: scatta per il tempo', () => {
    expect(motivoRivediQuota(input({ piani: [piano('2026-05-01')], spese: [] }))).toBe('tempo');
    expect(motivoRivediQuota(input({ piani: [piano('2026-06-01')], spese: [] }))).toBeNull();
  });

  it('conta la versione in vigore, non la prima', () => {
    expect(motivoRivediQuota(input({ piani: [piano('2026-01-01'), piano('2026-09-01')], spese: [] }))).toBeNull();
  });

  const versione = (validoDal: string, createdAt: string) =>
    ({ plan: { validoDal, createdAt, giornoVersamento: 5 }, items: [{ frequenzaMesi: 1, importoMensile: 1000, goalId: null }], shares: [] }) as never;

  it('dopo una revisione salvata oggi non chiede più, anche con settembre e ottobre sopra il previsto', () => {
    const piani = [versione('2026-06-01', '2026-06-02T10:00:00Z'), versione('2026-11-01', '2026-11-19T09:00:00Z')];
    expect(motivoRivediQuota(input({ piani }))).toBeNull();
    // senza la revisione chiederebbe
    expect(motivoRivediQuota(input({ piani: [versione('2026-06-01', '2026-06-02T10:00:00Z')] }))).toBe('spese');
  });

  it('una versione che parte dal mese prossimo: nessun promemoria, né per le spese né per il tempo', () => {
    const futura = versione('2026-12-01', '2026-08-01T10:00:00Z');
    expect(motivoRivediQuota(input({ piani: [versione('2026-06-01', '2026-06-02T10:00:00Z'), futura] }))).toBeNull();
    expect(motivoRivediQuota(input({ piani: [versione('2026-01-01', '2026-01-02T10:00:00Z'), futura], spese: [] }))).toBeNull();
  });

  it('chi non gestisce non lo vede mai', () => {
    expect(motivoRivediQuota(input({ gestisce: false }))).toBeNull();
    expect(motivoRivediQuota(input({ gestisce: false, piani: [piano('2026-01-01')] }))).toBeNull();
  });

  it('statoPromemoria porta il motivo solo se gli arrivano i dati', () => {
    const b = { piano: null, righe: [], oggi, nomi: {}, crediti: {}, debiti: [] };
    expect(statoPromemoria(b).quota).toBeUndefined();
    expect(statoPromemoria({ ...b, rivediQuota: input() }).quota).toEqual({ motivo: 'spese', validoDal: '2026-06-01' });
  });

  it('i testi sono calmi e il link va alla quota', () => {
    for (const [motivo, testo] of [
      ['spese', 'Le spese della casa sono sopra il previsto da due mesi: rivedere la quota?'],
      ['tempo', 'Sono passati 6 mesi dall\'ultima quota: vale un controllo?'],
    ] as const) {
      const r = computeReminders({ ...base, giornoVersamento: null, versamentoMese: null, quota: { motivo, validoDal: '2026-05-01' } }, me, oggi);
      expect(r).toHaveLength(1);
      expect(r[0]).toMatchObject({ id: motivo === 'spese' ? 'quota:spese' : 'quota:tempo:2026-05-01', tipo: 'quota', testo });
      expect(r[0].azione).toEqual({ tipo: 'quota', etichetta: 'Rivedi', href: '/casa/quota' });
      expect(r[0].silenzia).toEqual(['quota:spese', 'quota:tempo:2026-05-01']);
      for (const v of [...PAROLE_VIETATE, 'colpa', 'ritardo', 'scaduto']) expect(r[0].testo.toLowerCase()).not.toContain(v);
    }
  });

  it('viene dopo versamento, debiti, check-in e controllo', () => {
    const r = computeReminders(
      {
        ...base,
        debiti: [debito('u2', 'u1')],
        checkin: { mese: '2026-10-01' },
        controllo: { ultimo: null, riferimento: '2026-01-01', haConto: true },
        quota: { motivo: 'spese', validoDal: '2026-06-01' },
      },
      me,
      '2026-11-09'
    );
    expect(r.map((p) => p.tipo)).toEqual(['versamento', 'debito', 'checkin', 'controllo', 'quota']);
  });
});

describe('rivedi la quota: Più tardi e Va bene così', () => {
  const q = (motivo: 'spese' | 'tempo', validoDal: string) =>
    computeReminders({ ...base, giornoVersamento: null, versamentoMese: null, quota: { motivo, validoDal } }, me, '2026-11-19')[0];
  beforeEach(() => window.localStorage.clear());

  it('Va bene così nasconde entrambi i motivi per 6 mesi, poi tornano', () => {
    const tempo = q('tempo', '2026-05-01');
    const finoAl = dataFraMesi('2026-11-19', 6);
    expect(finoAl).toBe('2027-05-19');
    for (const id of tempo.silenzia ?? []) rimandaFinoAl(id, finoAl);
    expect(promemoriaRimandato(q('tempo', '2026-05-01').id, '2026-11-19')).toBe(true);
    expect(promemoriaRimandato('quota:spese', '2027-03-01')).toBe(true);
    expect(promemoriaRimandato('quota:tempo:2026-05-01', '2027-05-18')).toBe(true);
    expect(promemoriaRimandato('quota:spese', '2027-05-19')).toBe(false);
    expect(promemoriaRimandato('quota:tempo:2026-05-01', '2027-05-19')).toBe(false);
  });

  it('una nuova versione del piano riporta il promemoria del tempo', () => {
    rimandaFinoAl('quota:tempo:2026-05-01', '2027-05-19');
    expect(q('tempo', '2026-05-01').id).not.toBe(q('tempo', '2026-11-01').id);
    expect(promemoriaRimandato(q('tempo', '2026-11-01').id, '2026-11-20')).toBe(false);
  });

  it('Più tardi vale un giorno', () => {
    rimandaPromemoria('quota:spese', '2026-11-19');
    expect(promemoriaRimandato('quota:spese', '2026-11-19')).toBe(true);
    expect(promemoriaRimandato('quota:spese', '2026-11-20')).toBe(false);
  });

  it('il testo del pulsante passa le parole vietate', () => {
    for (const v of PAROLE_VIETATE) expect('va bene così').not.toContain(v);
  });
});

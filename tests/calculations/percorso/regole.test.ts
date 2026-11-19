import { describe, it, expect } from 'vitest';
import {
  ruoloCategoria, eRata, meseStretto, puoProporre, lezioneDopoSalvataggio, lezioneDelGiorno,
  type DatiRegole,
} from '@/lib/calculations/percorso/regole';
import type { BudgetGoal, Category, Transaction } from '@/lib/types';
import type { PercorsoUtente } from '@/lib/percorso/tipi';

const OGGI = '2026-11-19';

const cat = (id: string, nome: string, ruolo: Category['ruolo'] = null): Category => ({
  id, nome, tipo: 'expense', colore: null, archiviata: false, ruolo,
});

const tr = (over: Partial<Transaction> = {}): Transaction => ({
  id: 't', tipo: 'expense', importo: 10, data: OGGI, categoriaId: null, accountId: 'c1',
  goalId: null, descrizione: '', nota: null, createdAt: '2026-01-01T00:00:00.000Z', stima: false, ...over,
});

const goal = (over: Partial<BudgetGoal & { accantonato: number }> = {}): BudgetGoal & { accantonato: number } => ({
  id: 'g1', nome: 'Fondo', importoTarget: 300, modalita: 'dilazionato', scadenza: null, categoriaId: null,
  ricorrente: false, frequenzaMesi: null, stato: 'aperto', createdAt: '2026-01-01', accantonato: 0, ...over,
});

const percorso = (over: Partial<PercorsoUtente> = {}): PercorsoUtente => ({
  entrateTipo: null, entrataAttesa: null, entrataAttesaIl: null, redditoBase: null,
  settimanaDal: null, settimanaFattaIl: null, speseCerteNessuna: false, obiettivoPiuAvanti: false,
  nascosti: false, ultimaPropostaIl: null, ...over,
});

const dati = (over: Partial<DatiRegole> = {}): DatiRegole => ({
  oggi: OGGI, transazioni: [], categorie: [], goals: [], lezioni: {}, percorso: percorso(),
  disponibileReale: 500, ultimaEntrataIl: '2026-11-10', primiPassiVisibili: false, ...over,
});

const giorniFa = (n: number): string => new Date(Date.parse(`${OGGI}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

describe('ruoloCategoria', () => {
  it('Auto e Assicurazione sono certe, Bar e ristoranti no, il ruolo salvato vince sul nome', () => {
    expect(ruoloCategoria(cat('a', 'Auto'))).toBe('certa');
    expect(ruoloCategoria(cat('b', 'Assicurazione'))).toBe('certa');
    expect(ruoloCategoria(cat('c', 'Bar e ristoranti'))).toBeNull();
    expect(ruoloCategoria(cat('d', 'Shopping'))).toBe('svago');
    expect(ruoloCategoria(cat('e', 'Auto', 'svago'))).toBe('svago');
    expect(ruoloCategoria(cat('f', 'Abbonamenti'))).toBe('certa');
    expect(ruoloCategoria(cat('g', 'Rèvisione'))).toBe('certa');
  });
});

describe('eRata', () => {
  it('Klarna e "rata telefono" sono rate, "pirata" no', () => {
    expect(eRata(tr({ descrizione: 'Klarna' }), [])).toBe(true);
    expect(eRata(tr({ descrizione: 'Rata telefono' }), [])).toBe(true);
    expect(eRata(tr({ descrizione: 'Cena pirata' }), [])).toBe(false);
    expect(eRata(tr({ descrizione: 'Spesa' }), [])).toBe(false);
  });
  it('anche dal nome della categoria', () => {
    expect(eRata(tr({ categoriaId: 'x' }), [cat('x', 'Finanziamento auto')])).toBe(true);
  });
});

describe('meseStretto', () => {
  it('disponibile -1 è stretto; ultima entrata 31 giorni fa è stretto; 29 no', () => {
    expect(meseStretto(dati({ disponibileReale: -1 }))).toBe(true);
    expect(meseStretto(dati({ ultimaEntrataIl: giorniFa(31) }))).toBe(true);
    expect(meseStretto(dati({ ultimaEntrataIl: giorniFa(29) }))).toBe(false);
    expect(meseStretto(dati({ ultimaEntrataIl: null }))).toBe(true);
  });
});

describe('puoProporre', () => {
  it('una al giorno', () => {
    expect(puoProporre('piano', dati())).toBe(true);
    expect(puoProporre('piano', dati({ percorso: percorso({ ultimaPropostaIl: OGGI }) }))).toBe(false);
    expect(puoProporre('piano', dati({ percorso: percorso({ ultimaPropostaIl: giorniFa(1) }) }))).toBe(true);
  });
  it('più tardi blocca per 14 giorni', () => {
    const stato = (rimandataAl: string) => ({ piano: { vistaIl: null, rimandataAl, azioneIl: null, propostaIl: null } });
    expect(puoProporre('piano', dati({ lezioni: stato('2026-12-03') }))).toBe(false);
    expect(puoProporre('piano', dati({ lezioni: stato(OGGI) }))).toBe(true);
  });
  it('vista 59 giorni fa no, 60 sì', () => {
    const vista = (n: number) => ({ piano: { vistaIl: giorniFa(n), rimandataAl: null, azioneIl: null, propostaIl: null } });
    expect(puoProporre('piano', dati({ lezioni: vista(59) }))).toBe(false);
    expect(puoProporre('piano', dati({ lezioni: vista(60) }))).toBe(true);
    expect(puoProporre('piano', dati({ lezioni: vista(100) }), 365)).toBe(false);
  });
  it('in mese stretto le lezioni dopo no', () => {
    const stretto = dati({ disponibileReale: -5 });
    expect(puoProporre('risparmio-investimento', stretto)).toBe(false); // fase dopo
    expect(puoProporre('piano', stretto)).toBe(true); // fase adesso
    expect(puoProporre('risparmio-investimento', dati())).toBe(true);
  });
});

describe('lezioneDopoSalvataggio', () => {
  const cats = [cat('auto', 'Auto'), cat('svago', 'Svago'), cat('cibo', 'Cibo')];

  it('1: rata', () => {
    expect(lezioneDopoSalvataggio(tr({ importo: 30, descrizione: 'Klarna' }), dati())).toBe('debiti-rate');
  });
  it('rata da 200 € vince su imprevisti', () => {
    expect(lezioneDopoSalvataggio(tr({ importo: 200, descrizione: 'Rata telefono' }), dati())).toBe('debiti-rate');
  });
  it('2: spesa sopra 150 senza obiettivo', () => {
    expect(lezioneDopoSalvataggio(tr({ importo: 151, categoriaId: 'cibo' }), dati({ categorie: cats }))).toBe('imprevisti');
    expect(lezioneDopoSalvataggio(tr({ importo: 150, categoriaId: 'cibo' }), dati({ categorie: cats }))).not.toBe('imprevisti');
    expect(lezioneDopoSalvataggio(tr({ importo: 200, goalId: 'g1', categoriaId: 'cibo' }), dati({ categorie: cats }))).not.toBe('imprevisti');
  });
  it('3: categoria certa senza obiettivo aperto', () => {
    const t = tr({ importo: 60, categoriaId: 'auto' });
    expect(lezioneDopoSalvataggio(t, dati({ categorie: cats }))).toBe('spese-certe');
    expect(lezioneDopoSalvataggio(t, dati({ categorie: cats, goals: [goal({ categoriaId: 'auto' })] }))).toBeNull();
    // obiettivo chiuso non conta
    expect(lezioneDopoSalvataggio(t, dati({ categorie: cats, goals: [goal({ categoriaId: 'auto', stato: 'chiuso' })] }))).toBe('spese-certe');
  });
  it('4: svago sopra 40, una volta al mese', () => {
    const t = tr({ importo: 41, categoriaId: 'svago' });
    expect(lezioneDopoSalvataggio(t, dati({ categorie: cats }))).toBe('impulso');
    const giaProposta = { impulso: { vistaIl: null, rimandataAl: null, azioneIl: null, propostaIl: '2026-11-02' } };
    expect(lezioneDopoSalvataggio(t, dati({ categorie: cats, lezioni: giaProposta }))).toBeNull();
    const mesePrima = { impulso: { vistaIl: null, rimandataAl: null, azioneIl: null, propostaIl: '2026-10-28' } };
    expect(lezioneDopoSalvataggio(t, dati({ categorie: cats, lezioni: mesePrima }))).toBe('impulso');
  });
  it('5: entrata grande', () => {
    const altra = tr({ id: 'o', tipo: 'income', importo: 100, data: '2026-11-01' });
    expect(lezioneDopoSalvataggio(tr({ tipo: 'income', importo: 301 }), dati({ transazioni: [altra] }))).toBe('prima-da-parte');
  });
  it('6: prima entrata del mese, o disponibile basso', () => {
    const entrata = tr({ id: 'n', tipo: 'income', importo: 100 });
    expect(lezioneDopoSalvataggio(entrata, dati({ transazioni: [entrata] }))).toBe('piano');
    const altra = tr({ id: 'o', tipo: 'income', importo: 100, data: '2026-11-01' });
    expect(lezioneDopoSalvataggio(entrata, dati({ transazioni: [altra, entrata] }))).toBeNull();
    // entrata di un altro mese non conta
    const vecchia = tr({ id: 'v', tipo: 'income', importo: 100, data: '2026-10-30' });
    expect(lezioneDopoSalvataggio(entrata, dati({ transazioni: [vecchia, entrata] }))).toBe('piano');
    expect(lezioneDopoSalvataggio(tr({ importo: 10 }), dati({ disponibileReale: 49 }))).toBe('piano');
  });
  it('7: tante piccole spese', () => {
    const piccole = Array.from({ length: 10 }, (_, i) => tr({ id: `p${i}`, importo: 4 }));
    expect(lezioneDopoSalvataggio(tr({ id: 'x', importo: 4 }), dati({ transazioni: piccole }))).toBe('dove-vanno');
    expect(lezioneDopoSalvataggio(tr({ id: 'x', importo: 4 }), dati({ transazioni: piccole.slice(0, 5) }))).toBeNull();
    expect(lezioneDopoSalvataggio(tr({ id: 'x', importo: 5 }), dati({ transazioni: piccole }))).toBeNull();
  });
  it('salta il candidato che non può essere proposto e prende il successivo', () => {
    const t = tr({ id: 'n', tipo: 'income', importo: 400 });
    const lezioni = { 'prima-da-parte': { vistaIl: null, rimandataAl: '2026-12-01', azioneIl: null, propostaIl: null } };
    expect(lezioneDopoSalvataggio(t, dati({ transazioni: [t], lezioni }))).toBe('piano');
  });
});

describe('lezioneDelGiorno: proposta di oggi', () => {
  const stato = (over: object) => ({ vistaIl: null, rimandataAl: null, azioneIl: null, propostaIl: null, ...over });
  it('la lezione proposta oggi resta visibile tutto il giorno', () => {
    const d = dati({
      lezioni: { imprevisti: stato({ propostaIl: OGGI }) },
      percorso: percorso({ ultimaPropostaIl: OGGI }),
    });
    expect(lezioneDelGiorno(d)).toBe('imprevisti');
  });
  it('dopo averla aperta oggi non torna', () => {
    const d = dati({
      lezioni: { imprevisti: stato({ propostaIl: OGGI, vistaIl: OGGI }) },
      percorso: percorso({ ultimaPropostaIl: OGGI }),
    });
    expect(lezioneDelGiorno(d)).toBeNull();
  });
  it('con i primi passi visibili resta null anche se proposta oggi', () => {
    const d = dati({ primiPassiVisibili: true, lezioni: { imprevisti: stato({ propostaIl: OGGI }) } });
    expect(lezioneDelGiorno(d)).toBeNull();
  });
});

describe('lezioneDelGiorno', () => {
  it('null con primi passi visibili', () => {
    expect(lezioneDelGiorno(dati({ primiPassiVisibili: true, disponibileReale: 0 }))).toBeNull();
  });
  it('1: piano con disponibile basso', () => {
    expect(lezioneDelGiorno(dati({ disponibileReale: 10 }))).toBe('piano');
  });
  it('2: imprevisti se manca il fondo', () => {
    expect(lezioneDelGiorno(dati())).toBe('imprevisti');
  });
  it('3: reddito irregolare con mesi che differiscono del 30%', () => {
    const fondo = [goal({ ruolo: 'imprevisti', accantonato: 0 })];
    const entrate = [
      tr({ id: 'a', tipo: 'income', importo: 1000, data: '2026-10-05' }),
      tr({ id: 'b', tipo: 'income', importo: 600, data: '2026-09-05' }),
    ];
    const irr = dati({ goals: fondo, transazioni: entrate, percorso: percorso({ entrateTipo: 'irregolari' }) });
    expect(lezioneDelGiorno(irr)).toBe('reddito-irregolare');
    expect(lezioneDelGiorno({ ...irr, percorso: percorso({ entrateTipo: 'fisse' }) })).not.toBe('reddito-irregolare');
    const simili = [entrate[0], tr({ id: 'c', tipo: 'income', importo: 800, data: '2026-09-05' })];
    expect(lezioneDelGiorno({ ...irr, transazioni: simili })).not.toBe('reddito-irregolare');
  });
  it('4: risparmio-investimento a fondo pieno', () => {
    const pieno = [goal({ ruolo: 'imprevisti', importoTarget: 200, accantonato: 200 })];
    expect(lezioneDelGiorno(dati({ goals: pieno }))).toBe('risparmio-investimento');
    const mezzo = [goal({ ruolo: 'imprevisti', importoTarget: 200, accantonato: 100 })];
    expect(lezioneDelGiorno(dati({ goals: mezzo }))).toBe('truffe');
  });
  it('5: truffe e poi pensione, a distanza di un anno', () => {
    const mezzo = [goal({ ruolo: 'imprevisti', importoTarget: 200, accantonato: 100 })];
    const truffeVista = { truffe: { vistaIl: giorniFa(10), rimandataAl: null, azioneIl: null, propostaIl: null } };
    expect(lezioneDelGiorno(dati({ goals: mezzo, lezioni: truffeVista }))).toBe('pensione');
  });
  it('truffe torna dopo 365 giorni', () => {
    const mezzo = [goal({ ruolo: 'imprevisti', importoTarget: 200, accantonato: 100 })];
    const vista = (n: number) => ({
      truffe: { vistaIl: giorniFa(n), rimandataAl: null, azioneIl: null, propostaIl: null },
      pensione: { vistaIl: giorniFa(n), rimandataAl: null, azioneIl: null, propostaIl: null },
    });
    expect(lezioneDelGiorno(dati({ goals: mezzo, lezioni: vista(364) }))).toBeNull();
    expect(lezioneDelGiorno(dati({ goals: mezzo, lezioni: vista(365) }))).toBe('truffe');
  });
  it('6: inflazione con dati vecchi di un anno', () => {
    const mezzo = [goal({ ruolo: 'imprevisti', importoTarget: 200, accantonato: 100 })];
    const viste = {
      truffe: { vistaIl: giorniFa(10), rimandataAl: null, azioneIl: null, propostaIl: null },
      pensione: { vistaIl: giorniFa(10), rimandataAl: null, azioneIl: null, propostaIl: null },
    };
    const vecchia = tr({ id: 'v', data: giorniFa(365) });
    const recente = tr({ id: 'r', data: giorniFa(364) });
    expect(lezioneDelGiorno(dati({ goals: mezzo, lezioni: viste, transazioni: [vecchia] }))).toBe('inflazione');
    expect(lezioneDelGiorno(dati({ goals: mezzo, lezioni: viste, transazioni: [recente] }))).toBeNull();
  });
});

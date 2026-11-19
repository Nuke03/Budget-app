import { describe, expect, it } from 'vitest';
import { settimanaFinita, statoPrimiPassi } from '@/lib/calculations/percorso/passi';
import { riepilogoSettimana } from '@/lib/calculations/percorso/primiPassiFondi';
import type { Account, BudgetGoal } from '@/lib/types';
import type { PercorsoUtente } from '@/lib/percorso/tipi';

const percorso = (o: Partial<PercorsoUtente> = {}): PercorsoUtente => ({
  entrateTipo: null, entrataAttesa: null, entrataAttesaIl: null, redditoBase: null,
  settimanaDal: null, settimanaFattaIl: null,
  speseCerteNessuna: false, obiettivoPiuAvanti: false, nascosti: false,
  ultimaPropostaIl: null,
  ...o,
});

const conto = (o: Partial<Account> = {}): Account => ({
  id: 'a1', nome: 'Conto', saldoAttuale: 0, contaInDisponibile: true, targetSaldo: null, archiviato: false, ...o,
});

const goal = (o: Partial<BudgetGoal> = {}): BudgetGoal => ({
  id: 'g1', nome: 'Obiettivo', importoTarget: 100, modalita: 'bloccato', scadenza: null, categoriaId: null,
  ricorrente: false, frequenzaMesi: null, stato: 'aperto', createdAt: '2026-01-01', ruolo: null, ...o,
});

const base = { conti: [] as Account[], goals: [] as BudgetGoal[], percorso: null, pivaGuidata: false, oggi: '2026-11-19' };

describe('statoPrimiPassi', () => {
  it('utente nuovo: 0 di 6, prossimo conti, visibile', () => {
    const r = statoPrimiPassi(base);
    expect(r.fatti).toBe(0);
    expect(r.totale).toBe(6);
    expect(r.prossimo).toBe('conti');
    expect(r.visibile).toBe(true);
    expect(r.passi.map((p) => p.id)).toEqual(['conti', 'entrate', 'settimana', 'spese-certe', 'imprevisti', 'obiettivo']);
  });

  it('con entrate piva i passi diventano 7 e piva segue entrate', () => {
    const r = statoPrimiPassi({ ...base, percorso: percorso({ entrateTipo: 'piva' }) });
    expect(r.totale).toBe(7);
    expect(r.passi.map((p) => p.id)).toEqual(['conti', 'entrate', 'piva', 'settimana', 'spese-certe', 'imprevisti', 'obiettivo']);
    expect(r.passi.find((p) => p.id === 'piva')?.fatto).toBe(false);
  });

  it('Miriam: conti, obiettivi e piva guidata già presenti risultano fatti', () => {
    const r = statoPrimiPassi({
      ...base,
      conti: [conto()],
      goals: [
        goal({ id: 'g1', modalita: 'dilazionato', ricorrente: true }),
        goal({ id: 'g2', ruolo: 'imprevisti' }),
        goal({ id: 'g3' }),
      ],
      percorso: percorso({ entrateTipo: 'piva' }),
      pivaGuidata: true,
    });
    const fatto = (id: string) => r.passi.find((p) => p.id === id)?.fatto;
    expect(fatto('conti')).toBe(true);
    expect(fatto('entrate')).toBe(true);
    expect(fatto('piva')).toBe(true);
    expect(fatto('spese-certe')).toBe(true);
    expect(fatto('imprevisti')).toBe(true);
    expect(fatto('obiettivo')).toBe(true);
    expect(fatto('settimana')).toBe(false);
    expect(r.prossimo).toBe('settimana');
  });

  it('tutti fatti: visibile false', () => {
    const r = statoPrimiPassi({
      ...base,
      conti: [conto()],
      goals: [goal({ ruolo: 'imprevisti' })],
      percorso: percorso({ entrateTipo: 'fisse', settimanaFattaIl: '2026-11-18', speseCerteNessuna: true, obiettivoPiuAvanti: true }),
    });
    expect(r.fatti).toBe(r.totale);
    expect(r.prossimo).toBeNull();
    expect(r.visibile).toBe(false);
  });

  it('nascosti: visibile false anche con passi aperti', () => {
    const r = statoPrimiPassi({ ...base, percorso: percorso({ nascosti: true }) });
    expect(r.fatti).toBeLessThan(r.totale);
    expect(r.visibile).toBe(false);
  });

  it('un obiettivo imprevisti non conta come primo obiettivo', () => {
    const r = statoPrimiPassi({ ...base, goals: [goal({ ruolo: 'imprevisti' })] });
    const fatto = (id: string) => r.passi.find((p) => p.id === id)?.fatto;
    expect(fatto('imprevisti')).toBe(true);
    expect(fatto('obiettivo')).toBe(false);
  });
});

describe('settimanaFinita', () => {
  it('dal 2026-11-12 è finita il 2026-11-19, non il 2026-11-18', () => {
    const p = percorso({ settimanaDal: '2026-11-12' });
    expect(settimanaFinita(p, '2026-11-19')).toBe(true);
    expect(settimanaFinita(p, '2026-11-18')).toBe(false);
  });

  it('senza settimana avviata non è finita', () => {
    expect(settimanaFinita(null, '2026-11-19')).toBe(false);
    expect(settimanaFinita(percorso(), '2026-11-19')).toBe(false);
  });
});

describe('riepilogoSettimana: finestra di 7 giorni', () => {
  it('chi torna al giorno 15 vede solo i primi 7 giorni', () => {
    const t = (id: string, data: string, importo: number) =>
      ({ id, tipo: 'expense', importo, data, categoriaId: null, accountId: 'c', goalId: null, descrizione: '', nota: null, createdAt: '', stima: false }) as never;
    const r = riepilogoSettimana([t('a', '2026-11-01', 10), t('b', '2026-11-07', 5), t('c', '2026-11-08', 99), t('d', '2026-11-15', 1)], [], '2026-11-01', '2026-11-15');
    expect(r.numeroSpese).toBe(2);
    expect(r.totale).toBe(15);
  });
});

import { describe, it, expect } from 'vitest';
import {
  AVVISO_COSTI,
  NOTE_COSTI,
  anteprimaGraduale,
  calcolaCostiIngresso,
  canoneDaPiano,
  controllaDataIngresso,
  totaleCosti,
  type ChiaveCosto,
} from '@/lib/calculations/casa/costiIngresso';
import { PAROLE_VIETATE } from '../../helpers/paroleVietate';

const base = {
  canoneMensile: 750,
  mesiDeposito: 2,
  cedolareSecca: false,
  agenzia: false,
  numeroUtenze: 3,
  arredo: 0,
};

const TUTTE: ChiaveCosto[] = ['deposito', 'registro', 'bollo', 'agenzia', 'allacci', 'arredo'];

const voce = (voci: ReturnType<typeof calcolaCostiIngresso>, chiave: ChiaveCosto) =>
  voci.find((v) => v.chiave === chiave)!;

describe('calcolaCostiIngresso', () => {
  it('importi di partenza', () => {
    const voci = calcolaCostiIngresso(base);
    expect(voci.map((v) => v.chiave)).toEqual(TUTTE);
    expect(voce(voci, 'deposito').importo).toBe(1500);
    expect(voce(voci, 'registro').importo).toBe(90);
    expect(voce(voci, 'bollo').importo).toBe(32);
    expect(voce(voci, 'agenzia').importo).toBe(0);
    expect(voce(voci, 'allacci').importo).toBe(300);
    expect(voce(voci, 'arredo').importo).toBe(0);
    expect(totaleCosti(voci, TUTTE)).toBe(1922);
  });

  it('la cedolare secca azzera registro e bollo', () => {
    const voci = calcolaCostiIngresso({ ...base, cedolareSecca: true });
    expect(voce(voci, 'registro').importo).toBe(0);
    expect(voce(voci, 'bollo').importo).toBe(0);
    expect(totaleCosti(voci, TUTTE)).toBe(1800);
  });

  it('agenzia: una mensilità più IVA', () => {
    const voci = calcolaCostiIngresso({ ...base, agenzia: true });
    expect(voce(voci, 'agenzia').importo).toBe(915);
    expect(totaleCosti(voci, TUTTE)).toBe(2837);
  });

  it('mesi di deposito ristretti a 1..3', () => {
    expect(voce(calcolaCostiIngresso({ ...base, mesiDeposito: 5 }), 'deposito').importo).toBe(2250);
    expect(voce(calcolaCostiIngresso({ ...base, mesiDeposito: 0 }), 'deposito').importo).toBe(750);
  });

  it('mesi di deposito non finiti (NaN, Infinity) diventano 1', () => {
    expect(voce(calcolaCostiIngresso({ ...base, mesiDeposito: NaN }), 'deposito').importo).toBe(750);
    expect(voce(calcolaCostiIngresso({ ...base, mesiDeposito: Infinity }), 'deposito').importo).toBe(750);
  });

  it('registro: 2% del canone annuo, diviso a metà', () => {
    const registro = voce(calcolaCostiIngresso(base), 'registro');
    expect(registro.spiegazione.valore).toBe(90);
    expect(registro.spiegazione.formula).toContain('diviso a metà');
    expect(registro.spiegazione.ingredienti).toEqual([{ etichetta: "Quota dell'inquilino", valore: 90 }]);
    expect(registro.spiegazione.formula).toMatch(/9\.?000/);
  });

  it('registro: minimo 67 euro, quota inquilino 33,50 a canone 250', () => {
    const registro = voce(calcolaCostiIngresso({ ...base, canoneMensile: 250 }), 'registro');
    expect(registro.importo).toBe(33.5);
    expect(registro.spiegazione.valore).toBe(33.5);
    expect(registro.spiegazione.ingredienti).toEqual([{ etichetta: "Quota dell'inquilino", valore: 33.5 }]);
    const somma = registro.spiegazione.ingredienti.reduce((s, i) => s + i.valore, 0);
    expect(somma).toBe(registro.spiegazione.valore);
  });

  it('registro: canone 0 dà 0, senza minimo', () => {
    const registro = voce(calcolaCostiIngresso({ ...base, canoneMensile: 0 }), 'registro');
    expect(registro.importo).toBe(0);
    expect(registro.spiegazione.valore).toBe(0);
  });

  it('gli ingredienti di ogni voce sommano al valore', () => {
    const voci = calcolaCostiIngresso({ ...base, agenzia: true, arredo: 400 });
    for (const v of voci) {
      if (v.chiave === 'registro') continue;
      const somma = v.spiegazione.ingredienti.reduce((s, i) => s + i.valore, 0);
      expect(Math.round(somma * 100) / 100).toBe(v.spiegazione.valore);
    }
    expect(voce(voci, 'arredo').importo).toBe(400);
  });

  it('note e avviso', () => {
    const voci = calcolaCostiIngresso(base);
    expect(voce(voci, 'deposito').nota).toBe(
      'Per legge al massimo 3 mensilità. Ve lo restituiscono a fine contratto, con gli interessi.',
    );
    expect(voce(voci, 'registro').nota).toBe(
      'Di solito si divide a metà con il proprietario. Se sceglie la cedolare secca non si paga.',
    );
    expect(voce(voci, 'bollo').nota).toBe(
      "Marca da bollo sul contratto: spesso la paga l'inquilino, ma si può dividere con il proprietario. Non si paga con la cedolare secca.",
    );
    expect(voce(voci, 'allacci').nota).toBe(
      'Attivazione o subentro di luce, gas e acqua: circa 100 euro per utenza, è una stima.',
    );
    expect(voce(voci, 'agenzia').nota).toBe('');
    expect(voce(voci, 'arredo').nota).toBe('');
    expect(AVVISO_COSTI).toBe('Cifre indicative per orientarvi, non consulenza legale o fiscale.');
    const testi = [...Object.values(NOTE_COSTI), AVVISO_COSTI, ...voci.map((v) => v.nota), ...voci.map((v) => v.nome)];
    for (const testo of testi) {
      for (const parola of PAROLE_VIETATE) {
        expect(testo.toLowerCase()).not.toContain(parola);
      }
    }
  });

  it('valori negativi trattati come 0', () => {
    const voci = calcolaCostiIngresso({ ...base, canoneMensile: -100, arredo: -5, numeroUtenze: -2 });
    expect(voce(voci, 'arredo').importo).toBe(0);
    expect(voce(voci, 'allacci').importo).toBe(0);
    for (const v of voci) expect(v.importo).toBeGreaterThanOrEqual(0);
  });
});

describe('totaleCosti', () => {
  it('somma solo le voci selezionate', () => {
    const voci = calcolaCostiIngresso(base);
    expect(totaleCosti(voci, ['deposito', 'allacci'])).toBe(1800);
    expect(totaleCosti(voci, [])).toBe(0);
  });
});

describe('controllaDataIngresso', () => {
  it('data passata, oggi e futura', () => {
    expect(controllaDataIngresso('2026-11-08', '2026-11-09')).toBe('passata');
    expect(controllaDataIngresso('2026-11-09', '2026-11-09')).toBe('ok');
    expect(controllaDataIngresso('2027-03-15', '2026-11-09')).toBe('ok');
  });
});

describe('anteprimaGraduale', () => {
  it('divide l\'importo tra oggi e la scadenza', () => {
    expect(anteprimaGraduale({ importo: 1500, scadenza: '2027-03-15', oggi: '2026-11-09' })).toEqual({
      mesi: 4,
      quotaMensile: 375,
    });
  });

  it('importo negativo trattato come 0', () => {
    expect(anteprimaGraduale({ importo: -300, scadenza: '2027-03-15', oggi: '2026-11-09' })).toEqual({
      mesi: 4,
      quotaMensile: 0,
    });
  });

  it('stesso mese: un mese, quota piena', () => {
    expect(anteprimaGraduale({ importo: 1500, scadenza: '2026-11-30', oggi: '2026-11-09' })).toEqual({
      mesi: 1,
      quotaMensile: 1500,
    });
  });
});

describe('canoneDaPiano', () => {
  it('trova la voce Affitto per nome, senza distinguere maiuscole', () => {
    expect(canoneDaPiano([{ nome: 'Spesa', importoMensile: 300 }, { nome: ' affitto ', importoMensile: 750 }])).toBe(750);
  });

  it('trova la voce Affitto anche per nome della categoria', () => {
    expect(canoneDaPiano([{ nome: 'Casa', categoria: 'AFFITTO', importoMensile: 620 }])).toBe(620);
  });

  it('senza voce Affitto vale 0', () => {
    expect(canoneDaPiano([{ nome: 'Spesa', categoria: 'Cibo', importoMensile: 300 }])).toBe(0);
    expect(canoneDaPiano([])).toBe(0);
  });
});

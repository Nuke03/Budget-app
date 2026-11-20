import { describe, it, expect } from 'vitest';
import { LEZIONI, lezione } from '@/lib/percorso/lezioni';
import { PASSI_TESTI } from '@/lib/percorso/passiTesti';
import { SPESE_CERTE_PERSONALI } from '@/lib/percorso/speseCerte';
import { PAROLE_VIETATE } from '../helpers/paroleVietate';

const ORDINE = [
  'dove-vanno', 'piano', 'spese-certe', 'imprevisti', 'prima-da-parte',
  'impulso', 'bisogni-desideri', 'reddito-irregolare', 'debiti-rate', 'truffe',
  'coppia', 'assicurazioni', 'inflazione', 'risparmio-investimento', 'pensione',
];
const HOST_UFFICIALI = [
  'bancaditalia.it', 'economiapertutti.bancaditalia.it', 'consob.it', 'ivass.it',
  'inps.it', 'comitatoeducazionefinanziaria.gov.it', 'arbitrobancariofinanziario.it',
];

const PRODOTTI = /\b(azioni|azionari[oa]?|obbligazion\w*|etf)\b/i;

const testo = (l: (typeof LEZIONI)[number]) =>
  [l.titolo, l.inBreve, l.esempio, l.prova?.etichetta ?? ''].join(' ');

describe('lezioni', () => {
  it('ci sono 15 lezioni con numero 1..15 e id unici', () => {
    expect(LEZIONI).toHaveLength(15);
    expect(LEZIONI.map((l) => l.numero)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    expect(LEZIONI.map((l) => l.id)).toEqual(ORDINE);
    expect(new Set(LEZIONI.map((l) => l.id)).size).toBe(15);
    expect(lezione('truffe').numero).toBe(10);
  });

  it('ogni lezione sta sotto le 150 parole', () => {
    for (const l of LEZIONI) {
      const parole = testo(l).split(/\s+/).filter(Boolean).length;
      expect(parole, l.id).toBeLessThan(150);
    }
  });

  it('nessuna parola vietata', () => {
    for (const l of LEZIONI) {
      const t = (testo(l) + ' ' + l.link.map((x) => x.etichetta).join(' ')).toLowerCase();
      for (const p of PAROLE_VIETATE) expect(t.includes(p), `${l.id}: ${p}`).toBe(false);
    }
  });

  it('nessuna lezione dice dovresti o devi', () => {
    for (const l of LEZIONI) expect(testo(l), l.id).not.toMatch(/\b(dovresti|devi)\b/i);
  });

  it('i link sono al massimo 2 e solo su host ufficiali', () => {
    for (const l of LEZIONI) {
      expect(l.link.length, l.id).toBeLessThanOrEqual(2);
      for (const k of l.link) {
        const u = new URL(k.url);
        expect(u.protocol).toBe('https:');
        const ok = HOST_UFFICIALI.some((h) => u.hostname === h || u.hostname.endsWith('.' + h));
        expect(ok, `${l.id}: ${k.url}`).toBe(true);
      }
    }
  });

  it('le lezioni 14 e 15 non hanno prova e non nominano prodotti', () => {
    for (const n of [14, 15]) {
      const l = LEZIONI[n - 1];
      expect(l.prova).toBeNull();
      expect(testo(l)).not.toMatch(PRODOTTI);
      expect(testo(l)).not.toMatch(/fondo pensione [A-Z]/);
    }
  });

  it('il controllo dei prodotti non scambia informazioni per azioni', () => {
    expect(PRODOTTI.test('informazioni sulla pensione')).toBe(false);
    expect(PRODOTTI.test('comprare azioni')).toBe(true);
  });

  it('le lezioni 10 e 13 non hanno prova', () => {
    expect(LEZIONI[9].prova).toBeNull();
    expect(LEZIONI[12].prova).toBeNull();
  });

  it('le fasi seguono il triage', () => {
    const adesso = [1, 2, 3, 9, 10];
    const appena = [4, 5, 6, 8];
    for (const l of LEZIONI) {
      const atteso = adesso.includes(l.numero) ? 'adesso' : appena.includes(l.numero) ? 'appena-entrano' : 'dopo';
      expect(l.fase, l.id).toBe(atteso);
    }
  });

  it('la lezione 4 ha le tre domande e la 1 non colpevolizza gli spiccioli', () => {
    expect(lezione('imprevisti').inBreve).toMatch(/imprevedibile/);
    expect(lezione('imprevisti').inBreve).toMatch(/necessari/);
    expect(lezione('imprevisti').inBreve).toMatch(/altro modo/);
    expect(lezione('dove-vanno').inBreve).toMatch(/colpa/);
  });

  it('le prove puntano ai percorsi attesi', () => {
    expect(lezione('prima-da-parte').prova?.href).toBe('/impara/primi-passi/imprevisti');
    expect(lezione('reddito-irregolare').prova?.href).toBe('/impara/primi-passi/entrate');
    expect(lezione('spese-certe').prova?.href).toBe('/impara/primi-passi/spese-certe');
  });
});

describe('spese certe personali', () => {
  it('ha le sei voci di esempio con importi e frequenze', () => {
    expect(SPESE_CERTE_PERSONALI.map((s) => [s.importoPerCiclo, s.frequenzaMesi])).toEqual([
      [480, 12], [150, 12], [250, 12], [400, 24], [60, 12], [300, 12],
    ]);
    expect(new Set(SPESE_CERTE_PERSONALI.map((s) => s.chiave)).size).toBe(6);
  });
});

describe('correzioni di contenuto', () => {
  it('la lezione sulle rate non dà il TAEG al 10%', () => {
    const l = lezione('debiti-rate');
    expect(l.esempio).not.toContain('circa il 10%');
    expect(l.esempio).toContain('Il TAEG però è più alto del 10%');
  });

  it('la lezione sulla pensione manda a MyINPS con SPID', () => {
    const l = lezione('pensione');
    expect(l.inBreve).toContain('MyINPS con SPID');
    expect(l.inBreve).toContain('un patronato');
  });

  it('nessuna lezione né primo passo usa la parola obiettivo', () => {
    for (const l of LEZIONI) expect(testo(l)).not.toMatch(/obiettiv/i);
    expect(lezione('prima-da-parte').inBreve).toContain('Per i cassetti con scadenza');
    expect(JSON.stringify(Object.values(PASSI_TESTI))).not.toMatch(/obiettiv/i);
    expect(PASSI_TESTI.obiettivo.titolo).toBe('Un cassetto tuo');
  });
});

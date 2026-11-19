import { describe, it, expect } from 'vitest';
import { valutaAvvisoFondi } from '@/lib/calculations/percorso/avviso';

const RISERVATI = { obiettivi: 100, casa: 50, debiti: 0, tasse: 30 };
const base = { contaInDisponibile: true, riservati: RISERVATI, fondoImprevisti: null };

describe('valutaAvvisoFondi', () => {
  it('da 30 € a -20 €: buco 20, tocca obiettivi', () => {
    const r = valutaAvvisoFondi({ ...base, importo: 50, disponibileDopo: -20 });
    expect(r).toEqual({ buco: 20, toccati: ['obiettivi'], fondoImprevisti: null });
  });

  it('già sotto zero prima: nessun avviso', () => {
    expect(valutaAvvisoFondi({ ...base, importo: 10, disponibileDopo: -40 })).toBeNull();
  });

  it('conto fuori dal disponibile: nessun avviso', () => {
    expect(valutaAvvisoFondi({ ...base, contaInDisponibile: false, importo: 50, disponibileDopo: -20 })).toBeNull();
  });

  it('disponibile ancora a zero o più: nessun avviso', () => {
    expect(valutaAvvisoFondi({ ...base, importo: 50, disponibileDopo: 0 })).toBeNull();
  });

  it('buco più grande degli obiettivi: tocca obiettivi poi casa', () => {
    const r = valutaAvvisoFondi({ ...base, importo: 200, disponibileDopo: -120 });
    expect(r?.buco).toBe(120);
    expect(r?.toccati).toEqual(['obiettivi', 'casa']);
  });

  it('nessun obiettivo riservato: toccati solo tasse, fondoImprevisti null', () => {
    const r = valutaAvvisoFondi({
      ...base,
      riservati: { obiettivi: 0, casa: 0, debiti: 0, tasse: 40 },
      importo: 50,
      disponibileDopo: -20,
    });
    expect(r).toEqual({ buco: 20, toccati: ['tasse'], fondoImprevisti: null });
  });

  it('fondo imprevisti con accantonato 0: fondoImprevisti null', () => {
    const r = valutaAvvisoFondi({
      ...base,
      importo: 50,
      disponibileDopo: -20,
      fondoImprevisti: { goalId: 'g1', accantonato: 0 },
    });
    expect(r?.fondoImprevisti).toBeNull();
  });

  it('fondo imprevisti con accantonato > 0 e obiettivi toccati: lo restituisce', () => {
    const fondo = { goalId: 'g1', accantonato: 80 };
    const r = valutaAvvisoFondi({ ...base, importo: 50, disponibileDopo: -20, fondoImprevisti: fondo });
    expect(r?.fondoImprevisti).toEqual(fondo);
  });

  it('confine: prima esattamente a 0 (dopo = -importo) avvisa con buco pieno', () => {
    const r = valutaAvvisoFondi({ ...base, importo: 50, disponibileDopo: -50 });
    expect(r?.buco).toBe(50);
  });

  it('float: prima circa 0 per rumore (0.1 + 0.2 - 0.6, importo 0.3) avvisa con buco 0.3', () => {
    const r = valutaAvvisoFondi({ ...base, importo: 0.3, disponibileDopo: 0.1 + 0.2 - 0.6 });
    expect(r?.buco).toBe(0.3);
  });

  it('rumore: disponibileDopo = -1e-15 non avvisa', () => {
    expect(valutaAvvisoFondi({ ...base, importo: 50, disponibileDopo: -1e-15 })).toBeNull();
  });

  it('arrotonda a centesimi', () => {
    const r = valutaAvvisoFondi({ ...base, importo: 50, disponibileDopo: -20.004999 });
    expect(r?.buco).toBe(20);
    const r2 = valutaAvvisoFondi({ ...base, importo: 50, disponibileDopo: -20.126 });
    expect(r2?.buco).toBe(20.13);
  });
});

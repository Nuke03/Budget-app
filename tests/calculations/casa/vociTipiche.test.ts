import { describe, it, expect } from 'vitest';
import { VOCI_CASA_TIPICHE } from '@/lib/calculations/casa/vociTipiche';
import { mensilizza } from '@/lib/calculations/casa/mensilizza';

describe('VOCI_CASA_TIPICHE', () => {
  it('contiene le dieci voci della spec', () => {
    expect(VOCI_CASA_TIPICHE.map((v) => v.nome)).toEqual([
      'Affitto',
      'Condominio',
      'Luce',
      'Gas',
      'Acqua',
      'Internet',
      'TARI',
      'Assicurazione casa',
      'Spesa alimentare',
      'Manutenzione',
    ]);
    expect(VOCI_CASA_TIPICHE.map((v) => v.frequenzaMesi)).toEqual([1, 1, 2, 2, 3, 1, 12, 12, 1, 1]);
    expect(VOCI_CASA_TIPICHE.map((v) => v.stimaRicorrenza)).toEqual([
      null, 50, 110, 110, 60, 28, 300, 100, 300, 30,
    ]);
  });
  it('i mensili sono 50, 55, 55, 20, 28, 25, 8,33, 300, 30', () => {
    const mensili = VOCI_CASA_TIPICHE.slice(1).map((v) => mensilizza(v.stimaRicorrenza as number, v.frequenzaMesi));
    [50, 55, 55, 20, 28, 25, 8.33, 300, 30].forEach((atteso, i) => {
      expect(mensili[i]).toBeCloseTo(atteso, 2);
    });
  });
  it('le righe didattiche sono quelle della spec', () => {
    const righe = Object.fromEntries(VOCI_CASA_TIPICHE.map((v) => [v.chiave, v.rigaDidattica]));
    expect(VOCI_CASA_TIPICHE.map((v) => v.rigaDidattica)).toEqual([
      'Il canone del contratto.',
      "Di solito paga l'inquilino una parte; guardate il contratto.",
      'La bolletta arriva ogni due mesi: mettiamo da parte metà al mese.',
      'La bolletta arriva ogni due mesi: mettiamo da parte metà al mese.',
      'Spesso arriva a trimestri o a conguaglio.',
      '',
      'Il comune la chiede in 2 o 3 rate: qui la dividiamo per 12.',
      'Non è obbligatoria, ma copre incendio e danni a terzi.',
      'È la voce che più varia: la rivedrete dopo 3 mesi.',
      '',
    ]);
    expect(Object.keys(righe)).toHaveLength(10);
  });
});

import { describe, it, expect } from 'vitest';
import { iseeValido, vociDaMostrare, promemoriaAgevolazioni } from '@/lib/agevolazioni/regole';
import type { Situazione, StatoVoce } from '@/lib/agevolazioni/tipi';

const vuota: Situazione = { isee: null, dsuData: null, comune: null, inAffitto: null, studente: null, piva: false };
const ids = (r: ReturnType<typeof vociDaMostrare>) => r.daControllare.map((m) => m.voce.id);

describe('vociDaMostrare', () => {
  it('ISEE 7.200 con DSU 2026: bonus sociale primo, sotto la soglia', () => {
    const r = vociDaMostrare({ ...vuota, isee: 7200, dsuData: '2026-03-12' }, [], '2026-11-23');
    expect(r.daControllare[0].voce.id).toBe('bonus-sociale');
    expect(r.daControllare[0].frase).toContain('sotto la soglia del 2026');
    expect(r.daControllare[1].voce.id).toBe('dedicata-a-te');
  });
  it('ISEE 20.000: bonus presente con la soglia', () => {
    const r = vociDaMostrare({ ...vuota, isee: 20000, dsuData: '2026-03-12' }, [], '2026-11-23');
    const b = r.daControllare.find((m) => m.voce.id === 'bonus-sociale')!;
    expect(b.frase).toContain('Nel 2026 la soglia è 9.796 €');
  });
  it('DSU 2025 a gennaio 2027: ISEE non valido, voce ISEE scaduta', () => {
    const s = { ...vuota, isee: 7200, dsuData: '2025-03-12' };
    expect(iseeValido(s, '2027-01-10')).toBeNull();
    const r = vociDaMostrare(s, [], '2027-01-10');
    expect(r.daControllare.find((m) => m.voce.id === 'isee-dsu')!.frase).toContain('scaduto il 31 dicembre');
    expect(r.daControllare.find((m) => m.voce.id === 'bonus-sociale')!.frase).toContain('Nel 2026 la soglia');
  });
  it('iseeValido con DSU di quest’anno', () => {
    expect(iseeValido({ ...vuota, isee: 7200, dsuData: '2026-03-12' }, '2026-11-23')).toBe(7200);
    expect(iseeValido(vuota, '2026-11-23')).toBeNull();
  });
  it('dedicata-a-te assente dopo il 2027', () => {
    expect(ids(vociDaMostrare(vuota, [], '2027-12-31'))).toContain('dedicata-a-te');
    expect(ids(vociDaMostrare(vuota, [], '2028-01-01'))).not.toContain('dedicata-a-te');
  });
  it('contributo affitto solo con affitto', () => {
    expect(ids(vociDaMostrare(vuota, [], '2026-11-23'))).not.toContain('contributo-affitto');
    expect(ids(vociDaMostrare({ ...vuota, inAffitto: true }, [], '2026-11-23'))).toContain('contributo-affitto');
  });
  it('voci legate alla situazione', () => {
    const r = vociDaMostrare({ ...vuota, studente: true, piva: true }, [], '2026-11-23');
    expect(ids(r)).toEqual(expect.arrayContaining(['dottorato', 'trasporto', 'scadenze-piva']));
    expect(ids(vociDaMostrare(vuota, [], '2026-11-23'))).not.toContain('scadenze-piva');
  });
  it('daRicontrollare dopo 12 mesi', () => {
    const f = (oggi: string) => vociDaMostrare(vuota, [], oggi).daControllare[0].daRicontrollare;
    expect(f('2027-11-23')).toBe(false);
    expect(f('2027-11-24')).toBe(true);
  });
  it('fatto annuale torna da controllare l’anno dopo', () => {
    const st: StatoVoce[] = [{ voceId: 'isee-dsu', stato: 'fatto', il: '2026-03-01' }];
    expect(vociDaMostrare(vuota, st, '2026-11-23').chiuse.map((m) => m.voce.id)).toEqual(['isee-dsu']);
    const r = vociDaMostrare(vuota, st, '2027-02-01');
    expect(r.chiuse).toHaveLength(0);
    expect(ids(r)).toContain('isee-dsu');
  });
  it('non mi riguarda resta chiusa', () => {
    const st: StatoVoce[] = [{ voceId: 'isee-dsu', stato: 'non-mi-riguarda', il: '2026-03-01' }];
    expect(vociDaMostrare(vuota, st, '2027-02-01').chiuse).toHaveLength(1);
  });
  it('cercare con il comune', () => {
    const r = vociDaMostrare({ ...vuota, comune: 'Bologna' }, [], '2026-11-23');
    expect(r.daControllare.find((m) => m.voce.id === 'tari-comune')!.cercare).toBe('modulo agevolazioni TARI Bologna');
    const senza = vociDaMostrare(vuota, [], '2026-11-23');
    expect(senza.daControllare.find((m) => m.voce.id === 'tari-comune')!.cercare).toBe('modulo agevolazioni TARI');
  });
});

describe('promemoriaAgevolazioni', () => {
  it('DSU scaduta a gennaio', () => {
    const s = { ...vuota, isee: 7200, dsuData: '2025-03-12' };
    const p = promemoriaAgevolazioni(s, [], false, '2027-01-10');
    expect(p).toEqual({
      testo: "L'ISEE è scaduto il 31 dicembre: rifai la DSU.",
      href: '/agevolazioni#isee-dsu',
      voceId: 'isee-dsu',
    });
  });
  it('non il 1 gennaio, non con DSU dell’anno, non se fatto quest’anno', () => {
    const s = { ...vuota, isee: 7200, dsuData: '2025-03-12' };
    expect(promemoriaAgevolazioni(s, [], false, '2027-01-01')).toBeNull();
    expect(promemoriaAgevolazioni({ ...s, dsuData: '2027-01-05' }, [], false, '2027-01-10')).toBeNull();
    expect(
      promemoriaAgevolazioni(s, [{ voceId: 'isee-dsu', stato: 'fatto', il: '2027-01-08' }], false, '2027-01-10'),
    ).toBeNull();
  });
  it('senza dati solo se ha aperto la sezione e non ha escluso la voce', () => {
    expect(promemoriaAgevolazioni(null, [], false, '2027-01-10')).toBeNull();
    expect(promemoriaAgevolazioni(null, [], true, '2027-01-10')?.voceId).toBe('isee-dsu');
    expect(
      promemoriaAgevolazioni(null, [{ voceId: 'isee-dsu', stato: 'non-mi-riguarda', il: '2026-05-01' }], true, '2027-01-10'),
    ).toBeNull();
  });
  it('fatto dell’anno scorso non conta', () => {
    const s = { ...vuota, isee: 7200, dsuData: '2025-03-12' };
    expect(
      promemoriaAgevolazioni(s, [{ voceId: 'isee-dsu', stato: 'fatto', il: '2026-02-01' }], false, '2027-01-10'),
    ).not.toBeNull();
  });
  it('bando a febbraio per TARI e affitto', () => {
    const s = { ...vuota, comune: 'Bologna', inAffitto: true };
    const p = promemoriaAgevolazioni(s, [], false, '2027-02-10')!;
    expect(p.voceId).toBe('tari-comune');
    expect(p.testo).toBe('Controlla se il comune ha aperto il bando: Sconto TARI del comune.');
    expect(p.href).toBe('/agevolazioni#tari-comune');
    const p2 = promemoriaAgevolazioni(s, [{ voceId: 'tari-comune', stato: 'fatto', il: '2027-02-05' }], false, '2027-02-10')!;
    expect(p2.voceId).toBe('contributo-affitto');
    expect(promemoriaAgevolazioni({ ...vuota, inAffitto: true }, [], false, '2027-03-10')).toBeNull();
    expect(promemoriaAgevolazioni(vuota, [], false, '2027-02-10')).toBeNull();
  });
});

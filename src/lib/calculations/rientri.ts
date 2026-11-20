// Rientri: soldi presi dai risparmi o da un cassetto e rimessi un po' al mese.
// Calcolo puro, senza I/O. Le date sono 'yyyy-MM-dd' (giorno di Roma già deciso
// da chi chiama): i mesi si leggono dalle parti 'yyyy-MM', senza fusi.

export type MesiRientro = 2 | 3 | 4 | 6 | 12;
export const MESI_RIENTRO: MesiRientro[] = [2, 3, 4, 6, 12];
export type StatoRientro = 'aperto' | 'fermato' | 'chiuso'; // chiuso = "Lascia stare"

export interface Rientro {
  id: string;
  userId: string;
  householdId: string | null;
  goalId: string | null;
  accountId: string | null; // esattamente uno fra goalId e accountId
  importo: number;
  mesi: MesiRientro;
  creatoIl: string; // 'yyyy-MM-dd' Roma
  stato: StatoRientro;
  fermatoIl: string | null; // 'yyyy-MM-dd'
}

// null: conto eliminato dopo
export interface Spostamento {
  id: string;
  daAccountId: string | null;
  aAccountId: string | null;
  importo: number;
  data: string;
  createdAt: string;
}

function arrotonda2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function indiceMese(data: string): number {
  return Number(data.slice(0, 4)) * 12 + (Number(data.slice(5, 7)) - 1);
}

export function rataRientro(r: Pick<Rientro, 'importo' | 'mesi'>): number {
  return arrotonda2(r.importo / r.mesi);
}

export function maturatoRientro(r: Rientro, oggi: string): number {
  const riferimento = r.stato !== 'aperto' && r.fermatoIl ? r.fermatoIl : oggi;
  const k = indiceMese(riferimento) - indiceMese(r.creatoIl) + 1;
  if (k <= 0) return 0;
  if (k >= r.mesi) return r.importo;
  return Math.min(r.importo, arrotonda2(rataRientro(r) * k));
}

// 'yyyy-MM' dell'ultimo mese del rientro (il mese di creazione è il primo).
export function ultimoMeseRientro(r: Pick<Rientro, 'creatoIl' | 'mesi'>): string {
  const idx = indiceMese(r.creatoIl) + r.mesi - 1;
  const anno = Math.floor(idx / 12);
  const mese = (idx % 12) + 1;
  return `${anno}-${String(mese).padStart(2, '0')}`;
}

export function maturatoPerCassetto(rientri: Rientro[], goalId: string, oggi: string): number {
  let tot = 0;
  for (const r of rientri) {
    if (r.goalId !== goalId || r.stato === 'chiuso') continue;
    tot = arrotonda2(tot + maturatoRientro(r, oggi));
  }
  return tot;
}

export interface SituazioneRientroConto {
  rientro: Rientro;
  maturato: number;
  spostato: number;
  daSpostare: number;
  finito: boolean;
}

export function situazioneRientriConti(
  rientri: Rientro[],
  spostamenti: Spostamento[],
  contiChePesano: Set<string>,
  oggi: string
): SituazioneRientroConto[] {
  const conti = rientri
    .filter((r) => r.accountId !== null)
    .sort((a, b) => (a.creatoIl < b.creatoIl ? -1 : a.creatoIl > b.creatoIl ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const spostato = new Map<string, number>(conti.map((r) => [r.id, 0]));

  const ordinati = [...spostamenti].sort((a, b) =>
    a.data !== b.data ? (a.data < b.data ? -1 : 1) : a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0
  );

  for (const s of ordinati) {
    if (s.aAccountId === null || s.daAccountId === null || !contiChePesano.has(s.daAccountId)) continue;
    let resto = s.importo;
    for (const r of conti) {
      if (resto <= 0) break;
      if (r.stato === 'chiuso' || r.accountId !== s.aAccountId || r.creatoIl > s.data) continue;
      const capacita = arrotonda2(r.importo - (spostato.get(r.id) ?? 0));
      if (capacita <= 0) continue;
      const quota = Math.min(resto, capacita);
      spostato.set(r.id, arrotonda2((spostato.get(r.id) ?? 0) + quota));
      resto = arrotonda2(resto - quota);
    }
  }

  return conti.map((r) => {
    const maturato = maturatoRientro(r, oggi);
    const sp = spostato.get(r.id) ?? 0;
    return {
      rientro: r,
      maturato,
      spostato: sp,
      daSpostare: r.stato === 'chiuso' ? 0 : Math.max(0, arrotonda2(maturato - sp)),
      finito: sp >= r.importo,
    };
  });
}

export function totaleDaSpostare(s: SituazioneRientroConto[]): number {
  return s.reduce((tot, x) => arrotonda2(tot + x.daSpostare), 0);
}

// I rientri che contano davvero, dato che gli spostamenti si siano letti o no. Se gli spostamenti non si
// leggono (`null`) non si può dire quanto sia già stato spostato: i rientri verso i conti si ignorano
// (come se non ci fossero), quelli verso i cassetti restano (non hanno bisogno degli spostamenti).
export function rientriEffettivi(
  rientri: Rientro[],
  spostamenti: Spostamento[] | null,
  contiChePesano: Set<string>,
  oggi: string
): { rientri: Rientro[]; rientriConti: SituazioneRientroConto[]; riservaRientri: number } {
  if (spostamenti === null) {
    return { rientri: rientri.filter((r) => r.accountId === null), rientriConti: [], riservaRientri: 0 };
  }
  const rientriConti = situazioneRientriConti(rientri, spostamenti, contiChePesano, oggi);
  return { rientri, rientriConti, riservaRientri: totaleDaSpostare(rientriConti) };
}

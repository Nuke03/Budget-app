import type { RegolaQuota } from '@/lib/types';

export function calcolaTotale(
  sottotot: number,
  cuscinettoQuotaMensile: number,
  arrotondamento: number,
): number {
  // 1e-9: evita che un errore di virgola mobile faccia salire di un intero passo.
  return Math.ceil((sottotot + cuscinettoQuotaMensile) / arrotondamento - 1e-9) * arrotondamento;
}

export interface PersonaQuotaInput {
  slot: number;
  nome: string;
  redditoNetto: number | null;
  percentuale?: number | null;
}

export interface QuotaPersona {
  slot: number;
  nome: string;
  quota: number;
  resta: number | null;
  peso: number | null;
}

export type AvvisoQuota =
  | { tipo: 'quota_supera_reddito'; slot: number; nome: string }
  | { tipo: 'spese_oltre_redditi' }
  | { tipo: 'redditi_mancanti'; slot: number; nome: string }
  | { tipo: 'percentuali_non_100' };

export interface RisultatoQuota {
  totale: number;
  persone: QuotaPersona[];
  avvisi: AvvisoQuota[];
  regolaDisponibile: boolean;
}

const reddito = (p: PersonaQuotaInput): number => p.redditoNetto ?? 0;

function sommaRedditi(persone: PersonaQuotaInput[]): number {
  return persone.reduce((s, p) => s + reddito(p), 0);
}

// Redditi che impediscono la regola: mancanti, oppure tutti a zero per la proporzionale.
function redditiMancanti(persone: PersonaQuotaInput[], regola: RegolaQuota): PersonaQuotaInput[] {
  if (regola !== 'proporzionale' && regola !== 'pari_residuo') return [];
  // Un reddito negativo vale come mancante: nessuna regola deve produrre quote negative.
  const nulli = persone.filter((p) => p.redditoNetto === null || p.redditoNetto < 0);
  if (nulli.length > 0) return nulli;
  if (regola === 'proporzionale' && sommaRedditi(persone) <= 0) {
    return persone.filter((p) => reddito(p) <= 0);
  }
  return [];
}

function percentualiValide(persone: PersonaQuotaInput[]): boolean {
  if (persone.some((p) => p.percentuale === null || p.percentuale === undefined || !(p.percentuale >= 0))) {
    return false;
  }
  const somma = persone.reduce((s, p) => s + (p.percentuale ?? 0), 0);
  return Math.abs(somma - 100) <= 0.01;
}

// Quote reali (con decimali), prima dell'arrotondamento all'euro. Stesso ordine di `persone`.
export function quoteReali(
  persone: PersonaQuotaInput[],
  totale: number,
  regola: RegolaQuota,
): number[] {
  const n = persone.length;
  if (n === 0) return [];
  switch (regola) {
    case 'parti_uguali':
      return persone.map(() => totale / n);
    case 'proporzionale': {
      const s = sommaRedditi(persone);
      if (s <= 0) return persone.map(() => 0);
      return persone.map((p) => (totale * reddito(p)) / s);
    }
    case 'pari_residuo': {
      const dentro = new Set(persone.map((_, i) => i));
      const q = persone.map(() => 0);
      while (dentro.size > 0) {
        let s = 0;
        dentro.forEach((i) => (s += reddito(persone[i])));
        const r = (s - totale) / dentro.size;
        const negativi: number[] = [];
        dentro.forEach((i) => {
          q[i] = reddito(persone[i]) - r;
          if (q[i] < 0) negativi.push(i);
        });
        if (negativi.length === 0) break;
        for (const i of negativi) {
          q[i] = 0;
          dentro.delete(i);
        }
      }
      return q;
    }
    case 'personalizzata':
      // Le percentuali sono già validate da calcolaQuota (somma 100, nessuna null).
      return persone.map((p) => (totale * (p.percentuale ?? 0)) / 100);
  }
}

export function calcolaQuota(input: {
  persone: PersonaQuotaInput[];
  totale: number;
  regola: RegolaQuota;
}): RisultatoQuota {
  const { persone, totale, regola } = input;
  if (!Number.isInteger(totale)) {
    throw new Error('totale deve essere un numero intero di euro');
  }

  const mancanti = redditiMancanti(persone, regola);
  if (mancanti.length > 0) {
    return {
      totale,
      persone: persone.map((p) => ({ slot: p.slot, nome: p.nome, quota: 0, resta: null, peso: null })),
      avvisi: mancanti.map((p) => ({ tipo: 'redditi_mancanti', slot: p.slot, nome: p.nome })),
      regolaDisponibile: false,
    };
  }

  if (regola === 'personalizzata' && !percentualiValide(persone)) {
    return {
      totale,
      persone: persone.map((p) => ({ slot: p.slot, nome: p.nome, quota: 0, resta: null, peso: null })),
      avvisi: [{ tipo: 'percentuali_non_100' }],
      regolaDisponibile: false,
    };
  }

  const reali = quoteReali(persone, totale, regola);
  // 1e-9: tollera errori di virgola mobile prima del floor (es. 889.9999999999).
  const quote = reali.map((q) => Math.floor(q + 1e-9));
  const avanzo = totale - quote.reduce((s, q) => s + q, 0);

  if (avanzo !== 0 && persone.length > 0) {
    // Il resto va tutto a un solo membro: chiave maggiore, a parità lo slot minore.
    const chiave = (p: PersonaQuotaInput) =>
      regola === 'personalizzata' ? (p.percentuale ?? 0) : reddito(p);
    let scelto = 0;
    persone.forEach((p, i) => {
      const migliore = persone[scelto];
      if (chiave(p) > chiave(migliore) || (chiave(p) === chiave(migliore) && p.slot < migliore.slot)) {
        scelto = i;
      }
    });
    // Nel pari residuo con insieme vuoto (caso degenere) le quote restano a 0.
    if (!(regola === 'pari_residuo' && reali.every((q) => q === 0))) {
      quote[scelto] += avanzo;
    }
  }

  const out: QuotaPersona[] = persone.map((p, i) => ({
    slot: p.slot,
    nome: p.nome,
    quota: quote[i],
    resta: p.redditoNetto === null ? null : p.redditoNetto - quote[i],
    peso: p.redditoNetto !== null && p.redditoNetto > 0 ? quote[i] / p.redditoNetto : null,
  }));

  const avvisi: AvvisoQuota[] = [];
  for (const p of out) {
    const r = persone.find((x) => x.slot === p.slot)?.redditoNetto;
    if (r !== null && r !== undefined && p.quota > r) {
      avvisi.push({ tipo: 'quota_supera_reddito', slot: p.slot, nome: p.nome });
    }
  }
  if (persone.every((p) => p.redditoNetto !== null) && totale > sommaRedditi(persone)) {
    avvisi.push({ tipo: 'spese_oltre_redditi' });
  }

  return { totale, persone: out, avvisi, regolaDisponibile: true };
}

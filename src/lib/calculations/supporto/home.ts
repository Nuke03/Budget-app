import { computeReminders, statoPromemoria } from '../casa/promemoria';
import { riferimentoControllo } from '../casa/controlloSaldo';
import { nomeMese } from '@/lib/format';
import type { CasaPerHome } from '@/lib/loadHomeData';
import type { Transaction } from '@/lib/types';

export interface RigaLibretto {
  id: string;
  data: string;
  descrizione: string;
  importo: number;
  tipo: 'expense' | 'income';
  stima: boolean;
  // Speso cumulato del mese dopo questa riga (solo spese). Non è un saldo.
  nelMese: number;
}

export interface Prossimo {
  testo: string;
  href: string;
  tipo: 'in_pari' | 'casa';
}

const arrotonda = (n: number): number => Math.round(n * 100) / 100;

// Le righe più recenti (data poi createdAt, decrescente) con lo speso cumulato del loro mese.
// Il cumulato si calcola in ordine di tempo; le entrate ripetono il valore della riga prima.
export function righeLibretto(transazioni: Transaction[], oggi: string, quante = 4): RigaLibretto[] {
  void oggi;
  const cronologico = [...transazioni].sort(
    (a, b) => a.data.localeCompare(b.data) || a.createdAt.localeCompare(b.createdAt)
  );
  const nelMeseDi = new Map<string, number>();
  const cumulatoPerId = new Map<string, number>();
  for (const t of cronologico) {
    const mese = t.data.slice(0, 7);
    const attuale = (nelMeseDi.get(mese) ?? 0) + (t.tipo === 'expense' ? t.importo : 0);
    nelMeseDi.set(mese, attuale);
    cumulatoPerId.set(t.id, arrotonda(attuale));
  }
  return cronologico
    .reverse()
    .slice(0, quante)
    .map((t) => ({
      id: t.id,
      data: t.data,
      descrizione: t.descrizione,
      importo: t.importo,
      tipo: t.tipo as 'expense' | 'income',
      stima: t.stima,
      nelMese: cumulatoPerId.get(t.id) ?? 0,
    }));
}

// "9 novembre", con l'anno solo se non è quello di riferimento.
function giornoEMese(giorno: string, riferimento: string): string {
  const base = `${Number(giorno.slice(8, 10))} ${nomeMese(giorno)}`;
  return giorno.slice(0, 4) === riferimento.slice(0, 4) ? base : `${base} ${giorno.slice(0, 4)}`;
}

export function prossimaCosa(input: {
  inPari: { dal: string; al: string } | null;
  promemoriaCasa: { testo: string; href?: string }[];
}): Prossimo | null {
  if (input.inPari) {
    return {
      testo: `Rimettiti in pari: dal ${giornoEMese(input.inPari.dal, input.inPari.al)} non hai segnato spese`,
      href: '/in-pari',
      tipo: 'in_pari',
    };
  }
  const primo = input.promemoriaCasa[0];
  if (primo) return { testo: primo.testo, href: primo.href ?? '/casa', tipo: 'casa' };
  return null;
}

// I promemoria della casa di chi guarda (stessa logica che la Home mostrava già).
export function promemoriaDaCasa(casa: CasaPerHome | null, oggi: string) {
  const stato = casa?.stato ?? null;
  if (!stato) return [];
  return computeReminders(
    statoPromemoria({
      piano: stato.piano,
      righe: stato.righe,
      righeCasa: stato.righeCasa,
      oggi,
      nomi: Object.fromEntries(stato.membri.map((m) => [m.userId, m.displayName])),
      crediti: stato.crediti,
      debiti: stato.debiti,
      controllo: {
        ultimo: stato.controlli.ultimoControllo,
        riferimento: riferimentoControllo(stato.me.joinedAt, casa?.aggiunta?.conti ?? []),
        haConto: (casa?.aggiunta?.conti.length ?? 0) > 0,
      },
      ultimoCheckinMese: stato.controlli.ultimoCheckinMese,
    }),
    { userId: stato.me.userId },
    oggi
  );
}

import type { CasaData, CasaAggiunta } from '@/lib/loadCasaData';
import type { DisponibileCasa } from '@/lib/calculations/casa/disponibileCasa';
import type { DebitoMembro } from '@/lib/calculations/casa/debitiMembri';
import type { RigaMese } from '@/lib/calculations/casa/versamenti';
import { pianoInVigore } from '@/lib/calculations/casa/versamenti';
import { speseNonRegistrate } from '@/lib/calculations/casa/controlloSaldo';
import { statoVociDaParte } from '@/lib/calculations/casa/fondi';
import type { Account, Transaction } from '@/lib/types';

// I dati che servono ai dettagli della Casa: conto comune, versamenti, fondi per le bollette.
export interface FinanzeCasa {
  disponibile: DisponibileCasa;
  cuscinetto?: { attuale: number; obiettivo: number; quotaMensile: number } | null;
  conti: Account[];
  ultimeSpese: Transaction[];
  nomi: Record<string, string>;
  aggiunta: CasaAggiunta;
  contiPersonali?: Account[];
  righe?: Record<string, RigaMese[]>;
  debiti?: DebitoMembro[];
  crediti?: Record<string, number>;
  // I fondi aperti per le bollette e quante voci del piano non sono ancora messe da parte.
  fondiBollette?: { id: string; nome: string; accantonato: number; importoTarget: number }[];
  bolletteDaMettere?: number;
  // L'ultimo controllo del saldo e le spese che il controllo ha segnato questo mese.
  ultimoControllo?: string | null;
  // Il mese dell'ultimo check-in fatto.
  ultimoCheckinMese?: string | null;
  speseNonRegistrate?: number;
}

export function finanzeCasa(dati: CasaData, contiPersonali: Account[], meseCorrente: string): FinanzeCasa {
  const pianoOra = pianoInVigore(dati.piani, meseCorrente);
  return {
    disponibile: dati.disponibile,
    cuscinetto: dati.cuscinetto,
    conti: dati.aggiunta.conti,
    ultimeSpese: dati.transazioni.filter((t) => t.tipo === 'expense').slice(0, 5),
    nomi: Object.fromEntries(dati.aggiunta.nomi.map((n) => [n.userId, n.nome])),
    aggiunta: dati.aggiunta,
    contiPersonali,
    righe: dati.righe,
    debiti: dati.debiti,
    crediti: dati.crediti,
    fondiBollette: dati.obiettiviConAccantonato
      .filter((g) => g.ricorrente)
      .map((g) => ({ id: g.id, nome: g.nome, accantonato: g.accantonato, importoTarget: g.importoTarget })),
    ultimoControllo: dati.controlli.ultimoControllo,
    ultimoCheckinMese: dati.controlli.ultimoCheckinMese,
    speseNonRegistrate: speseNonRegistrate(dati.transazioni, meseCorrente),
    bolletteDaMettere: pianoOra
      ? statoVociDaParte(pianoOra.items, dati.obiettiviConAccantonato).filter((v) => v.stato === 'da_mettere').length
      : 0,
  };
}

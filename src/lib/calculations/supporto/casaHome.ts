import type { CasaData } from '@/lib/loadCasaData';
import { formatNumero } from '@/lib/format';
import { riferimentoControllo } from '../casa/controlloSaldo';
import { statoVociDaParte } from '../casa/fondi';
import { computeReminders, statoPromemoria, type AzionePromemoria } from '../casa/promemoria';
import { pianoDelMese, pianoInVigore } from '../casa/versamenti';
import { chiGestisce } from './gestore';

export type DaFareCasa =
  | { tipo: 'promemoria'; testo: string; href: string; azione?: AzionePromemoria }
  | { tipo: 'da_parte'; testo: string; importo: number; voci: { nome: string; importo: number }[] }
  | { tipo: 'quota'; testo: string; href: '/casa/quota' };

export type StatoPari =
  | { tipo: 'pari' }
  | { tipo: 'devi'; importo: number; a: string; aUserId: string }
  | { tipo: 'ti_deve'; importo: number; da: string; daUserId: string };

export interface CasaHomeDati {
  gestisce: boolean;
  disponibile: number;
  // Spese di casa del mese corrente e voci mensili del piano in vigore (null senza piano).
  spesoMese: number;
  previstoMese: number | null;
  daFare: DaFareCasa | null;
  ultime: { id: string; data: string; descrizione: string; importo: number; colore: string | null; chi: string }[];
  vistaSemplice: { quota: number | null; entroGiorno: number | null; versato: number; stato: StatoPari; creditoVersoCasa: number };
}

const arrotonda = (n: number): number => Math.round(n * 100) / 100;
const SOGLIA_PARI = 0.01;

function elenco(nomi: string[]): string {
  return nomi.length <= 1 ? (nomi[0] ?? '') : `${nomi.slice(0, -1).join(', ')} e ${nomi[nomi.length - 1]}`;
}

// Lo stato fra me e l'altro membro, solo dai debiti fra membri (suo verso di me meno mio verso di lui).
// I crediti verso la casa sono dovuti dalla casa, non dall'altro: restano fuori (vedi creditoVersoCasa).
// Con più di due membri si sceglie l'altro con il netto più grande in valore assoluto; senza altri, pari.
function statoCoppia(dati: CasaData, me: string, nomi: Record<string, string>): StatoPari {
  const altri = dati.casa.members.filter((m) => m.attivo && m.userId !== me).map((m) => m.userId);
  let scelto: { id: string; netto: number } | null = null;
  for (const id of altri) {
    const daLui = dati.debiti.filter((d) => d.debitoreId === id && d.creditoreId === me).reduce((s, d) => s + d.importo, 0);
    const aLui = dati.debiti.filter((d) => d.debitoreId === me && d.creditoreId === id).reduce((s, d) => s + d.importo, 0);
    const netto = arrotonda(daLui - aLui);
    if (scelto === null || Math.abs(netto) > Math.abs(scelto.netto)) scelto = { id, netto };
  }
  if (!scelto || Math.abs(scelto.netto) < SOGLIA_PARI) return { tipo: 'pari' };
  const nome = nomi[scelto.id] ?? 'Un altro membro';
  return scelto.netto > 0
    ? { tipo: 'ti_deve', importo: scelto.netto, da: nome, daUserId: scelto.id }
    : { tipo: 'devi', importo: -scelto.netto, a: nome, aUserId: scelto.id };
}

export function casaHomeDati(dati: CasaData, meUserId: string, oggi: string): CasaHomeDati {
  const mese = `${oggi.slice(0, 7)}-01`;
  const nomi = Object.fromEntries(dati.aggiunta.nomi.map((n) => [n.userId, n.nome]));
  const pianoOra = pianoInVigore(dati.piani, mese);
  const righeMie = dati.righe[meUserId] ?? [];

  const promemoria = computeReminders(
    statoPromemoria({
      piano: pianoDelMese(dati.piani, mese),
      righe: righeMie,
      righeCasa: Object.values(dati.righe).flat(),
      oggi,
      nomi,
      crediti: dati.crediti,
      debiti: dati.debiti,
      controllo: {
        ultimo: dati.controlli.ultimoControllo,
        riferimento: riferimentoControllo(dati.casa.me.joinedAt, dati.aggiunta.conti),
        haConto: dati.aggiunta.conti.length > 0,
      },
      ultimoCheckinMese: dati.controlli.ultimoCheckinMese,
    }),
    { userId: meUserId },
    oggi,
  );

  const daMettere = pianoOra
    ? statoVociDaParte(pianoOra.items, dati.obiettiviConAccantonato).filter((v) => v.stato === 'da_mettere')
    : [];

  let daFare: DaFareCasa | null = null;
  if (promemoria[0]) {
    const az = promemoria[0].azione;
    daFare = {
      tipo: 'promemoria',
      testo: promemoria[0].testo,
      href: az?.href ?? '/casa',
      ...(az && !az.href ? { azione: az } : {}),
    };
  } else if (daMettere.length > 0) {
    const voci = daMettere.map((v) => ({ nome: v.item.nome, importo: v.item.importoMensile }));
    const importo = arrotonda(voci.reduce((s, v) => s + v.importo, 0));
    daFare = {
      tipo: 'da_parte',
      testo: `Metti da parte ${formatNumero(importo)} € per ${elenco(voci.map((v) => v.nome))}`,
      importo,
      voci,
    };
  } else if (!pianoOra) {
    daFare = { tipo: 'quota', testo: 'Calcolate la quota: servono 3 minuti.', href: '/casa/quota' };
  }

  const spese = dati.transazioni.filter((t) => t.tipo === 'expense');
  const spesoMese = arrotonda(spese.filter((t) => t.data.slice(0, 7) === mese.slice(0, 7)).reduce((s, t) => s + t.importo, 0));
  const previstoMese = pianoOra ? arrotonda(pianoOra.items.reduce((s, i) => s + i.importoMensile, 0)) : null;

  const coloreDi = new Map(dati.aggiunta.categorie.map((c) => [c.id, c.colore]));
  const ultime = [...spese]
    .sort((a, b) => b.data.localeCompare(a.data) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3)
    .map((t) => ({
      id: t.id,
      data: t.data,
      descrizione: t.descrizione,
      importo: t.importo,
      colore: t.categoriaId ? (coloreDi.get(t.categoriaId) ?? null) : null,
      // Anticipo in contanti: pagataDaUserId sono io e non c'è conto, quindi "tu".
      chi: t.pagataDaUserId === meUserId ? 'tu' : t.pagataDaUserId ? (nomi[t.pagataDaUserId] ?? 'un altro membro') : 'conto comune',
    }));

  const rigaMese = righeMie.find((r) => r.mese === mese) ?? null;

  return {
    gestisce: chiGestisce(dati.casa.household, dati.casa.members) === meUserId,
    disponibile: dati.disponibile.valore,
    spesoMese,
    previstoMese,
    daFare,
    ultime,
    vistaSemplice: {
      quota: rigaMese ? rigaMese.atteso : null,
      entroGiorno: pianoOra?.plan.giornoVersamento ?? null,
      versato: rigaMese ? rigaMese.versato : 0,
      stato: statoCoppia(dati, meUserId, nomi),
      creditoVersoCasa: arrotonda(dati.crediti[meUserId] ?? 0),
    },
  };
}

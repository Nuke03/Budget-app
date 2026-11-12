import type { CasaData } from '@/lib/loadCasaData';
import { formatNumero } from '@/lib/format';
import { riferimentoControllo } from '../casa/controlloSaldo';
import { speseMensiliDelMese } from '../casa/checkin';
import { anteprimaDaParte, statoVociDaParte, ultimaScadenza } from '../casa/fondi';
import { computeReminders, statoPromemoria, type AzionePromemoria } from '../casa/promemoria';
import { pianoDelMese, pianoInVigore } from '../casa/versamenti';
import { chiGestisce } from './gestore';

export type DaFareCasa =
  | { tipo: 'promemoria'; id: string; testo: string; href: string; azione?: AzionePromemoria }
  | { tipo: 'da_parte'; testo: string; importo: number; voci: { nome: string; importo: number }[] }
  | { tipo: 'quota'; testo: string; href: '/casa/quota' };

export type StatoPari =
  | { tipo: 'pari' }
  | { tipo: 'devi'; importo: number; a: string; aUserId: string }
  | { tipo: 'ti_deve'; importo: number; da: string; daUserId: string };

export interface CasaHomeDati {
  gestisce: boolean;
  disponibile: number;
  // Spese e voci mensili del mese corrente, calcolate come nel check-in (null il previsto senza piano).
  spesoMese: number;
  previstoMese: number | null;
  // I candidati della card Da fare, in ordine: chi guarda sceglie il primo non rimandato.
  daFare: DaFareCasa[];
  ultime: { id: string; data: string; descrizione: string; importo: number; colore: string | null; chi: string }[];
  vistaSemplice: {
    quota: number | null;
    // Il mese (YYYY-MM-01) da cui parte la quota, quando il piano o la tua quota non sono ancora partiti.
    quotaDal?: string | null;
    entroGiorno: number | null;
    versato: number;
    stato: StatoPari;
    creditoVersoCasa: number;
    // Il primo promemoria, se si risolve con un versamento o un rimborso: si fa anche da qui.
    azione?: Extract<DaFareCasa, { tipo: 'promemoria' }> | null;
  };
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

  const daFare: DaFareCasa[] = promemoria.map((p) => ({
    tipo: 'promemoria',
    id: p.id,
    testo: p.testo,
    href: p.azione?.href ?? '/casa',
    ...(p.azione && !p.azione.href ? { azione: p.azione } : {}),
  }));
  if (daMettere.length > 0) {
    // Stessa cifra di Da parte: la quota mensile dalla prima scadenza proposta.
    const voci = daMettere.map((v) => ({
      nome: v.item.nome,
      importo: anteprimaDaParte({
        importoRicorrenza: v.item.importoRicorrenza,
        frequenzaMesi: v.item.frequenzaMesi,
        scadenza: ultimaScadenza(v.item, oggi),
        oggi,
      }).quotaMensile,
    }));
    const importo = arrotonda(voci.reduce((s, v) => s + v.importo, 0));
    daFare.push({
      tipo: 'da_parte',
      testo: `Metti da parte ${formatNumero(importo)} € per ${elenco(voci.map((v) => v.nome))}`,
      importo,
      voci,
    });
  } else if (!pianoOra) {
    daFare.push({ tipo: 'quota', testo: 'Calcolate la quota: servono 3 minuti.', href: '/casa/quota' });
  }

  const spese = dati.transazioni.filter((t) => t.tipo === 'expense');
  // Come nel check-in: solo le voci mensili del piano, senza i fondi delle bollette e delle una tantum.
  const mensili = speseMensiliDelMese(pianoOra, dati.transazioni, mese);
  const spesoMese = mensili.spesoMensili;
  const previstoMese = pianoOra ? mensili.previstoMensili : null;

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
      chi: t.pagataDaUserId === meUserId ? 'tu' : t.pagataDaUserId ? (nomi[t.pagataDaUserId] ?? 'un altro membro') : 'casa',
    }));

  const rigaMese = righeMie.find((r) => r.mese === mese) ?? null;
  const pianoFuturo = dati.piani.find((p) => p.plan.validoDal > mese);
  const primo = promemoria[0]?.azione;
  const azione = daFare[0]?.tipo === 'promemoria' && daFare[0].azione && (primo?.tipo === 'versamento' || primo?.tipo === 'rimborso') ? daFare[0] : null;

  return {
    gestisce: chiGestisce(dati.casa.household, dati.casa.members) === meUserId,
    disponibile: dati.disponibile.valore,
    spesoMese,
    previstoMese,
    daFare,
    ultime,
    vistaSemplice: {
      quota: rigaMese ? rigaMese.atteso : null,
      quotaDal: !rigaMese && pianoFuturo ? `${pianoFuturo.plan.validoDal.slice(0, 7)}-01` : null,
      entroGiorno: pianoOra?.plan.giornoVersamento ?? null,
      versato: rigaMese ? rigaMese.versato : 0,
      stato: statoCoppia(dati, meUserId, nomi),
      creditoVersoCasa: arrotonda(dati.crediti[meUserId] ?? 0),
      azione,
    },
  };
}

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { savePlan, type PlanBundle, type PlanVersionInput, type PlanVoceInput } from '@/lib/data/householdPlans';
import type { HouseholdMember, RegolaQuota } from '@/lib/types';
import { parseImporto } from '@/lib/calculations/casa/parseImporto';
import { totaleVociMensili } from '@/lib/calculations/casa/mensilizza';
import { cuscinettoDefault, mesiAlPieno } from '@/lib/calculations/casa/cuscinetto';
import { calcolaQuota, calcolaTotale, type PersonaQuotaInput, type RisultatoQuota } from '@/lib/calculations/casa/quota';
import {
  buildPlanVersions,
  dateVersioni,
  type PeriodoIniziale,
  type PianoDraft,
} from '@/lib/calculations/casa/pianoVersioni';
import { descriviStatoPiano } from '@/lib/calculations/casa/fraseVersamento';
import {
  ARROTONDAMENTO,
  REGOLE,
  arrotonda2,
  messaggioErrore,
  parseMesi,
  personeIniziali,
  testoNumero,
  vociIniziali,
  type PersonaState,
  type RegolaScelta,
  type VoceState,
} from './quotaWizardState';

export interface QuotaWizardProps {
  householdId: string;
  meUserId: string;
  meseCorrente: string;
  membri: HouseholdMember[];
  // Le versioni del piano dal mese corrente in poi, dalla più vecchia alla più recente.
  piani: PlanBundle[];
  // La posizione più alta mai usata nella casa, anche da chi se n'è andato.
  slotMassimo: number;
  onSaved: () => void;
}

export function useBozzaQuota(props: QuotaWizardProps) {
  const { householdId, meUserId, meseCorrente, membri, piani, slotMassimo, onSaved } = props;
  // Regola, cuscinetto e voci ripartono dalla versione più recente: è il regime dopo ogni passaggio.
  const pianoAttuale = piani[piani.length - 1] ?? null;
  const [passo, setPasso] = useState(1);
  const [persone, setPersone] = useState<PersonaState[]>(() =>
    personeIniziali(membri, piani, meUserId, meseCorrente),
  );
  const [voci, setVoci] = useState<VoceState[]>(() => vociIniziali(pianoAttuale ?? undefined));
  const [infoAperta, setInfoAperta] = useState<number | null>(null);
  const [mesiCuscinetto, setMesiCuscinetto] = useState<1 | 2>(() => {
    if (!pianoAttuale) return 1;
    const sottotot = totaleVociMensili(pianoAttuale.items);
    return Math.abs(pianoAttuale.plan.cuscinettoObiettivo - 2 * sottotot) < 0.5 ? 2 : 1;
  });
  const [cuscinettoText, setCuscinettoText] = useState<string | null>(() =>
    pianoAttuale ? testoNumero(pianoAttuale.plan.cuscinettoQuotaMensile) : null,
  );
  const [regola, setRegola] = useState<RegolaScelta>(() => {
    const r = pianoAttuale?.plan.regola;
    return r === 'parti_uguali' || r === 'pari_residuo' || r === 'proporzionale' ? r : 'proporzionale';
  });
  // Se il piano era diviso con percentuali scelte, quelle restano la proposta per il periodo iniziale.
  const eraPersonalizzata = pianoAttuale?.plan.regola === 'personalizzata';
  const [periodoTipo, setPeriodoTipo] = useState<PeriodoIniziale['tipo']>(
    eraPersonalizzata ? 'percentuali' : 'tutto_a_chi_abita',
  );
  const [percText, setPercText] = useState<Record<number, string>>(() =>
    pianoAttuale && eraPersonalizzata
      ? Object.fromEntries(
          pianoAttuale.shares
            .filter((s) => s.percentuale !== null)
            .map((s) => [s.slot, testoNumero(s.percentuale as number)]),
        )
      : {},
  );
  const [giorno, setGiorno] = useState<number>(pianoAttuale?.plan.giornoVersamento ?? 5);
  const [partenza, setPartenza] = useState(meseCorrente);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  // ----- Valori derivati: tutto parte da testi già letti con parseImporto, mai NaN -----
  const nomePersona = (p: PersonaState) => p.displayName.trim() || 'Nuova persona';
  const redditiOk =
    persone.length > 0 &&
    persone.every((p) => parseImporto(p.redditoText) !== null && (p.userId !== null || p.displayName.trim() !== ''));
  const vociOk =
    voci.length > 0 &&
    voci.every(
      (v) => v.nome.trim() !== '' && parseImporto(v.importoText) !== null && parseMesi(v.frequenzaText) !== null,
    );

  const vociPiano: PlanVoceInput[] = voci.map((v, i) => ({
    nome: v.nome.trim(),
    categoriaNome: v.custom ? v.nome.trim() : v.categoriaNome,
    categoriaId: v.categoriaId,
    frequenzaMesi: parseMesi(v.frequenzaText) ?? 1,
    importoRicorrenza: parseImporto(v.importoText) ?? 0,
    origineStima: v.origine,
    goalId: v.goalId,
    stimaIgnorataConN: v.stimaIgnorataConN,
    ordine: i,
  }));
  const sottotot = totaleVociMensili(vociPiano);

  const cuscinettoPredefinito = cuscinettoDefault(sottotot, mesiCuscinetto);
  const cuscinettoTestoEffettivo = cuscinettoText ?? String(cuscinettoPredefinito.quotaMensile);
  const cuscinettoQuota = parseImporto(cuscinettoTestoEffettivo);
  const cuscinettoObiettivo = arrotonda2(cuscinettoPredefinito.obiettivo);
  const piene = cuscinettoQuota === null ? null : mesiAlPieno(cuscinettoObiettivo, cuscinettoQuota);
  const totale = calcolaTotale(sottotot, cuscinettoQuota ?? 0, ARROTONDAMENTO);

  const personeQuota: PersonaQuotaInput[] = persone.map((p) => ({
    slot: p.slot,
    nome: nomePersona(p),
    redditoNetto: parseImporto(p.redditoText),
    percentuale: null,
  }));
  const colonne: { regola: (typeof REGOLE)[number]; risultato: RisultatoQuota }[] = REGOLE.map((r) => ({
    regola: r,
    risultato: calcolaQuota({ persone: personeQuota, totale, regola: r.chiave }),
  }));
  const colonnaScelta = colonne.find((c) => c.regola.chiave === regola) ?? colonne[0];

  const draftPersone = persone.map((p) => ({
    slot: p.slot,
    displayName: nomePersona(p),
    userId: p.userId,
    redditoNetto: parseImporto(p.redditoText),
    redditoIrregolare: p.irregolare,
    inCasaDal: p.inCasaDal,
  }));
  const piuPeriodi = dateVersioni(draftPersone, partenza).length > 1;

  const percentuali: Record<number, number> = {};
  let percentualiLette = true;
  for (const p of persone) {
    const n = parseImporto(percText[p.slot] ?? '');
    if (n === null) percentualiLette = false;
    else percentuali[p.slot] = n;
  }
  const sommaPercentuali = Object.values(percentuali).reduce((s, n) => s + n, 0);
  const percentualiValide = percentualiLette && Math.abs(sommaPercentuali - 100) <= 0.01;
  const periodoValido = !(piuPeriodi && periodoTipo === 'percentuali') || percentualiValide;

  const draft: PianoDraft | null =
    redditiOk && vociOk && cuscinettoQuota !== null
      ? {
          persone: draftPersone,
          voci: vociPiano,
          cuscinettoObiettivo,
          cuscinettoQuotaMensile: cuscinettoQuota,
          arrotondamento: ARROTONDAMENTO,
          regola: regola as RegolaQuota,
          periodoIniziale:
            periodoTipo === 'percentuali' ? { tipo: 'percentuali', percentuali } : { tipo: periodoTipo },
          giornoVersamento: giorno,
          partenza,
        }
      : null;

  let versioni: PlanVersionInput[] | null = null;
  if (draft && periodoValido) {
    try {
      versioni = buildPlanVersions(draft);
    } catch {
      versioni = null;
    }
  }

  // Bozza: chi ha una quota ma non è ancora entrato.
  const statoBozza = descriviStatoPiano(
    (versioni ?? []).flatMap((v) =>
      v.quote.map((q) => ({
        displayName: q.displayName,
        quotaMensile: q.quotaMensile,
        userId: persone.find((p) => p.slot === q.slot)?.userId ?? null,
        esceDal: null,
      })),
    ),
  );

  const puoProseguire =
    (passo === 1 && redditiOk) ||
    (passo === 2 && vociOk) ||
    (passo === 3 && cuscinettoQuota !== null) ||
    (passo === 4 && versioni !== null && periodoValido);

  // ----- Modifiche allo stato -----
  const setPersona = (slot: number, patch: Partial<PersonaState>) =>
    setPersone((ps) => ps.map((p) => (p.slot === slot ? { ...p, ...patch } : p)));
  const setVoce = (key: number, patch: Partial<VoceState>) =>
    setVoci((vs) => vs.map((v) => (v.key === key ? { ...v, ...patch } : v)));

  function aggiungiPersona() {
    const massimo = Math.max(
      0,
      slotMassimo,
      ...persone.map((p) => p.slot),
      ...membri.map((m) => m.slot),
      ...piani.flatMap((p) => p.shares.map((s) => s.slot)),
    );
    setPersone((ps) => [
      ...ps,
      {
        slot: massimo + 1,
        displayName: '',
        userId: null,
        redditoText: '',
        irregolare: false,
        inCasaDal: meseCorrente,
        soloLettura: false,
      },
    ]);
  }

  async function conferma() {
    if (!versioni) return;
    setInCorso(true);
    setErrore(null);
    try {
      await savePlan(createClient(), householdId, versioni);
      onSaved();
    } catch (e) {
      setErrore(messaggioErrore(e));
    } finally {
      setInCorso(false);
    }
  }

  const irregolareAttivo = persone.some((p) => p.irregolare);

  return {
    meUserId, meseCorrente, passo, setPasso, persone, setPersone, voci, setVoci, infoAperta, setInfoAperta,
    mesiCuscinetto, setMesiCuscinetto, setCuscinettoText, regola, setRegola, eraPersonalizzata,
    periodoTipo, setPeriodoTipo, percText, setPercText, giorno, setGiorno, partenza, setPartenza,
    inCorso, errore, nomePersona, sottotot, cuscinettoTestoEffettivo, cuscinettoObiettivo, piene, totale,
    colonne, colonnaScelta, piuPeriodi, percentualiValide, versioni, statoBozza, puoProseguire,
    setPersona, setVoce, aggiungiPersona, conferma, irregolareAttivo,
  };
}

export type BozzaQuota = ReturnType<typeof useBozzaQuota>;

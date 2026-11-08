'use client';

import { useState } from 'react';
import { addMonths, format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { createClient } from '@/lib/supabase/client';
import { savePlan, type PlanBundle, type PlanVersionInput, type PlanVoceInput } from '@/lib/data/householdPlans';
import type { HouseholdMember, OrigineStima, PlanShare, RegolaQuota } from '@/lib/types';
import { formatNumero } from '@/lib/format';
import { parseImporto } from '@/lib/calculations/casa/parseImporto';
import { totaleVociMensili } from '@/lib/calculations/casa/mensilizza';
import { VOCI_CASA_TIPICHE } from '@/lib/calculations/casa/vociTipiche';
import { cuscinettoDefault, mesiAlPieno } from '@/lib/calculations/casa/cuscinetto';
import {
  calcolaQuota,
  calcolaTotale,
  type AvvisoQuota,
  type PersonaQuotaInput,
  type RisultatoQuota,
} from '@/lib/calculations/casa/quota';
import {
  buildPlanVersions,
  dateVersioni,
  type PeriodoIniziale,
  type PianoDraft,
} from '@/lib/calculations/casa/pianoVersioni';
import { descriviStatoPiano, fraseVersamento } from '@/lib/calculations/casa/fraseVersamento';

const ERRORE_GENERICO = 'Salvataggio fallito, controlla la connessione e riprova.';
const ERRORE_REDDITO_ALTRUI =
  "Il reddito di un'altra persona lo cambia solo lei. Ricarica la pagina per vedere i valori aggiornati.";
const ERRORE_MESE_PASSATO = 'Il mese di partenza è passato: ricarica la pagina e riprova.';

function messaggioErrore(e: unknown): string {
  const testo = typeof e === 'object' && e !== null && 'message' in e ? String((e as { message: unknown }).message) : '';
  if (testo.includes('il reddito di un altro membro non si modifica')) return ERRORE_REDDITO_ALTRUI;
  if (testo.includes('valido_dal nel passato')) return ERRORE_MESE_PASSATO;
  return ERRORE_GENERICO;
}
const ARROTONDAMENTO = 10;
const PASSI = ['Quanto entra ogni mese', 'Le spese di casa', 'Il cuscinetto', 'Come dividere', 'Quando e da quando'];

const inputClass =
  'rounded-[var(--radius-md)] border border-black/5 bg-surface-muted px-4 py-3 text-base outline-none focus-visible:border-brand read-only:opacity-60';
const carta = 'flex flex-col gap-3 rounded-[var(--radius-lg)] bg-surface p-5 shadow-[var(--shadow-card)]';
const bottoneSecondario = 'rounded-[var(--radius-md)] border border-black/10 px-4 py-2.5 text-sm font-semibold';
const bottonePrimario =
  'rounded-[var(--radius-md)] bg-brand px-4 py-3 text-sm font-semibold text-brand-foreground disabled:opacity-40';

type RegolaScelta = 'parti_uguali' | 'proporzionale' | 'pari_residuo';

const REGOLE: { chiave: RegolaScelta; titolo: string; frase: string }[] = [
  { chiave: 'parti_uguali', titolo: 'Parti uguali', frase: 'Ognuno versa la stessa cifra.' },
  {
    chiave: 'proporzionale',
    titolo: 'Secondo il reddito',
    frase: 'Ognuno versa la stessa percentuale del proprio reddito.',
  },
  { chiave: 'pari_residuo', titolo: 'Stesso residuo', frase: 'A fine mese restano a tutti gli stessi soldi personali.' },
];

interface PersonaState {
  slot: number;
  displayName: string;
  userId: string | null;
  redditoText: string;
  irregolare: boolean;
  inCasaDal: string;
  soloLettura: boolean;
}

interface VoceState {
  key: number;
  nome: string;
  categoriaNome: string;
  importoText: string;
  frequenzaText: string;
  custom: boolean;
  origine: OrigineStima;
  goalId: string | null;
  stimaIgnorataConN: number | null;
  info: string;
}

let contatoreChiavi = 0;
const nuovaChiave = () => ++contatoreChiavi;

const testoNumero = (n: number) => String(n).replace('.', ',');
const arrotonda2 = (n: number) => Math.round(n * 100) / 100;
const euro = (n: number) => `${formatNumero(n)} €`;

function parseMesi(testo: string): number | null {
  const n = parseImporto(testo);
  return n !== null && Number.isInteger(n) && n >= 1 ? n : null;
}

function opzioniMesi(da: string, extra: string[] = []): { value: string; label: string }[] {
  const base = Array.from({ length: 12 }, (_, i) => format(addMonths(parseISO(da), i), 'yyyy-MM-01'));
  const tutti = Array.from(new Set([...base, ...extra])).sort();
  return tutti.map((value) => ({ value, label: format(parseISO(value), 'LLLL yyyy', { locale: it }) }));
}

// L'ultimo valore salvato per ogni posizione, scorrendo le versioni dalla più vecchia alla più recente.
function ultimeQuote(piani: PlanBundle[]): Map<number, PlanShare> {
  const ultime = new Map<number, PlanShare>();
  for (const piano of piani) for (const s of piano.shares) ultime.set(s.slot, s);
  return ultime;
}

function personeIniziali(
  membri: HouseholdMember[],
  piani: PlanBundle[],
  meUserId: string,
  meseCorrente: string,
): PersonaState[] {
  const attivi = membri.filter((m) => m.attivo).sort((a, b) => a.slot - b.slot);
  const ultime = ultimeQuote(piani);
  const daMembro = (m: HouseholdMember): PersonaState => {
    const salvata = ultime.get(m.slot);
    return {
      slot: m.slot,
      displayName: m.displayName,
      userId: m.userId,
      redditoText: salvata ? testoNumero(salvata.redditoNettoMensile) : '',
      irregolare: salvata?.redditoIrregolare ?? false,
      inCasaDal: meseCorrente,
      soloLettura: salvata !== undefined && m.userId !== meUserId,
    };
  };
  const ultimo = piani[piani.length - 1];
  if (!ultimo) return attivi.map(daMembro);

  const out: PersonaState[] = [];
  // Le persone sono quelle della versione più recente, con l'ultimo valore salvato di ciascuna.
  // Chi è già uscito non riparte; una quota legata a chi non è più membro non resta (diventerebbe
  // un segnaposto che nessuno potrebbe occupare).
  for (const s0 of ultimo.shares.filter((x) => x.esceDal === null).sort((a, b) => a.slot - b.slot)) {
    const membro = attivi.find((m) => m.slot === s0.slot);
    if (s0.userId !== null && !membro) continue;
    const s = ultime.get(s0.slot) ?? s0;
    const userId = membro ? membro.userId : null;
    out.push({
      slot: s0.slot,
      displayName: membro?.displayName ?? s0.displayName,
      userId,
      redditoText: testoNumero(s.redditoNettoMensile),
      irregolare: s.redditoIrregolare,
      inCasaDal: s0.inCasaDal ?? meseCorrente,
      // Il reddito di un altro membro lo corregge lui, ma solo se il piano ne ha già uno.
      soloLettura: userId !== null && userId !== meUserId,
    });
  }
  for (const m of attivi) {
    if (!out.some((o) => o.slot === m.slot)) out.push(daMembro(m));
  }
  return out;
}

function vociIniziali(piano: PlanBundle | undefined): VoceState[] {
  if (piano) {
    return [...piano.items]
      .sort((a, b) => a.ordine - b.ordine)
      .map((i) => {
        const tipica = VOCI_CASA_TIPICHE.find((t) => t.nome === i.nome);
        return {
          key: nuovaChiave(),
          nome: i.nome,
          categoriaNome: i.nome,
          importoText: testoNumero(i.importoRicorrenza),
          frequenzaText: String(i.frequenzaMesi),
          custom: !tipica,
          origine: i.origineStima,
          goalId: i.goalId,
          stimaIgnorataConN: i.stimaIgnorataConN,
          info: tipica?.rigaDidattica ?? '',
        };
      });
  }
  return VOCI_CASA_TIPICHE.map((t) => ({
    key: nuovaChiave(),
    nome: t.nome,
    categoriaNome: t.nome,
    importoText: t.stimaRicorrenza === null ? '' : testoNumero(t.stimaRicorrenza),
    frequenzaText: String(t.frequenzaMesi),
    custom: false,
    origine: 'suggerita',
    goalId: null,
    stimaIgnorataConN: null,
    info: t.rigaDidattica,
  }));
}

function testoAvviso(a: AvvisoQuota): string {
  switch (a.tipo) {
    case 'redditi_mancanti':
      return `Manca il reddito di ${a.nome}.`;
    case 'percentuali_non_100':
      return 'Le percentuali devono fare 100.';
    case 'quota_supera_reddito':
      return `La quota di ${a.nome} è più alta del suo reddito.`;
    case 'spese_oltre_redditi':
      return 'Le spese di casa sono più alte dei redditi di tutti.';
  }
}

function MesiSelect({
  id,
  valore,
  da,
  onChange,
}: {
  id: string;
  valore: string;
  da: string;
  onChange: (v: string) => void;
}) {
  return (
    <select id={id} value={valore} onChange={(e) => onChange(e.target.value)} className={inputClass}>
      {opzioniMesi(da, [valore]).map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function QuotaWizard({
  householdId,
  meUserId,
  meseCorrente,
  membri,
  piani,
  slotMassimo,
  onSaved,
}: {
  householdId: string;
  meUserId: string;
  meseCorrente: string;
  membri: HouseholdMember[];
  // Le versioni del piano dal mese corrente in poi, dalla più vecchia alla più recente.
  piani: PlanBundle[];
  // La posizione più alta mai usata nella casa, anche da chi se n'è andato.
  slotMassimo: number;
  onSaved: () => void;
}) {
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-muted">{passo} di 5</p>
        <h2 className="text-xl font-bold">{PASSI[passo - 1]}</h2>
      </div>

      {passo === 1 ? (
        <>
          {persone.map((p) => {
            const tu = p.userId === meUserId;
            const placeholder = p.userId === null;
            return (
              <fieldset key={p.slot} className={carta}>
                <legend className="px-1 text-sm font-bold">
                  {nomePersona(p)}
                  {tu ? <span className="font-normal text-muted"> (tu)</span> : null}
                </legend>
                {placeholder ? (
                  <label className="flex flex-col gap-1 text-sm">
                    Nome
                    <input
                      type="text"
                      value={p.displayName}
                      onChange={(e) => setPersona(p.slot, { displayName: e.target.value })}
                      className={inputClass}
                    />
                  </label>
                ) : null}
                <label className="flex flex-col gap-1 text-sm">
                  {p.irregolare ? 'Reddito prudente' : 'Reddito netto al mese'}
                  <input
                    type="text"
                    inputMode="decimal"
                    value={p.redditoText}
                    readOnly={p.soloLettura}
                    onChange={(e) => setPersona(p.slot, { redditoText: e.target.value })}
                    className={inputClass}
                  />
                </label>
                {p.soloLettura ? (
                  <p className="text-xs text-muted">Il suo reddito lo corregge {p.displayName}.</p>
                ) : null}
                {tu ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={p.irregolare}
                      onChange={(e) => setPersona(p.slot, { irregolare: e.target.checked })}
                    />
                    Il mio reddito cambia da mese a mese (partita IVA)
                  </label>
                ) : null}
                <label className="flex flex-col gap-1 text-sm">
                  In casa dal
                  <MesiSelect
                    id={`in-casa-dal-${p.slot}`}
                    valore={p.inCasaDal}
                    da={meseCorrente}
                    onChange={(v) => setPersona(p.slot, { inCasaDal: v })}
                  />
                </label>
                {placeholder ? (
                  <button
                    type="button"
                    onClick={() => setPersone((ps) => ps.filter((x) => x.slot !== p.slot))}
                    className={`${bottoneSecondario} self-start`}
                    aria-label={`Togli ${nomePersona(p)}`}
                  >
                    Togli
                  </button>
                ) : null}
              </fieldset>
            );
          })}
          {irregolareAttivo ? (
            <p className="text-sm text-muted">
              Scrivi una cifra che incassi anche nei mesi magri. La quota si calcola su questa, il resto lo gestirete a
              parte.
            </p>
          ) : null}
          <p className="text-sm text-muted">Il reddito che scrivi qui lo vede tutta la casa.</p>
          <button type="button" onClick={aggiungiPersona} className={`${bottoneSecondario} self-start`}>
            Aggiungi una persona
          </button>
        </>
      ) : null}

      {passo === 2 ? (
        <>
          <div className="flex flex-col gap-3">
            {voci.map((v) => {
              const freq = parseMesi(v.frequenzaText);
              const importo = parseImporto(v.importoText);
              return (
                <div key={v.key} className={carta}>
                  <div className="flex items-center justify-between gap-2">
                    {v.custom ? (
                      <input
                        type="text"
                        aria-label="Nome della voce"
                        value={v.nome}
                        onChange={(e) => setVoce(v.key, { nome: e.target.value, categoriaNome: e.target.value })}
                        className={`${inputClass} flex-1`}
                      />
                    ) : (
                      <span className="text-sm font-bold">{v.nome}</span>
                    )}
                    <div className="flex items-center gap-2">
                      {v.info ? (
                        <button
                          type="button"
                          aria-label={`Che cos'è ${v.nome}`}
                          aria-expanded={infoAperta === v.key}
                          onClick={() => setInfoAperta(infoAperta === v.key ? null : v.key)}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-black/10 text-xs font-bold text-brand-dark"
                        >
                          i
                        </button>
                      ) : null}
                      <button
                        type="button"
                        aria-label={`Togli ${v.nome || 'voce'}`}
                        onClick={() => setVoci((vs) => vs.filter((x) => x.key !== v.key))}
                        className="text-xs font-semibold text-muted"
                      >
                        Togli
                      </button>
                    </div>
                  </div>
                  {infoAperta === v.key && v.info ? <p className="text-sm text-muted">{v.info}</p> : null}
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label={`Importo ${v.nome || 'voce'}`}
                      value={v.importoText}
                      onChange={(e) => setVoce(v.key, { importoText: e.target.value, origine: 'utente' })}
                      className={`${inputClass} w-28`}
                    />
                    <span>€ ogni</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label={`Ogni quanti mesi ${v.nome || 'voce'}`}
                      value={v.frequenzaText}
                      onChange={(e) => setVoce(v.key, { frequenzaText: e.target.value })}
                      className={`${inputClass} w-16`}
                    />
                    <span>{freq === 1 ? 'mese' : 'mesi'}</span>
                    {freq !== null && freq > 1 && importo !== null ? (
                      <span className="text-muted">{`= ${formatNumero(importo / freq)} al mese`}</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() =>
              setVoci((vs) => [
                ...vs,
                {
                  key: nuovaChiave(),
                  nome: '',
                  categoriaNome: '',
                  importoText: '',
                  frequenzaText: '1',
                  custom: true,
                  origine: 'utente',
                  goalId: null,
                  stimaIgnorataConN: null,
                  info: '',
                },
              ])
            }
            className={`${bottoneSecondario} self-start`}
          >
            Aggiungi una voce
          </button>
          <p className="text-base font-bold">{`Totale al mese: ${euro(sottotot)}`}</p>
          <p className="text-sm text-muted">Le cifre sono stime: si cambiano.</p>
        </>
      ) : null}

      {passo === 3 ? (
        <section className={carta}>
          <p className="text-sm">
            Il cuscinetto sono soldi della casa per gli imprevisti: una caldaia, una bolletta più alta del solito.
          </p>
          <div className="flex flex-col gap-2 text-sm">
            <span className="font-semibold">Obiettivo</span>
            {([1, 2] as const).map((m) => (
              <label key={m} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="cuscinetto-mesi"
                  checked={mesiCuscinetto === m}
                  onChange={() => setMesiCuscinetto(m)}
                />
                {m === 1 ? '1 mese di spese' : '2 mesi di spese'}
              </label>
            ))}
            <p className="text-muted">{`= ${euro(cuscinettoObiettivo)}`}</p>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            Ogni mese
            <input
              type="text"
              inputMode="decimal"
              value={cuscinettoTestoEffettivo}
              onChange={(e) => setCuscinettoText(e.target.value)}
              className={inputClass}
            />
          </label>
          {piene !== null ? (
            <p className="text-sm text-muted">{`Sarà pieno tra circa ${piene} ${piene === 1 ? 'mese' : 'mesi'}.`}</p>
          ) : null}
        </section>
      ) : null}

      {passo === 4 ? (
        <>
          <p className="text-base font-bold">{`Totale da versare ogni mese: ${euro(totale)}`}</p>
          {eraPersonalizzata ? (
            <p className="text-sm text-muted">
              Il piano di ora era diviso con percentuali scelte. Qui scegli come dividere da adesso.
            </p>
          ) : null}

          {piuPeriodi ? (
            <fieldset className={carta} data-testid="per-questo-periodo">
              <legend className="px-1 text-sm font-bold">Per questo periodo</legend>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="periodo"
                  checked={periodoTipo === 'tutto_a_chi_abita'}
                  onChange={() => setPeriodoTipo('tutto_a_chi_abita')}
                />
                Tutto a chi abita già in casa (100%)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="periodo"
                  checked={periodoTipo === 'normale'}
                  onChange={() => setPeriodoTipo('normale')}
                />
                La regola normale
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="periodo"
                  checked={periodoTipo === 'percentuali'}
                  onChange={() => setPeriodoTipo('percentuali')}
                />
                Percentuali a scelta
              </label>
              {periodoTipo === 'percentuali' ? (
                <div className="flex flex-wrap gap-3">
                  {persone.map((p) => (
                    <label key={p.slot} className="flex items-center gap-2 text-sm">
                      <span>{nomePersona(p)}</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label={`Percentuale di ${nomePersona(p)}`}
                        value={percText[p.slot] ?? ''}
                        onChange={(e) => setPercText((t) => ({ ...t, [p.slot]: e.target.value }))}
                        className={`${inputClass} w-20`}
                      />
                      <span>%</span>
                    </label>
                  ))}
                </div>
              ) : null}
              {periodoTipo === 'percentuali' && !percentualiValide ? (
                <p className="text-sm text-muted">{testoAvviso({ tipo: 'percentuali_non_100' })}</p>
              ) : null}
              {versioni ? (
                <ul className="flex flex-col gap-1 text-sm">
                  {versioni[0].quote.map((q) => (
                    <li key={q.slot}>{`${q.displayName}: versa ${euro(q.quotaMensile)}, resta ${euro(q.redditoNettoMensile - q.quotaMensile)}`}</li>
                  ))}
                </ul>
              ) : null}
            </fieldset>
          ) : null}

          <div role="radiogroup" aria-label="Come dividere" className="flex flex-col gap-3">
            {colonne.map(({ regola: r, risultato }) => {
              const titoloId = `titolo-${r.chiave}`;
              const scelto = regola === r.chiave;
              return (
                <div
                  key={r.chiave}
                  data-testid={`colonna-${r.chiave}`}
                  className={`${carta} ${scelto ? 'ring-2 ring-brand' : ''}`}
                >
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="regola"
                      aria-labelledby={titoloId}
                      checked={scelto}
                      disabled={!risultato.regolaDisponibile}
                      onChange={() => setRegola(r.chiave)}
                    />
                    <span id={titoloId} className="text-sm font-bold">
                      {r.titolo}
                    </span>
                  </label>
                  {risultato.regolaDisponibile ? (
                    <>
                      <ul aria-label="Quote" className="flex flex-col gap-0.5 text-sm">
                        {risultato.persone.map((q) => (
                          <li key={q.slot} className="flex justify-between gap-3">
                            <span>{q.nome}</span>
                            <span className="font-bold">{euro(q.quota)}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs font-semibold text-muted">Resta</p>
                      <ul aria-label="Cosa resta" className="flex flex-col gap-0.5 text-sm">
                        {risultato.persone.map((q) => (
                          <li key={q.slot} className="flex justify-between gap-3">
                            <span>{q.nome}</span>
                            <span>{q.resta === null ? '—' : euro(q.resta)}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs font-semibold text-muted">Peso sul reddito</p>
                      <ul aria-label="Peso sul reddito" className="flex flex-col gap-0.5 text-sm">
                        {risultato.persone.map((q) => (
                          <li key={q.slot} className="flex justify-between gap-3">
                            <span>{q.nome}</span>
                            <span>{q.peso === null ? '—' : `${Math.round(q.peso * 100)}%`}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    risultato.avvisi.map((a, i) => (
                      <p key={i} className="text-sm text-muted">
                        {testoAvviso(a)}
                      </p>
                    ))
                  )}
                  <p className="text-xs text-muted">{r.frase}</p>
                </div>
              );
            })}
          </div>
          {colonnaScelta.risultato.regolaDisponibile
            ? colonnaScelta.risultato.avvisi.map((a, i) => (
                <p key={i} className="text-sm text-muted">
                  {testoAvviso(a)}
                </p>
              ))
            : null}
        </>
      ) : null}

      {passo === 5 ? (
        <>
          <section className={carta}>
            <label className="flex flex-col gap-1 text-sm">
              Versamento entro il giorno
              <select value={giorno} onChange={(e) => setGiorno(Number(e.target.value))} className={inputClass}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Partite dal mese di
              <MesiSelect id="partenza" valore={partenza} da={meseCorrente} onChange={setPartenza} />
            </label>
          </section>

          {versioni ? (
            <section className={carta}>
              {versioni.length === 1 ? (
                <p className="text-base font-semibold">
                  {fraseVersamento({
                    quote: versioni[0].quote.map((q) => ({ nome: q.displayName, quota: q.quotaMensile })),
                    giorno,
                    da: versioni[0].validoDal,
                  })}
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {versioni.map((v) => (
                    <li key={v.validoDal} className="text-base font-semibold">
                      {`Da ${format(parseISO(v.validoDal), 'LLLL yyyy', { locale: it })}: ${fraseVersamento({
                        quote: v.quote.map((q) => ({ nome: q.displayName, quota: q.quotaMensile })),
                        giorno,
                      })}`}
                    </li>
                  ))}
                </ul>
              )}
              {statoBozza.frase ? <p className="text-sm text-muted">{statoBozza.frase}</p> : null}
            </section>
          ) : null}

          {errore ? (
            <p role="alert" className="text-sm text-danger">
              {errore}
            </p>
          ) : null}
        </>
      ) : null}

      <div className="flex justify-between gap-3">
        {passo > 1 ? (
          <button type="button" onClick={() => setPasso(passo - 1)} className={bottoneSecondario}>
            Indietro
          </button>
        ) : (
          <span />
        )}
        {passo < 5 ? (
          <button type="button" disabled={!puoProseguire} onClick={() => setPasso(passo + 1)} className={bottonePrimario}>
            Avanti
          </button>
        ) : (
          <button type="button" disabled={versioni === null || inCorso} onClick={conferma} className={bottonePrimario}>
            Confermiamo
          </button>
        )}
      </div>
    </div>
  );
}

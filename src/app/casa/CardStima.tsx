'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { applicaStima, ignoraStima } from '@/lib/data/stime';
import type { PlanBundle } from '@/lib/data/householdPlans';
import {
  pianoConStimaAggiornata,
  quoteDelConfronto,
  type PropostaStima,
} from '@/lib/calculations/casa/stimaVsReale';
import type { Spiegazione } from '@/lib/calculations/casa/spiegazioni';
import { formatNumero, nomeMese } from '@/lib/format';
import type { BudgetGoal } from '@/lib/types';
import { ERRORE_GENERICO } from './quota/quotaWizardState';
import { ErroreMovimento } from './CampiMovimento';
import { ComeSiCalcola } from './ComeSiCalcola';

const euro = (n: number): string => `${formatNumero(n)} €`;

const CLASSE_SCHEDA = 'flex flex-col gap-3 rounded-[var(--radius-lg)] bg-surface p-5 shadow-[var(--shadow-card)]';
const CLASSE_PRIMARIO =
  'rounded-[var(--radius-md)] bg-brand py-3 text-center text-base font-semibold text-brand-foreground disabled:opacity-40';
const CLASSE_SECONDARIO = 'rounded-[var(--radius-md)] border border-black/10 py-3 text-center text-base font-semibold disabled:opacity-40';
const CLASSE_LINK = 'font-semibold text-brand-dark';

// Quante bollette (o mesi) stanno dietro la media: al massimo le ultime 3.
const quanti = (p: PropostaStima): number => Math.min(p.n, 3);

function fraseConfronto(p: PropostaStima): string {
  const k = quanti(p);
  const previsto = `${p.nome}: avete previsto ${euro(p.importoMensileAttuale)} al mese`;
  if (p.unita === 'bollette') {
    return k === 1
      ? `${previsto}, l'ultima bolletta fa ${euro(p.nuovoMensile)} al mese.`
      : `${previsto}, le ultime ${k} bollette fanno in media ${euro(p.nuovoMensile)} al mese.`;
  }
  return k === 1
    ? `${previsto}, nell'ultimo mese ne sono usciti ${euro(p.mediaReale)}.`
    : `${previsto}, negli ultimi ${k} mesi ne sono usciti in media ${euro(p.mediaReale)}.`;
}

function spiegazione(p: PropostaStima): Spiegazione {
  const k = quanti(p);
  const prima =
    p.unita === 'bollette'
      ? k === 1
        ? `L'ultima bolletta: ${euro(p.mediaReale)}`
        : `Media delle ultime ${k} bollette: ${euro(p.mediaReale)}`
      : k === 1
        ? `L'ultimo mese: ${euro(p.mediaReale)}`
        : `Media degli ultimi ${k} mesi: ${euro(p.mediaReale)}`;
  const righe = [prima];
  if (p.frequenzaMesi > 1) {
    righe.push(`Ogni ${p.frequenzaMesi} mesi: ${euro(p.mediaReale)} / ${p.frequenzaMesi} = ${euro(p.nuovoMensile)} al mese`);
  }
  return {
    valore: p.nuovoMensile,
    formula: righe.join('\n'),
    ingredienti: [
      { etichetta: 'Stima di prima, al mese', valore: p.importoMensileAttuale },
      { etichetta: 'Cambia di', valore: Math.round((p.nuovoMensile - p.importoMensileAttuale) * 100) / 100 },
    ],
  };
}

// Una voce del piano che le spese vere smentiscono: due azioni, "Usa X al mese" e "Non ora".
export function CardStima({
  proposta,
  bundle,
  goal,
  householdId,
  validoDal,
  programmata,
  onFatto,
}: {
  proposta: PropostaStima;
  bundle: PlanBundle;
  goal: BudgetGoal | null;
  householdId: string;
  validoDal: string;
  programmata: boolean;
  onFatto: () => void;
}) {
  const [nascosta, setNascosta] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  // Il doppio tocco arriva prima che React ridisegni: lo blocca un ref, non lo stato.
  const occupato = useRef(false);

  if (nascosta) return null;

  const nuovo = programmata ? null : pianoConStimaAggiornata(bundle, proposta, validoDal);
  const quote = nuovo ? quoteDelConfronto(bundle, nuovo) : [];
  const mese = nomeMese(validoDal);

  async function esegui(azione: () => Promise<void>, dopo: () => void) {
    if (occupato.current) return;
    occupato.current = true;
    setInCorso(true);
    setErrore(null);
    try {
      await azione();
      setNascosta(true);
      dopo();
    } catch {
      setErrore(ERRORE_GENERICO);
      occupato.current = false;
      setInCorso(false);
    }
  }

  return (
    <section className={CLASSE_SCHEDA}>
      <p className="text-base font-semibold">{fraseConfronto(proposta)}</p>

      {nuovo ? (
        <>
          <p className="text-sm">
            {`Con ${euro(proposta.nuovoMensile)}: ${quote.map((q) => `${q.nome} ${formatNumero(q.prima)} → ${formatNumero(q.dopo)} €`).join(', ')}.`}
          </p>
          <p className="text-sm text-muted">
            {goal
              ? `La parte messa da parte per questa voce si aggiorna subito; la quota nuova parte da ${mese}.`
              : `La quota nuova parte da ${mese}.`}
          </p>
        </>
      ) : programmata ? (
        <p className="text-sm">
          {"C'è già una modifica programmata: la trovate in "}
          <Link href="/casa/quota" className={CLASSE_LINK}>
            Rivedi la quota
          </Link>
          .
        </p>
      ) : (
        <p className="text-sm">Per ora non si può aggiornare: rivedi la quota.</p>
      )}

      <ComeSiCalcola spiegazione={spiegazione(proposta)} />
      <ErroreMovimento testo={errore} />

      <div className="flex flex-col gap-2">
        {nuovo ? (
          <button
            type="button"
            disabled={inCorso}
            onClick={() =>
              void esegui(
                () => applicaStima(createClient(), { householdId, bundle, proposta, goal, validoDal }),
                onFatto,
              )
            }
            className={CLASSE_PRIMARIO}
          >
            {`Usa ${euro(proposta.nuovoMensile)} al mese`}
          </button>
        ) : null}
        <button
          type="button"
          disabled={inCorso}
          onClick={() => void esegui(() => ignoraStima(createClient(), householdId, proposta.itemId, proposta.n), () => {})}
          className={CLASSE_SECONDARIO}
        >
          Non ora
        </button>
      </div>
    </section>
  );
}

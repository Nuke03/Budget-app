'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { segnaNessunaSpesa } from '@/lib/data/notifiche';
import { aggiornaSaldoSpesa, creaSpesa, type SpazioSpesa, type SpesaCreata } from '@/lib/registraSpesa';
import { righeDaRiepilogo, scegliConti, type RigaStima } from '@/lib/calculations/supporto/inPari';
import type { Andamento } from '@/lib/calculations/supporto/andamento';
import type { Consiglio } from '@/lib/calculations/supporto/consiglio';
import { AndamentoCard } from '../home/AndamentoCard';
import { ConsiglioCard } from '../home/ConsiglioCard';
import { giornoEMese } from '../home/formati';

type Modo = 'personale' | 'casa';

function leggi(chiave: string): string | null {
  try {
    return window.localStorage.getItem(chiave);
  } catch {
    return null;
  }
}

const MESSAGGIO_ERRORE = 'Non sono riuscito a salvare: riprova.';
const MESSAGGIO_SALDO = 'Spese registrate, il saldo del conto non si è aggiornato: riprova.';
const SCELTE_CONTANTI = [20, 50];

// Un numero positivo da un campo, o null.
function importoDa(testo: string): number | null {
  const n = Number(testo.replace(',', '.'));
  return testo.trim() !== '' && Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

const classeScelta = (attiva: boolean) =>
  `min-h-11 min-w-11 rounded-[var(--radius-md)] border px-4 text-[15px] font-semibold disabled:opacity-40 ${
    attiva ? 'border-brand bg-brand text-brand-foreground' : 'border-rule bg-page text-foreground'
  }`;

const classeCampo =
  'num min-h-12 w-40 rounded-[var(--radius-md)] border border-rule bg-page px-3 font-serif text-2xl font-semibold';

const classeVaiAllaHome =
  'inline-flex min-h-12 items-center justify-center rounded-[var(--radius-md)] bg-brand px-4 text-base font-semibold text-brand-foreground';

export function InPari({
  periodo,
  conti,
  casa,
  andamento,
  consiglio,
  oggi,
}: {
  periodo: { dal: string; al: string } | null;
  conti: { id: string; nome: string }[];
  casa: { householdId: string; meUserId: string } | null;
  andamento: Andamento;
  consiglio: Consiglio;
  oggi: string;
}) {
  const router = useRouter();
  const [carta, setCarta] = useState('');
  const [contantiScelta, setContantiScelta] = useState<number | 'altro' | null>(null);
  const [contantiAltro, setContantiAltro] = useState('');
  const [modo, setModo] = useState<Modo>('personale');
  const [occupato, setOccupato] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [inSospeso, setInSospeso] = useState(false);
  const [fatto, setFatto] = useState(false);
  // Le righe già decise e ciò che è già stato scritto: un nuovo tentativo riprende da lì, senza doppioni.
  const righeRef = useRef<RigaStima[] | null>(null);
  const createRef = useRef<(SpesaCreata | null)[]>([]);
  const saldoRef = useRef<boolean[]>([]);

  useEffect(() => {
    if (casa && leggi('aggiungiModo') === 'casa') setModo('casa');
  }, [casa]);

  if (fatto) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-3.5 px-3 pb-24 pt-8">
        <h1 className="px-2 font-serif text-2xl font-semibold">Fatto: sei in pari.</h1>
        <AndamentoCard andamento={andamento} />
        <ConsiglioCard consiglio={consiglio} />
        <Link href="/" className={classeVaiAllaHome}>
          Torna alla Home
        </Link>
      </main>
    );
  }

  if (!periodo) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-4 px-5 pb-24 pt-8">
        <h1 className="font-serif text-2xl font-semibold">Sei in pari.</h1>
        <Link href="/" className={classeVaiAllaHome}>
          Torna alla Home
        </Link>
      </main>
    );
  }

  const { contoCarta } = scegliConti(conti, [leggi('aggiungi:conto:personale'), leggi('aggiungi:conto:casa')]);
  const { contoContanti } = scegliConti(conti, []);
  const righeAttuali = righeDaRiepilogo({
    carta: importoDa(carta),
    contanti: contantiScelta === 'altro' ? importoDa(contantiAltro) : contantiScelta,
    spazio: modo,
    contoCarta,
    contoContanti,
  });
  const righe = righeRef.current ?? righeAttuali;

  function spazioPer(riga: RigaStima): SpazioSpesa {
    return riga.casa && casa
      ? { tipo: 'casa', householdId: casa.householdId, meUserId: casa.meUserId, contiPersonaliIds: conti.map((c) => c.id) }
      : { tipo: 'personale' };
  }

  async function salva() {
    if (righe.length === 0 || occupato) return;
    righeRef.current = righe;
    setOccupato(true);
    setErrore(null);
    const supabase = createClient();
    try {
      for (let i = 0; i < righe.length; i++) {
        if (!createRef.current[i]) {
          createRef.current[i] = await creaSpesa(
            supabase,
            {
              tipo: 'expense',
              importo: righe[i].importo,
              categoriaId: null,
              accountId: righe[i].accountId,
              goalId: null,
              descrizione: '',
              stima: true,
            },
            spazioPer(righe[i])
          );
          setInSospeso(true);
        }
        if (!saldoRef.current[i]) {
          await aggiornaSaldoSpesa(supabase, createRef.current[i]!.payload);
          saldoRef.current[i] = true;
        }
      }
      setInSospeso(false);
      setFatto(true);
      router.refresh();
    } catch {
      setErrore(createRef.current.some(Boolean) ? MESSAGGIO_SALDO : MESSAGGIO_ERRORE);
    } finally {
      setOccupato(false);
    }
  }

  async function nienteSpeso() {
    if (occupato) return;
    setOccupato(true);
    setErrore(null);
    try {
      await segnaNessunaSpesa(createClient(), oggi);
      setFatto(true);
      router.refresh();
    } catch {
      setErrore(MESSAGGIO_ERRORE);
    } finally {
      setOccupato(false);
    }
  }

  const saldoDaRifare = inSospeso;

  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 px-5 pb-24 pt-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold">Rimettiamoci in pari</h1>
        <p className="mt-1 text-[15px] text-ink-2">
          Dal {giornoEMese(periodo.dal)} al {giornoEMese(periodo.al)} non hai segnato niente.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[15px] font-semibold">Con la carta</span>
        <span className="flex items-baseline gap-2">
          <input
            aria-label="Con la carta"
            type="number"
            inputMode="decimal"
            step="any"
            placeholder="0"
            value={carta}
            readOnly={saldoDaRifare}
            onChange={(e) => setCarta(e.target.value)}
            className={classeCampo}
          />
          <span className="font-serif text-xl text-ink-2">€</span>
        </span>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-[15px] font-semibold">In contanti, a occhio</legend>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {SCELTE_CONTANTI.map((v) => (
            <button
              key={v}
              type="button"
              disabled={saldoDaRifare}
              aria-pressed={contantiScelta === v}
              onClick={() => setContantiScelta(contantiScelta === v ? null : v)}
              className={`num ${classeScelta(contantiScelta === v)}`}
            >
              {v} €
            </button>
          ))}
          <button
            type="button"
            disabled={saldoDaRifare}
            aria-pressed={contantiScelta === 'altro'}
            onClick={() => setContantiScelta(contantiScelta === 'altro' ? null : 'altro')}
            className={classeScelta(contantiScelta === 'altro')}
          >
            Altro
          </button>
        </div>
        {contantiScelta === 'altro' ? (
          <span className="mt-1.5 flex items-baseline gap-2">
            <input
              aria-label="Contanti, altro importo"
              type="number"
              inputMode="decimal"
              step="any"
              placeholder="0"
              value={contantiAltro}
              readOnly={saldoDaRifare}
              onChange={(e) => setContantiAltro(e.target.value)}
              className={classeCampo}
            />
            <span className="font-serif text-xl text-ink-2">€</span>
          </span>
        ) : null}
      </fieldset>

      {casa ? (
        <div role="group" aria-label="Spazio" className="flex gap-2">
          <button
            type="button"
            disabled={saldoDaRifare}
            aria-pressed={modo === 'personale'}
            onClick={() => setModo('personale')}
            className={classeScelta(modo === 'personale')}
          >
            Tue
          </button>
          <button
            type="button"
            disabled={saldoDaRifare}
            aria-pressed={modo === 'casa'}
            onClick={() => setModo('casa')}
            className={classeScelta(modo === 'casa')}
          >
            Di casa
          </button>
        </div>
      ) : null}

      {errore ? (
        <p role="alert" className="text-[15px] font-semibold text-foreground">
          {errore}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={salva}
          disabled={occupato || righe.length === 0}
          className="min-h-12 rounded-[var(--radius-md)] bg-brand px-4 text-base font-semibold text-brand-foreground disabled:opacity-40"
        >
          {saldoDaRifare ? 'Riprova' : 'Fatto'}
        </button>
        {saldoDaRifare ? null : (
          <button
            type="button"
            onClick={nienteSpeso}
            disabled={occupato}
            className="min-h-12 rounded-[var(--radius-md)] border border-rule bg-page px-4 text-base font-semibold text-brand-dark disabled:opacity-40"
          >
            Non ho speso niente
          </button>
        )}
      </div>
    </main>
  );
}

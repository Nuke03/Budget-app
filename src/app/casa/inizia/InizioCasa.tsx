'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { createHousehold, createInvite, joinHousehold } from '@/lib/data/households';
import { formatCodiceInvito } from '@/lib/data/households';
import { CodiceInvito } from '../CodiceInvito';

const ERRORE_GENERICO = 'Salvataggio fallito, controlla la connessione e riprova.';
const ERRORE_CODICE = 'Codice non valido o scaduto. Chiedine uno nuovo.';
const MESSAGGIO_RPC_CODICE = 'Codice non valido o scaduto';

const inputClass =
  'rounded-[var(--radius-md)] border border-black/5 bg-surface-muted px-4 py-3 text-base outline-none focus-visible:border-brand';

export function InizioCasa({
  defaultDisplayName,
  modoIniziale = 'crea',
  codiceIniziale = '',
  origin,
}: {
  defaultDisplayName: string;
  modoIniziale?: 'crea' | 'entra';
  codiceIniziale?: string;
  origin?: string;
}) {
  const router = useRouter();
  const [modo, setModo] = useState<'crea' | 'entra'>(modoIniziale);
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [nomeCasa, setNomeCasa] = useState('');
  const [codice, setCodice] = useState(codiceIniziale ? formatCodiceInvito(codiceIniziale) : '');
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [codiceCreato, setCodiceCreato] = useState<string | null>(null);
  const [casaCreata, setCasaCreata] = useState(false);

  function vaiAllaCasa() {
    router.push('/casa');
    router.refresh();
  }

  async function crea() {
    setInCorso(true);
    setErrore(null);
    let id: string;
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
      id = await createHousehold(supabase, { nome: nomeCasa.trim(), displayName: displayName.trim() });
    } catch {
      setErrore(ERRORE_GENERICO);
      setInCorso(false);
      return;
    }
    // La casa esiste: da qui in poi non si può più riprovare a crearla.
    setCasaCreata(true);
    try {
      // Niente router.refresh() qui: la pagina rimanda a /casa quando la casa esiste
      // e farebbe sparire il codice appena creato. Il refresh avviene in vaiAllaCasa.
      setCodiceCreato(await createInvite(supabase, id));
    } catch {
      // casa pronta senza codice: si genera da Impostazioni
    } finally {
      setInCorso(false);
    }
  }

  async function entra() {
    setInCorso(true);
    setErrore(null);
    try {
      await joinHousehold(createClient(), { codice, displayName: displayName.trim() });
      vaiAllaCasa();
    } catch (e) {
      const messaggio = (e as { message?: string } | null)?.message;
      setErrore(messaggio === MESSAGGIO_RPC_CODICE ? ERRORE_CODICE : ERRORE_GENERICO);
    } finally {
      setInCorso(false);
    }
  }

  if (casaCreata) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-6 p-5 pt-8">
        <h1 className="text-2xl font-bold">La casa è pronta</h1>
        <section className="rounded-[var(--radius-lg)] bg-surface p-5 shadow-[var(--shadow-card)]">
          {codiceCreato ? (
            <CodiceInvito codice={codiceCreato} origin={origin} />
          ) : (
            <p className="text-sm text-muted">
              Il codice di invito non è stato creato: puoi generarlo da Impostazioni, dentro la casa.
            </p>
          )}
        </section>
        <button
          type="button"
          onClick={vaiAllaCasa}
          className="rounded-[var(--radius-md)] border border-black/10 py-3 text-sm font-semibold"
        >
          Vai alla casa
        </button>
      </main>
    );
  }

  const segmento = (attivo: boolean) =>
    `flex-1 rounded-[var(--radius-md)] py-2.5 text-sm font-semibold ${
      attivo ? 'bg-brand-tint text-brand-dark' : 'text-muted'
    }`;

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-5 pt-8">
      <h1 className="text-2xl font-bold">Casa</h1>

      <div className="flex gap-1 rounded-[var(--radius-lg)] bg-surface p-1 shadow-[var(--shadow-card)]">
        <button type="button" className={segmento(modo === 'crea')} onClick={() => setModo('crea')}>
          Creo la casa
        </button>
        <button type="button" className={segmento(modo === 'entra')} onClick={() => setModo('entra')}>
          Ho un codice di invito
        </button>
      </div>

      <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] bg-surface p-5 shadow-[var(--shadow-card)]">
        {modo === 'crea' ? (
          <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
            Nome della casa (facoltativo)
            <input
              value={nomeCasa}
              onChange={(e) => setNomeCasa(e.target.value)}
              placeholder="La nostra casa"
              className={inputClass}
            />
          </label>
        ) : (
          <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
            Codice di invito
            <input
              value={codice}
              onChange={(e) => setCodice(e.target.value)}
              placeholder="K7M2-QX9P"
              autoCapitalize="characters"
              className={inputClass}
            />
          </label>
        )}

        <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
          Come ti chiami per gli altri in casa?
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} />
        </label>

        {modo === 'crea' ? (
          <button
            type="button"
            onClick={crea}
            disabled={inCorso || !displayName.trim()}
            className="rounded-[var(--radius-md)] bg-brand py-3 text-sm font-semibold text-brand-foreground disabled:opacity-40"
          >
            Crea la casa
          </button>
        ) : (
          <button
            type="button"
            onClick={entra}
            disabled={inCorso || !codice.trim() || !displayName.trim()}
            className="rounded-[var(--radius-md)] bg-brand py-3 text-sm font-semibold text-brand-foreground disabled:opacity-40"
          >
            Entra
          </button>
        )}
        {errore && (
          <p role="alert" className="text-sm text-danger">
            {errore}
          </p>
        )}
      </section>
    </main>
  );
}

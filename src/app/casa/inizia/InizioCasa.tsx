'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { createHousehold, createInvite, formatCodiceInvito, joinHousehold } from '@/lib/data/households';
import { CoverHeader } from '../../CoverHeader';
import { CLASSE_CAMPO, CLASSE_NEUTRO, CLASSE_PRIMARIO, CLASSE_SCHEDA } from '../CampiMovimento';
import { CodiceInvito } from '../CodiceInvito';

const ERRORE_GENERICO = 'Salvataggio fallito, controlla la connessione e riprova.';
const ERRORE_CODICE = 'Codice non valido o scaduto. Chiedine uno nuovo.';
const MESSAGGIO_RPC_CODICE = 'Codice non valido o scaduto';

const inputClass = CLASSE_CAMPO;
const CORPO = 'mx-auto flex max-w-md flex-col gap-3.5 px-3 pb-6 pt-3.5';

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
      <>
      <CoverHeader titolo="La casa è pronta" />
      <main className={CORPO}>
        <section className={CLASSE_SCHEDA}>
          {codiceCreato ? (
            <CodiceInvito codice={codiceCreato} origin={origin} />
          ) : (
            <p className="text-[15px] text-ink-2">
              Il codice di invito non è stato creato: puoi generarlo da Impostazioni, dentro la casa.
            </p>
          )}
        </section>
        <button type="button" onClick={vaiAllaCasa} className={CLASSE_NEUTRO}>
          Vai alla casa
        </button>
      </main>
      </>
    );
  }

  const segmento = (attivo: boolean) =>
    `min-h-11 flex-1 rounded-full px-3 text-[15px] font-semibold ${
      attivo ? 'bg-brand text-brand-foreground' : 'text-foreground'
    }`;

  return (
    <>
    <CoverHeader titolo="Casa" />
    <main className={CORPO}>
      <div className="flex gap-1 rounded-full bg-brand-tint p-1">
        <button type="button" aria-pressed={modo === 'crea'} className={segmento(modo === 'crea')} onClick={() => setModo('crea')}>
          Creo la casa
        </button>
        <button type="button" aria-pressed={modo === 'entra'} className={segmento(modo === 'entra')} onClick={() => setModo('entra')}>
          Ho un codice di invito
        </button>
      </div>

      <section className={`${CLASSE_SCHEDA} gap-4`}>
        {modo === 'crea' ? (
          <label className="flex flex-col gap-1.5 text-[13px] text-ink-2">
            Nome della casa (facoltativo)
            <input
              value={nomeCasa}
              onChange={(e) => setNomeCasa(e.target.value)}
              placeholder="La nostra casa"
              className={inputClass}
            />
          </label>
        ) : (
          <label className="flex flex-col gap-1.5 text-[13px] text-ink-2">
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

        <label className="flex flex-col gap-1.5 text-[13px] text-ink-2">
          Come ti chiami per gli altri in casa?
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} />
        </label>

        {modo === 'crea' ? (
          <button
            type="button"
            onClick={crea}
            disabled={inCorso || !displayName.trim()}
            className={CLASSE_PRIMARIO}
          >
            Crea la casa
          </button>
        ) : (
          <button
            type="button"
            onClick={entra}
            disabled={inCorso || !codice.trim() || !displayName.trim()}
            className={CLASSE_PRIMARIO}
          >
            Entra
          </button>
        )}
        {errore && (
          <p role="alert" className="text-[15px] text-danger">
            {errore}
          </p>
        )}
      </section>
    </main>
    </>
  );
}

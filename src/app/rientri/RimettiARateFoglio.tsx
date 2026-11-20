'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { creaRientro, eliminaRientro } from '@/lib/data/rientri';
import { casa as scopeCasa, PERSONALE } from '@/lib/data/scope';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';
import { MESI_RIENTRO, type MesiRientro } from '@/lib/calculations/rientri';
import { fraseRata } from '@/lib/calculations/rientriTesti';
import { FoglioInferiore } from '../FoglioInferiore';
import { SceltePill } from '../casa/SceltePill';
import { CLASSE_LINK, CLASSE_NEUTRO, CLASSE_PRIMARIO } from '../casa/CampiMovimento';
import { useEliminaConAnnulla } from '../AnnullaProvider';

export const ERRORE_RIMETTI = 'Non sono riuscito a salvarlo. Riprova tra poco.';

export interface DestinazioneRientro {
  tipo: 'conto' | 'cassetto' | 'cassetto-casa';
  id: string;
  nome: string;
  householdId?: string;
  // Quanto è stato speso dal cassetto e non ancora rimesso: se > 0 è la cifra proposta.
  spesoDaRientrare?: number;
}

// "Rimetti a rate": soldi presi dai risparmi, riportati un po' al mese dove stavano. Un passo alla volta.
export function RimettiARateFoglio({
  destinazioni,
  scelta,
  onFatto,
  onClose,
  notaCasa,
}: {
  destinazioni: DestinazioneRientro[];
  scelta?: string;
  onFatto: () => void;
  onClose: () => void;
  notaCasa?: string;
}) {
  const router = useRouter();
  const eliminaConAnnulla = useEliminaConAnnulla();
  const [oggi] = useState(() => oggiRomaISO());
  const iniziale = destinazioni.find((d) => d.id === scelta) ?? null;
  const proposta = (d: DestinazioneRientro | null) =>
    d && d.tipo !== 'conto' && (d.spesoDaRientrare ?? 0) > 0 ? String(d.spesoDaRientrare).replace('.', ',') : '';
  const [dove, setDove] = useState<string | null>(iniziale?.id ?? null);
  const [passo, setPasso] = useState<0 | 1 | 2>(iniziale ? 1 : 0);
  const [importo, setImporto] = useState(proposta(iniziale));
  const [mesi, setMesi] = useState<MesiRientro>(3);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState(false);
  // Blocca il doppio tocco prima ancora che React ridisegni il pulsante.
  const occupato = useRef(false);

  const destinazione = destinazioni.find((d) => d.id === dove) ?? null;
  const valore = Number(importo.trim().replace(',', '.'));
  const importoValido = importo.trim() !== '' && Number.isFinite(valore) && valore > 0 && valore < 1e9;

  function scegli(id: string) {
    const d = destinazioni.find((x) => x.id === id) ?? null;
    setDove(id);
    setImporto(proposta(d));
    setPasso(1);
  }

  async function invia() {
    if (!destinazione || !importoValido || occupato.current) return;
    occupato.current = true;
    setInCorso(true);
    setErrore(false);
    const scope =
      destinazione.tipo === 'cassetto-casa' && destinazione.householdId ? scopeCasa(destinazione.householdId) : PERSONALE;
    let id: string;
    try {
      id = await creaRientro(
        createClient(),
        {
          goalId: destinazione.tipo === 'conto' ? null : destinazione.id,
          accountId: destinazione.tipo === 'conto' ? destinazione.id : null,
          importo: valore,
          mesi,
          creatoIl: oggi,
        },
        scope
      );
    } catch {
      setErrore(true);
      occupato.current = false;
      setInCorso(false);
      return;
    }
    // La riga è già scritta: "Annulla", per 5 secondi, la toglie.
    eliminaConAnnulla({
      id,
      testo: 'Rientro creato.',
      nascondi: () => {},
      esegui: async () => {},
      ripristina: () => {
        void eliminaRientro(createClient(), id)
          .then(() => router.refresh())
          .catch(() => {});
      },
    });
    occupato.current = false;
    setInCorso(false);
    onFatto();
  }

  const etichetta = (d: DestinazioneRientro) => (d.tipo === 'cassetto-casa' ? `${d.nome} · Casa` : d.nome);

  return (
    <FoglioInferiore titolo="Rimetti a rate" onClose={() => !inCorso && onClose()}>
      <div className="flex flex-col gap-4 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {destinazioni.length === 0 ? (
          <>
            <p className="text-[15px] text-ink-2">Non c&apos;è ancora un conto risparmio o un cassetto.</p>
            <Link href="/goals?nuovo=1" className={CLASSE_LINK}>
              Metti da parte
            </Link>
          </>
        ) : passo === 0 ? (
          <SceltePill
            legenda="Dove li rimetti?"
            opzioni={destinazioni.map((d) => ({ chiave: d.id, etichetta: etichetta(d) }))}
            valore={dove}
            onChange={scegli}
          />
        ) : passo === 1 ? (
          <>
            <label className="flex flex-col gap-1.5 text-[13px] text-ink-2">
              Quanto?
              <input
                inputMode="decimal"
                placeholder="0"
                value={importo}
                onChange={(e) => setImporto(e.target.value)}
                className="num min-h-16 rounded-[var(--radius-md)] border border-rule bg-surface px-3 py-2 font-serif text-[40px] font-bold leading-none text-foreground outline-none focus-visible:border-brand"
              />
            </label>
            <button type="button" disabled={!importoValido} onClick={() => setPasso(2)} className={CLASSE_PRIMARIO}>
              Avanti
            </button>
            <button type="button" onClick={() => setPasso(0)} className={CLASSE_NEUTRO}>
              Cambia dove
            </button>
          </>
        ) : (
          <>
            <SceltePill
              legenda="In quanti mesi?"
              opzioni={MESI_RIENTRO.map((m) => ({ chiave: String(m), etichetta: `${m} mesi` }))}
              valore={String(mesi)}
              onChange={(k) => setMesi(Number(k) as MesiRientro)}
            />
            <p className="num text-[15px] text-foreground">{fraseRata(valore, mesi, oggi)}</p>
            {destinazione?.tipo === 'cassetto-casa' && notaCasa ? (
              <p className="text-[13px] text-ink-2">{notaCasa}</p>
            ) : null}
            {errore ? (
              <p role="alert" className="text-[15px] font-medium text-danger">
                {ERRORE_RIMETTI}
              </p>
            ) : null}
            <button type="button" onClick={() => void invia()} disabled={inCorso} className={CLASSE_PRIMARIO}>
              Rimetti a rate
            </button>
            <button type="button" onClick={() => setPasso(1)} className={CLASSE_NEUTRO}>
              Cambia la cifra
            </button>
          </>
        )}
      </div>
    </FoglioInferiore>
  );
}

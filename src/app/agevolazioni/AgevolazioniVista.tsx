'use client';

import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { CoverHeader } from '../CoverHeader';
import { FoglioInferiore } from '../FoglioInferiore';
import { FumettoPrimaVolta } from '../fumetti/FumettoPrimaVolta';
import { CLASSE_NEUTRO, CLASSE_PRIMARIO, CLASSE_SCHEDA, CLASSE_LINK } from '../casa/CampiMovimento';
import { SituazioneFoglio } from './SituazioneFoglio';
import { segnaVoce } from './actions';
import { iseeValido, vociDaMostrare } from '@/lib/agevolazioni/regole';
import { formatDataLunga, formatEuro } from '@/lib/format';
import type { Come, Situazione, StatoVoce, VoceId, VoceMostrata } from '@/lib/agevolazioni/tipi';

const ETICHETTA: Record<Come, string> = {
  automatica: 'Automatico',
  'su-domanda': 'Su domanda',
  informativa: 'Da sapere',
  collegamento: 'Vai',
};

const ERRORE = 'Non sono riuscito ad aggiornare. Riprova fra poco.';

function riepilogo(s: Situazione, oggi: string): string[] {
  const out: string[] = [];
  const isee = iseeValido(s, oggi);
  if (isee !== null) out.push(`ISEE ${formatEuro(isee)}`);
  else if (s.isee !== null) out.push('ISEE scaduto');
  if (s.comune?.trim()) out.push(s.comune.trim());
  if (s.inAffitto !== null) out.push(s.inAffitto ? 'In affitto' : 'Non in affitto');
  if (s.studente !== null) out.push(s.studente ? 'Studi' : 'Non studi');
  return out;
}

function Riga({
  m,
  aperta,
  onToggle,
  chiusa,
  occupato,
  onSegna,
}: {
  m: VoceMostrata;
  aperta: boolean;
  onToggle: () => void;
  chiusa: boolean;
  occupato: boolean;
  onSegna: (voceId: VoceId, stato: StatoVoce['stato'] | null) => void;
}) {
  const { voce } = m;
  const [copiato, setCopiato] = useState(false);

  async function copia() {
    if (!m.cercare) return;
    try {
      await navigator.clipboard.writeText(m.cercare);
      setCopiato(true);
      setTimeout(() => setCopiato(false), 2000);
    } catch {
      // Niente da fare: il testo resta leggibile e si copia a mano.
    }
  }

  return (
    <li id={voce.id} className="scroll-mt-20 border-b border-rule last:border-b-0">
      <button
        type="button"
        aria-expanded={aperta}
        onClick={onToggle}
        className="flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-base text-foreground">{voce.titolo}</span>
          <span className="text-[13px] text-ink-2">{m.frase}</span>
        </span>
        <span className="shrink-0 rounded-full bg-brand-tint px-2.5 py-0.5 text-[13px] font-semibold text-foreground">
          {ETICHETTA[voce.come]}
        </span>
        <ChevronDown size={18} className={`shrink-0 text-ink-2 ${aperta ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {aperta ? (
        <div className="flex flex-col gap-3 px-4 pb-4 text-[15px] text-foreground">
          <p>{voce.perche}</p>
          <ul className="list-disc pl-5">
            {voce.cosaFare.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          {m.cercare ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-ink-2">Cosa cercare</span>
              <span className="font-semibold">{m.cercare}</span>
              <button type="button" onClick={copia} className={CLASSE_NEUTRO}>
                {copiato ? 'Copiato' : 'Copia'}
              </button>
            </div>
          ) : null}
          {voce.link ? (
            <a href={voce.link.href} target="_blank" rel="noopener noreferrer" className={CLASSE_LINK}>
              {voce.link.testo}
            </a>
          ) : null}
          <p className="text-[13px] text-ink-2">Controllato il {formatDataLunga(voce.controllatoIl)}</p>
          {m.daRicontrollare ? <p className="text-[13px] text-foreground">Potrebbe essere cambiata: controlla il link.</p> : null}
          {chiusa ? (
            <button type="button" disabled={occupato} onClick={() => onSegna(voce.id, null)} className={CLASSE_NEUTRO}>
              Rimetti fra da controllare
            </button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={occupato} onClick={() => onSegna(voce.id, 'fatto')} className={CLASSE_PRIMARIO}>
                Fatto
              </button>
              <button
                type="button"
                disabled={occupato}
                onClick={() => onSegna(voce.id, 'non-mi-riguarda')}
                className={CLASSE_NEUTRO}
              >
                Non mi riguarda
              </button>
            </div>
          )}
        </div>
      ) : null}
    </li>
  );
}

export function AgevolazioniVista({
  situazione,
  stati,
  oggi,
}: {
  situazione: Situazione;
  stati: StatoVoce[];
  oggi: string;
}) {
  const [locali, setLocali] = useState<StatoVoce[]>(stati);
  useEffect(() => setLocali(stati), [stati]);
  const [aperta, setAperta] = useState<VoceId | null>(null);
  const [chiuseAperte, setChiuseAperte] = useState(false);
  const [foglio, setFoglio] = useState(false);
  const [occupato, setOccupato] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const { daControllare, chiuse } = vociDaMostrare(situazione, locali, oggi);
  const dati = riepilogo(situazione, oggi);

  // Il promemoria della Home porta qui con #voce: la riga si apre da sola.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) setAperta(id as VoceId);
  }, []);

  async function segna(voceId: VoceId, stato: StatoVoce['stato'] | null) {
    if (occupato) return;
    setOccupato(true);
    setErrore(null);
    try {
      await segnaVoce(voceId, stato);
      setLocali((prev) => {
        const resto = prev.filter((x) => x.voceId !== voceId);
        return stato === null ? resto : [...resto, { voceId, stato, il: oggi }];
      });
      setAperta(null);
    } catch {
      setErrore(ERRORE);
    } finally {
      setOccupato(false);
    }
  }

  const elenco = (voci: VoceMostrata[], chiusa: boolean) => (
    <ul className="overflow-hidden rounded-[var(--radius-lg)] border border-rule bg-page">
      {voci.map((m) => (
        <Riga
          key={m.voce.id}
          m={m}
          aperta={aperta === m.voce.id}
          onToggle={() => setAperta(aperta === m.voce.id ? null : m.voce.id)}
          chiusa={chiusa}
          occupato={occupato}
          onSegna={segna}
        />
      ))}
    </ul>
  );

  return (
    <>
      <CoverHeader titolo="Agevolazioni e scadenze" />
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 pb-28 pt-5">
        <FumettoPrimaVolta
          id="agevolazioni"
          ancora="agevolazioni"
          testo="Qui trovi aiuti e sconti che potrebbero riguardarti, e quando chiederli."
        />
        <section aria-label="La tua situazione" data-fumetto="agevolazioni" className={CLASSE_SCHEDA}>
          <h2 className="font-serif text-lg font-bold">La tua situazione</h2>
          {dati.length > 0 ? (
            <p className="text-[15px] text-foreground">{dati.join(' · ')}</p>
          ) : (
            <p className="text-[15px] text-foreground">Rispondi a 4 domande per vedere cosa potrebbe riguardarti.</p>
          )}
          <button type="button" onClick={() => setFoglio(true)} className={CLASSE_NEUTRO}>
            {dati.length > 0 ? 'Modifica' : 'Rispondi'}
          </button>
        </section>

        <section aria-label="Da controllare" className="flex flex-col gap-2">
          <h2 className="font-serif text-lg font-bold">Da controllare</h2>
          {errore ? (
            <p role="alert" className="text-[15px] text-foreground">
              {errore}
            </p>
          ) : null}
          {daControllare.length > 0 ? elenco(daControllare, false) : <p className="text-[15px] text-ink-2">Per ora non c&apos;è altro da controllare.</p>}
        </section>

        {chiuse.length > 0 ? (
          <section aria-label="Fatte e non mi riguardano" className="flex flex-col gap-2">
            <button
              type="button"
              aria-expanded={chiuseAperte}
              onClick={() => setChiuseAperte(!chiuseAperte)}
              className="flex min-h-[44px] items-center gap-2 text-left text-base font-semibold text-foreground"
            >
              <span className="flex-1">Fatte e non mi riguardano ({chiuse.length})</span>
              <ChevronDown size={18} className={`text-ink-2 ${chiuseAperte ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            {chiuseAperte ? elenco(chiuse, true) : null}
          </section>
        ) : null}
      </main>
      {foglio ? (
        <FoglioInferiore titolo="La tua situazione" onClose={() => setFoglio(false)}>
          <SituazioneFoglio
            iniziale={{
              isee: situazione.isee,
              dsuData: situazione.dsuData,
              comune: situazione.comune,
              inAffitto: situazione.inAffitto,
              studente: situazione.studente,
            }}
            oggi={oggi}
            onSalvato={() => setFoglio(false)}
          />
        </FoglioInferiore>
      ) : null}
    </>
  );
}

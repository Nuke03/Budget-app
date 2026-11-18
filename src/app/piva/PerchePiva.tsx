'use client';

import { useId, useState, type ReactNode } from 'react';
import { formatNumero } from '@/lib/format';
import { euroInFrase } from './PromptQuota';
import type { PivaSettings } from '@/lib/types';

// Il "Perché?" di ogni numero della pagina: un tocco, e il numero si spiega con le sue parti.
export function Perche({ children }: { children: ReactNode }) {
  const [aperto, setAperto] = useState(false);
  const pannelloId = useId();
  return (
    <div>
      <button
        type="button"
        aria-expanded={aperto}
        aria-controls={pannelloId}
        onClick={() => setAperto((a) => !a)}
        className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-dark"
      >
        Perché?
      </button>
      {aperto ? (
        <div
          id={pannelloId}
          className="mt-1 flex flex-col gap-2 rounded-[var(--radius-md)] border border-rule bg-brand-tint p-3 text-[15px]"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

function Parte({ nome, valore }: { nome: string; valore: string }) {
  return (
    <li className="flex justify-between gap-3">
      <span className="text-ink-2">{nome}</span>
      <span className="num font-semibold">{valore}</span>
    </li>
  );
}

// La percentuale di ogni incasso divisa nei tre pezzi, ciascuno spiegato la prima volta che compare.
export function PerchePercentuale({
  settings,
  aliquota,
  percentuale,
}: {
  settings: PivaSettings;
  aliquota: number;
  percentuale: number;
}) {
  const coef = settings.coefficienteRedditivita;
  const imposta = (coef * aliquota) / 100;
  const soggettivo = (coef * settings.aliquotaContributoSoggettivo) / 100;
  const integrativo = settings.aliquotaContributoIntegrativo;
  return (
    <Perche>
      <p>
        Di ogni incasso solo il {formatNumero(coef)}% conta come reddito. Su quella parte paghi l&apos;imposta sostitutiva
        (la tassa unica del regime forfettario, al posto dell&apos;Irpef) e il contributo soggettivo (la tua pensione
        alla cassa). In più c&apos;è il contributo integrativo, una percentuale dell&apos;incasso che va alla cassa.
      </p>
      <ul className="flex flex-col gap-1">
        <Parte nome={`Imposta sostitutiva (${formatNumero(coef)}% × ${formatNumero(aliquota)}%)`} valore={`${formatNumero(imposta)}%`} />
        <Parte
          nome={`Contributo soggettivo (${formatNumero(coef)}% × ${formatNumero(settings.aliquotaContributoSoggettivo)}%)`}
          valore={`${formatNumero(soggettivo)}%`}
        />
        <Parte nome="Contributo integrativo" valore={`${formatNumero(integrativo)}%`} />
        <Parte nome="Da mettere da parte" valore={`${formatNumero(percentuale)}%`} />
      </ul>
    </Perche>
  );
}

export function PercheSaldoVaso({ nomeConto }: { nomeConto: string }) {
  return (
    <Perche>
      <p>
        È il saldo del conto «{nomeConto}». Sale quando sposti la quota di un incasso e scende quando paghi tasse e
        contributi.
      </p>
    </Perche>
  );
}

// Il confronto fra quanto servono le tasse dell'anno e quanto hai messo da parte: qui sta l'avviso sulla stima.
export function PercheVaso({
  settings,
  fatturato,
  stima,
  messi,
}: {
  settings: PivaSettings;
  fatturato: number;
  stima: { imposta: number; soggettivo: number; integrativo: number; totale: number };
  messi: number;
}) {
  return (
    <Perche>
      <p>
        Parto da quanto hai incassato quest&apos;anno e applico le regole del regime forfettario: l&apos;imposta
        sostitutiva sul reddito, il contributo soggettivo (non meno del minimale di{' '}
        {euroInFrase(settings.minimaleContributivoAnnuo)}) e il contributo integrativo.
      </p>
      <ul className="flex flex-col gap-1">
        <Parte nome="Incassato quest'anno" valore={euroInFrase(Math.round(fatturato))} />
        <Parte nome="Imposta sostitutiva" valore={euroInFrase(Math.round(stima.imposta))} />
        <Parte nome="Contributo soggettivo" valore={euroInFrase(Math.round(stima.soggettivo))} />
        <Parte nome="Contributo integrativo" valore={euroInFrase(Math.round(stima.integrativo))} />
        <Parte nome="Servono circa" valore={euroInFrase(Math.round(stima.totale))} />
        <Parte nome="Messi da parte quest'anno" valore={euroInFrase(Math.round(messi))} />
      </ul>
      <p>È una stima, la conferma è del commercialista.</p>
    </Perche>
  );
}

// Perché il vaso può non bastare per una scadenza: gli acconti guardano l'anno prima.
export function PercheScadenza() {
  return (
    <Perche>
      <p>
        Gli acconti si calcolano sulle tasse dell&apos;anno prima, non su quello che incassi adesso: possono essere
        più alti di quanto hai messo da parte.
      </p>
      <p>La percentuale che ti proponiamo è prudente: alzandola, la prossima volta ci arrivi.</p>
      <p>È una stima: la conferma è del commercialista.</p>
    </Perche>
  );
}

export function PercheQuote({ percentuale }: { percentuale: number }) {
  return (
    <Perche>
      <p>
        Ogni quota è il {formatNumero(percentuale)}% dell&apos;incasso, arrotondato all&apos;euro. Quando sposti i soldi
        sul conto tasse tocca «Fatto» e la quota esce da questa lista.
      </p>
    </Perche>
  );
}

// Perché una fattura non pagata non è ancora un costo di tasse.
export function PercheFatture() {
  return (
    <Perche>
      <p>
        Nel forfettario le tasse si pagano su quello che incassi, non su quello che fatturi. Questa fattura non è ancora
        soldi tuoi, ma neanche tasse da pagare.
      </p>
    </Perche>
  );
}

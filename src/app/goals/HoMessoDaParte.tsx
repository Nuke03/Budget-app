'use client';

import { useEffect, useState } from 'react';
import { formatEuro } from '@/lib/format';

const fieldClass =
  'min-h-12 rounded-[var(--radius-md)] border border-rule bg-page px-3 text-[15px] text-foreground focus-visible:border-brand';

// "Ho messo da parte": un tocco per confermare che i soldi della quota del mese sono davvero spostati.
// Importo e data sono già scritti (la quota e oggi) e si possono cambiare; la data non può essere nel futuro.
// Alla prima conferma di un obiettivo (`finora` presente) l'importo parte da quanto dovrebbe esserci già da parte,
// non dalla quota di un mese: da lì in poi il riservato è il minore fra quota a tempo e confermato, e una cifra
// piccola lo farebbe crollare. `primoMese` = niente è ancora maturato: nessuna cifra, solo una frase calma.
// La scrittura la fa chi usa il componente: se non riesce, la conferma resta aperta con una frase.
export function HoMessoDaParte({
  quota,
  finora,
  primoMese = false,
  oggi,
  apertoIniziale = false,
  onConferma,
}: {
  quota: number;
  // Quanto dovrebbe esserci già da parte; solo alla prima conferma (null/assente = conferma successiva).
  finora?: number | null;
  primoMese?: boolean;
  // 'yyyy-MM-dd'
  oggi: string;
  // Apre la conferma al montaggio, con la stessa cifra iniziale di "Ho messo da parte" (dall'indirizzo ?versa=).
  apertoIniziale?: boolean;
  onConferma: (importo: number, data: string) => Promise<void>;
}) {
  const primaConferma = finora !== null && finora !== undefined;
  const importoIniziale = (): string => {
    const iniziale = primaConferma && finora > 0 ? finora : quota;
    return String(Math.round(iniziale * 100) / 100);
  };
  const [aperto, setAperto] = useState(apertoIniziale);
  const [importo, setImporto] = useState(() => (apertoIniziale ? importoIniziale() : ''));
  const [data, setData] = useState(oggi);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  // Quando l'ingresso arriva con la pagina già aperta (apertoIniziale diventa vero dopo il montaggio) la conferma si apre.
  useEffect(() => {
    if (apertoIniziale) apri();
  }, [apertoIniziale]);

  const valore = Number(importo);
  const importoOk = importo.trim() !== '' && Number.isFinite(valore) && valore > 0 && valore < 1e9;
  const dataOk = /^\d{4}-\d{2}-\d{2}$/.test(data) && data <= oggi;
  const valido = importoOk && dataOk;

  function apri() {
    setImporto(importoIniziale());
    setData(oggi);
    setErrore(null);
    setAperto(true);
  }

  async function conferma() {
    if (!valido || inCorso) return;
    setInCorso(true);
    setErrore(null);
    try {
      await onConferma(Math.round(valore * 100) / 100, data);
      setAperto(false);
    } catch {
      setErrore('Non sono riuscito a segnarlo. Riprova tra poco.');
    } finally {
      setInCorso(false);
    }
  }

  if (!aperto) {
    return (
      <button
        type="button"
        onClick={apri}
        className="mt-2 min-h-11 w-full rounded-[var(--radius-md)] bg-brand-tint px-3 py-2 text-[15px] font-semibold text-brand-dark"
      >
        Ho messo da parte
      </button>
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-2.5 rounded-[var(--radius-sm)] bg-surface-muted p-3">
      {primaConferma ? (
        <p className="num text-[13px] text-ink-2">
          {primoMese
            ? "Conta dal mese prossimo: per ora non c'è niente da mettere da parte."
            : `Finora dovrebbero esserci ${formatEuro(finora)} per questo obiettivo.`}
        </p>
      ) : null}
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
        Importo
        <input
          aria-label="Importo"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={importo}
          onChange={(e) => setImporto(e.target.value)}
          className={fieldClass}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
        Data
        <input
          aria-label="Data"
          type="date"
          max={oggi}
          value={data}
          onChange={(e) => setData(e.target.value)}
          className={fieldClass}
        />
      </label>
      {errore ? (
        <p role="alert" className="text-[13px] text-danger">
          {errore}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={conferma}
          disabled={!valido || inCorso}
          className="min-h-11 flex-1 rounded-[var(--radius-md)] bg-brand px-3 py-2 text-[15px] font-semibold text-brand-foreground disabled:opacity-40"
        >
          Conferma
        </button>
        <button
          type="button"
          onClick={() => setAperto(false)}
          className="min-h-11 rounded-[var(--radius-md)] bg-brand-tint px-4 py-2 text-[15px] font-semibold text-foreground"
        >
          Annulla
        </button>
      </div>
    </div>
  );
}

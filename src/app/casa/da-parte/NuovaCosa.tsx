'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addMonths, format, parseISO } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { creaFondoUnaVolta } from '@/lib/data/fondiCasa';
import { controllaDataIngresso } from '@/lib/calculations/casa/costiIngresso';
import { parseImporto } from '@/lib/calculations/casa/parseImporto';

const ERRORE = 'Salvataggio fallito, controlla la connessione e riprova.';

export function NuovaCosa({ householdId, oggi }: { householdId: string; oggi: string }) {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [importoTesto, setImportoTesto] = useState('');
  const [data, setData] = useState(() => format(addMonths(parseISO(oggi), 6), 'yyyy-MM-dd'));
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const occupato = useRef(false);

  const importo = parseImporto(importoTesto);
  const passata = data !== '' && controllaDataIngresso(data, oggi) === 'passata';
  const puoSalvare = nome.trim() !== '' && importo !== null && importo > 0 && data !== '' && !passata && !inCorso;

  async function salva() {
    if (occupato.current || !puoSalvare || importo === null) return;
    occupato.current = true;
    setInCorso(true);
    setErrore(null);
    try {
      await creaFondoUnaVolta(createClient(), { householdId, nome: nome.trim(), importo, scadenza: data, oggi });
      setNome('');
      setImportoTesto('');
      router.refresh();
    } catch {
      setErrore(ERRORE);
    } finally {
      occupato.current = false;
      setInCorso(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-md)] bg-surface p-4 shadow-[var(--shadow-card)]">
      <p className="text-sm font-semibold">Un&apos;altra spesa da pagare una volta</p>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Nome
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="rounded-[var(--radius-sm)] border border-black/10 bg-surface-muted p-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Importo (€)
        <input
          inputMode="decimal"
          value={importoTesto}
          onChange={(e) => setImportoTesto(e.target.value)}
          className="rounded-[var(--radius-sm)] border border-black/10 bg-surface-muted p-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Entro quando
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="rounded-[var(--radius-sm)] border border-black/10 bg-surface-muted p-2 text-sm"
        />
      </label>
      {passata ? (
        <p role="alert" className="text-sm text-danger">
          La data è già passata.
        </p>
      ) : null}
      <button
        type="button"
        disabled={!puoSalvare}
        onClick={salva}
        className="rounded-[var(--radius-md)] bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50"
      >
        Aggiungi
      </button>
      {errore ? (
        <p role="alert" className="text-sm text-danger">
          {errore}
        </p>
      ) : null}
    </div>
  );
}

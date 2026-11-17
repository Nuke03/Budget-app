'use client';

import { formatEuro } from '@/lib/format';

export function PivaDashboard({
  fatturatoAnnuo,
  impostaSostitutiva,
  contributoSoggettivo,
  contributoIntegrativo,
  totaleDaAccantonare,
  quotaMensileSuggerita,
  onModifica,
  onDisattiva,
}: {
  fatturatoAnnuo: number;
  impostaSostitutiva: number;
  contributoSoggettivo: number;
  contributoIntegrativo: number;
  totaleDaAccantonare: number;
  quotaMensileSuggerita: number;
  onModifica: () => void;
  onDisattiva: () => void;
}) {
  const righe: Array<{ label: string; value: number }> = [
    { label: 'Fatturato registrato quest’anno', value: fatturatoAnnuo },
    { label: 'Imposta sostitutiva stimata', value: impostaSostitutiva },
    { label: 'Contributo soggettivo stimato', value: contributoSoggettivo },
    { label: 'Contributo integrativo stimato', value: contributoIntegrativo },
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <section className="rounded-[var(--radius-md)] border border-rule bg-page p-4">
        <p className="text-[13px] text-ink-2">Totale da accantonare</p>
        <p className="num mt-1 font-serif text-5xl font-bold leading-none">
          {formatEuro(totaleDaAccantonare)}
        </p>
        <p className="mt-3 border-t border-rule pt-3 text-[15px]">
          Quota mensile suggerita: <span className="num font-semibold">{formatEuro(quotaMensileSuggerita)}</span>
        </p>
      </section>

      <section className="overflow-hidden rounded-[var(--radius-md)] border border-rule bg-page text-[15px]">
        {righe.map((r) => (
          <div key={r.label} className="flex min-h-12 items-center justify-between gap-3 border-b border-rule px-4 py-2 last:border-b-0">
            <span>{r.label}</span>
            <span className="num shrink-0 font-semibold">{formatEuro(r.value)}</span>
          </div>
        ))}
      </section>

      <p className="px-1 text-[13px] text-ink-2">
        Il calcolo applica le impostazioni attuali retroattivamente a tutto l&apos;anno solare
        in corso e non gestisce variazioni di aliquota a metà anno. I contributi versati
        l&apos;anno precedente sono un valore inserito a mano, non derivato automaticamente
        dalle transazioni. Aliquote, coefficiente e minimale restano sotto la tua
        responsabilità: l&apos;app non conosce le regole della tua cassa specifica, esegue
        solo i calcoli sui numeri che fornisci.
      </p>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onModifica}
          className="min-h-12 rounded-[var(--radius-md)] bg-brand-tint py-3 text-base font-semibold text-foreground"
        >
          Modifica impostazioni
        </button>
        <button
          type="button"
          onClick={onDisattiva}
          className="min-h-12 rounded-[var(--radius-md)] py-3 text-[15px] font-semibold text-danger"
        >
          Disattiva gestione P.IVA
        </button>
      </div>
    </div>
  );
}

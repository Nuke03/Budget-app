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
    <div className="flex flex-col gap-6">
      <section className="rounded-[var(--radius-lg)] bg-brand p-7 text-brand-foreground shadow-[var(--shadow-hero)]">
        <p className="text-sm font-medium text-brand-foreground/75">Totale da accantonare</p>
        <p className="mt-1 text-5xl font-bold tabular-nums tracking-tight">
          {formatEuro(totaleDaAccantonare)}
        </p>
        <div className="mt-5 h-px bg-brand-foreground/15" />
        <p className="mt-5 text-sm text-brand-foreground/85">
          Quota mensile suggerita: <span className="font-semibold">{formatEuro(quotaMensileSuggerita)}</span>
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-[var(--radius-md)] bg-surface p-4 text-sm shadow-[var(--shadow-card)]">
        {righe.map((r) => (
          <div key={r.label} className="flex justify-between py-1">
            <span className="font-medium">{r.label}</span>
            <span className="tabular-nums">{formatEuro(r.value)}</span>
          </div>
        ))}
      </section>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onModifica}
          className="rounded-[var(--radius-md)] bg-surface py-3 text-sm font-semibold text-foreground shadow-[var(--shadow-card)]"
        >
          Modifica impostazioni
        </button>
        <button
          type="button"
          onClick={onDisattiva}
          className="rounded-[var(--radius-md)] py-3 text-sm font-semibold text-danger"
        >
          Disattiva gestione P.IVA
        </button>
      </div>
    </div>
  );
}

import { formatEuro } from '@/lib/format';
import type { Andamento } from '@/lib/calculations/supporto/andamento';

const euroInFrase = (n: number): string => formatEuro(n).replace(',00', '');

// Due barre sulla stessa scala, con la cifra stampata accanto.
function Barre({ mese, solito }: { mese: number; solito: number }) {
  const scala = Math.max(mese, solito, 1);
  const righe = [
    { etichetta: 'Questo mese', valore: mese, classe: 'bg-brand' },
    { etichetta: "Di solito a quest'ora", valore: solito, classe: 'bg-ink-2' },
  ];
  return (
    <div aria-hidden="true" className="mt-3 flex flex-col gap-2.5">
      {righe.map((r) => (
        <div key={r.etichetta}>
          <div className="flex items-baseline justify-between text-[13px] text-ink-2">
            <span>{r.etichetta}</span>
            <span className="num font-semibold text-foreground">{euroInFrase(r.valore)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-surface-muted">
            <div className={`h-2 rounded-full ${r.classe}`} style={{ width: `${Math.max(0, (r.valore / scala) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AndamentoCard({ andamento }: { andamento: Andamento }) {
  if (andamento.solito === null) {
    return (
      <section className="px-2 text-[15px] text-ink-2">
        <p>Dal prossimo mese ti mostro come stai andando rispetto al solito.</p>
      </section>
    );
  }
  return (
    <section className="rounded-[var(--radius-md)] border border-rule bg-surface p-4">
      <p className="text-[15px]">
        Questo mese hai speso <span className="num font-semibold">{euroInFrase(andamento.spesoFinora)}</span>, di solito a
        quest&apos;ora <span className="num font-semibold">{euroInFrase(andamento.solito)}</span>
      </p>
      <Barre mese={andamento.spesoFinora} solito={andamento.solito} />
    </section>
  );
}

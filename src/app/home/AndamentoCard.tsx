import { formatEuro } from '@/lib/format';
import type { Andamento } from '@/lib/calculations/supporto/andamento';

const euroInFrase = (n: number): string => formatEuro(n).replace(',00', '');

const L = 300;
const A = 56;
const MARGINE = 4;

function Linea({ curva }: { curva: Andamento['curva'] }) {
  const ultimo = Math.max(...curva.map((p) => p.giorno));
  const alto = Math.max(1, ...curva.flatMap((p) => [p.mese, p.solito ?? 0]));
  const x = (g: number) => MARGINE + ((g - 1) / Math.max(1, ultimo - 1)) * (L - 2 * MARGINE);
  const y = (v: number) => A - MARGINE - (v / alto) * (A - 2 * MARGINE);
  const punti = (leggi: (p: Andamento['curva'][number]) => number | null) =>
    curva
      .map((p) => ({ g: p.giorno, v: leggi(p) }))
      .filter((p): p is { g: number; v: number } => p.v !== null)
      .map((p) => `${x(p.g).toFixed(1)},${y(p.v).toFixed(1)}`)
      .join(' ');

  return (
    <div className="mt-3">
      <svg
        viewBox={`0 0 ${L} ${A}`}
        role="img"
        aria-label="Speso nel mese, giorno per giorno, a confronto con il solito"
        className="h-14 w-full"
        preserveAspectRatio="none"
      >
        <polyline
          points={punti((p) => p.solito)}
          fill="none"
          className="stroke-ink-2"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points={punti((p) => p.mese)}
          fill="none"
          className="stroke-brand"
          strokeWidth="2.5"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <p className="mt-1 flex gap-4 text-xs text-ink-2">
        <span>Questo mese: linea piena</span>
        <span>Di solito: tratteggio</span>
      </p>
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
    <section className="rounded-[var(--radius-md)] bg-surface p-4 shadow-[var(--shadow-card)]">
      <p className="text-[15px]">
        Questo mese hai speso <span className="num font-semibold">{euroInFrase(andamento.spesoFinora)}</span>, di solito a
        quest&apos;ora <span className="num font-semibold">{euroInFrase(andamento.solito)}</span>
      </p>
      {andamento.curva.length > 1 ? <Linea curva={andamento.curva} /> : null}
    </section>
  );
}

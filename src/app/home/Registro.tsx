import Link from 'next/link';
import type { RigaLibretto } from '@/lib/calculations/supporto/home';
import { cifra, giornoMese, giornoMeseTimbro } from './formati';

const COLONNE = 'grid grid-cols-[2.75rem_minmax(0,1fr)_4.5rem_4.5rem] items-center gap-x-2 px-4';

function nomeRiga(r: RigaLibretto): string {
  if (r.descrizione) return r.descrizione;
  return r.tipo === 'income' ? 'Entrata' : 'Spesa';
}

export function Registro({ righe, registratoId }: { righe: RigaLibretto[]; registratoId: string | null }) {
  return (
    <section className="overflow-hidden rounded-[var(--radius-md)] bg-surface shadow-[var(--shadow-card)]">
      <h2 className="sr-only">Ultimi movimenti</h2>
      <div
        className={`${COLONNE} border-b-2 border-brand py-2.5 text-[11px] uppercase tracking-[0.1em] text-ink-2`}
        aria-hidden="true"
      >
        <span>Data</span>
        <span>Movimento</span>
        <span className="text-right">Importo</span>
        <span className="text-right">Nel mese</span>
      </div>

      {righe.length === 0 ? (
        <p className="px-4 py-5 text-[15px] text-ink-2">
          Il libretto è vuoto: la prima spesa che segni compare qui.
        </p>
      ) : (
        <ul>
          {righe.map((r) => {
            const nuova = r.id === registratoId;
            return (
              <li
                key={r.id}
                className={`${COLONNE} relative min-h-12 border-b border-rule py-3 text-[15px] ${nuova ? 'riga-entra' : ''}`}
              >
                <span className="num text-[13px] text-ink-2">{giornoMese(r.data)}</span>
                <span className="min-w-0">
                  <span className="block truncate">{nomeRiga(r)}</span>
                  {r.stima ? <span className="block text-[11px] text-ink-2">stima</span> : null}
                </span>
                <span className="num text-right text-foreground">
                  {r.tipo === 'expense' ? '−' : '+'}
                  {cifra(r.importo)}
                </span>
                <span className="num text-right font-semibold">{cifra(r.nelMese)}</span>
                {nuova ? (
                  <span
                    aria-hidden="true"
                    className="timbro pointer-events-none absolute right-[5.5rem] top-1/2 -mt-[2.25rem] flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border-[3px] border-stamp text-center text-[10px] font-semibold leading-tight tracking-[0.06em] text-stamp"
                  >
                    <span>
                      REGISTRATO
                      <br />
                      {giornoMeseTimbro(r.data)}
                    </span>
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <Link
        href="/history"
        className="flex min-h-11 items-center justify-center text-sm font-semibold text-brand-dark"
      >
        Tutti i movimenti
      </Link>
    </section>
  );
}

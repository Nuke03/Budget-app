'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { addMonths, format } from 'date-fns';
import { SPESE_CERTE_PERSONALI } from '@/lib/percorso/speseCerte';
import { creaFondiSpeseCerte, nessunaSpesaCerta, proponiLezione } from './actions';
import { CAMPO, ERRORE_TESTO, ETICHETTA, PRIMARIO, SECONDARIO } from './stili';

interface Riga {
  scelta: boolean;
  importo: string;
  mese: string;
}

export function PassoSpeseCerte({ oggi }: { oggi: string }) {
  const router = useRouter();
  const [inCorso, avvia] = useTransition();
  const [errore, setErrore] = useState(false);
  const [righe, setRighe] = useState<Record<string, Riga>>(() =>
    Object.fromEntries(
      SPESE_CERTE_PERSONALI.map((s) => [
        s.chiave,
        {
          scelta: false,
          importo: String(s.importoPerCiclo),
          // Senza una data nota si parte da un ciclo intero: la quota mensile resta bassa.
          mese: format(addMonths(new Date(`${oggi}T12:00:00`), s.frequenzaMesi), 'yyyy-MM'),
        },
      ])
    )
  );
  const [create, setCreate] = useState<string[] | null>(null);

  const spuntate = SPESE_CERTE_PERSONALI.filter((s) => righe[s.chiave].scelta);
  const validi = spuntate.every((s) => Number(righe[s.chiave].importo.replace(',', '.')) > 0 && righe[s.chiave].mese >= oggi.slice(0, 7));

  function cambia(chiave: string, parti: Partial<Riga>) {
    setRighe((r) => ({ ...r, [chiave]: { ...r[chiave], ...parti } }));
  }

  function crea() {
    setErrore(false);
    avvia(async () => {
      try {
        const fatte = await creaFondiSpeseCerte(
          spuntate.map((s) => ({
            chiave: s.chiave,
            importo: Number(righe[s.chiave].importo.replace(',', '.')),
            mese: righe[s.chiave].mese,
          }))
        );
        setCreate(fatte);
        router.refresh();
      } catch {
        setErrore(true);
      }
    });
  }

  function nessuna() {
    setErrore(false);
    avvia(async () => {
      try {
        await nessunaSpesaCerta();
        router.refresh();
      } catch {
        setErrore(true);
      }
    });
  }

  if (create) {
    return (
      <div className="mt-5 flex flex-col gap-3">
        <p className="text-[15px]">{`Fatto: ${create.length === 1 ? 'un fondo creato' : `${create.length} fondi creati`}.`}</p>
        {create.includes('assicurazione-auto') ? (
          <Link
            href="/impara/assicurazioni"
            onClick={() => void proponiLezione('assicurazioni').catch(() => {})}
            className="inline-flex min-h-11 items-center text-[15px] font-semibold text-brand-dark underline"
          >
            Leggi la lezione sulle assicurazioni
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-5 flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {SPESE_CERTE_PERSONALI.map((s) => {
          const r = righe[s.chiave];
          return (
            <li key={s.chiave} className="rounded-[var(--radius-md)] border border-rule bg-surface p-3">
              <label className="flex min-h-11 items-center gap-3 text-[15px] font-semibold">
                <input
                  type="checkbox"
                  checked={r.scelta}
                  onChange={(e) => cambia(s.chiave, { scelta: e.target.checked })}
                  className="size-5"
                />
                {s.nome}
              </label>
              <p className="text-sm text-ink-2">{s.riga}</p>
              {r.scelta ? (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className={ETICHETTA}>{`Importo (€, ogni ${s.frequenzaMesi === 12 ? 'anno' : `${s.frequenzaMesi} mesi`})`}</span>
                    <input
                      inputMode="decimal"
                      value={r.importo}
                      onChange={(e) => cambia(s.chiave, { importo: e.target.value })}
                      className={CAMPO}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={ETICHETTA}>Prossima scadenza</span>
                    <input
                      type="month"
                      value={r.mese}
                      min={oggi.slice(0, 7)}
                      onChange={(e) => cambia(s.chiave, { mese: e.target.value })}
                      className={CAMPO}
                    />
                  </label>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <button type="button" disabled={spuntate.length === 0 || !validi || inCorso} onClick={crea} className={PRIMARIO}>
        Crea i fondi
      </button>
      <button type="button" disabled={inCorso} onClick={nessuna} className={SECONDARIO}>
        Non ne ho
      </button>
      {errore ? <p role="alert" className="text-sm text-ink-2">{ERRORE_TESTO}</p> : null}
    </div>
  );
}

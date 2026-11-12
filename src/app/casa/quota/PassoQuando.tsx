import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { fraseVersamento } from '@/lib/calculations/casa/fraseVersamento';
import type { BozzaQuota } from './usaBozzaQuota';
import { MesiSelect, carta, inputClass } from './quotaWizardUi';

export function PassoQuando({ b }: { b: BozzaQuota }) {
  const { giorno, setGiorno, partenza, setPartenza, meseCorrente, versioni, statoBozza, errore } = b;
  return (
    <>
      <section className={carta}>
        <label className="flex flex-col gap-1 text-[15px]">
          Versamento entro il giorno
          <select value={giorno} onChange={(e) => setGiorno(Number(e.target.value))} className={inputClass}>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[15px]">
          Partite dal mese di
          <MesiSelect id="partenza" valore={partenza} da={meseCorrente} onChange={setPartenza} />
        </label>
      </section>

      {versioni ? (
        <section className={carta}>
          {versioni.length === 1 ? (
            <p className="text-[15px] font-semibold">
              {fraseVersamento({
                quote: versioni[0].quote.map((q) => ({ nome: q.displayName, quota: q.quotaMensile })),
                giorno,
                da: versioni[0].validoDal,
              })}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {versioni.map((v) => (
                <li key={v.validoDal} className="text-[15px] font-semibold">
                  {`Da ${format(parseISO(v.validoDal), 'LLLL yyyy', { locale: it })}: ${fraseVersamento({
                    quote: v.quote.map((q) => ({ nome: q.displayName, quota: q.quotaMensile })),
                    giorno,
                  })}`}
                </li>
              ))}
            </ul>
          )}
          {statoBozza.frase ? <p className="text-[15px] text-ink-2">{statoBozza.frase}</p> : null}
        </section>
      ) : null}

      {errore ? (
        <p role="alert" className="text-[15px] text-danger">
          {errore}
        </p>
      ) : null}
    </>
  );
}

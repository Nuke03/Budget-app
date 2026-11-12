import type { BozzaQuota } from './usaBozzaQuota';
import { MesiSelect, bottoneSecondario, carta, inputClass } from './quotaWizardUi';

export function PassoRedditi({ b }: { b: BozzaQuota }) {
  const { persone, setPersona, setPersone, aggiungiPersona, meUserId, meseCorrente, nomePersona, irregolareAttivo } = b;
  return (
    <>
      {persone.map((p) => {
        const tu = p.userId === meUserId;
        const placeholder = p.userId === null;
        return (
          <fieldset key={p.slot} className={carta}>
            <legend className="px-1 text-[15px] font-semibold">
              {nomePersona(p)}
              {tu ? <span className="font-normal text-ink-2"> (tu)</span> : null}
            </legend>
            {placeholder ? (
              <label className="flex flex-col gap-1 text-[15px]">
                Nome
                <input
                  type="text"
                  value={p.displayName}
                  onChange={(e) => setPersona(p.slot, { displayName: e.target.value })}
                  className={inputClass}
                />
              </label>
            ) : null}
            <label className="flex flex-col gap-1 text-[15px]">
              {p.irregolare ? 'Reddito prudente' : 'Reddito netto al mese'}
              <input
                type="text"
                inputMode="decimal"
                value={p.redditoText}
                readOnly={p.soloLettura}
                onChange={(e) => setPersona(p.slot, { redditoText: e.target.value })}
                className={inputClass}
              />
            </label>
            {p.soloLettura ? (
              <p className="text-[13px] text-ink-2">Il suo reddito lo corregge {p.displayName}.</p>
            ) : null}
            {tu ? (
              <label className="flex min-h-11 items-center gap-2 text-[15px]">
                <input
                  type="checkbox"
                  checked={p.irregolare}
                  onChange={(e) => setPersona(p.slot, { irregolare: e.target.checked })}
                />
                Il mio reddito cambia da mese a mese (partita IVA)
              </label>
            ) : null}
            <label className="flex flex-col gap-1 text-[15px]">
              In casa dal
              <MesiSelect
                id={`in-casa-dal-${p.slot}`}
                valore={p.inCasaDal}
                da={meseCorrente}
                onChange={(v) => setPersona(p.slot, { inCasaDal: v })}
              />
            </label>
            {placeholder ? (
              <button
                type="button"
                onClick={() => setPersone((ps) => ps.filter((x) => x.slot !== p.slot))}
                className={`${bottoneSecondario} self-start`}
                aria-label={`Togli ${nomePersona(p)}`}
              >
                Togli
              </button>
            ) : null}
          </fieldset>
        );
      })}
      {irregolareAttivo ? (
        <p className="text-[15px] text-ink-2">
          Scrivi una cifra che incassi anche nei mesi magri. La quota si calcola su questa, il resto lo gestirete a
          parte.
        </p>
      ) : null}
      <p className="text-[15px] text-ink-2">Il reddito che scrivi qui lo vede tutta la casa.</p>
      <button type="button" onClick={aggiungiPersona} className={`${bottoneSecondario} self-start`}>
        Aggiungi una persona
      </button>
    </>
  );
}

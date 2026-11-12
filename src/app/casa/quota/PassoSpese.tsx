import { formatNumero } from '@/lib/format';
import { parseImporto } from '@/lib/calculations/casa/parseImporto';
import type { BozzaQuota } from './usaBozzaQuota';
import { VOCI_CASA_TIPICHE } from '@/lib/calculations/casa/vociTipiche';
import { nuovaChiave, parseMesi, testoNumero } from './quotaWizardState';
import { bottoneSecondario, carta, euro, inputClass } from './quotaWizardUi';

// Le bollette che non si conoscono prima di averle in mano: si parte da una cifra tipica, marcata "stima".
const CHIAVI_BOLLETTE = new Set(['luce', 'gas', 'acqua']);

export function PassoSpese({ b }: { b: BozzaQuota }) {
  const { voci, setVoci, setVoce, infoAperta, setInfoAperta, sottotot } = b;
  return (
    <>
      <div className="flex flex-col gap-3">
        {voci.map((v) => {
          const freq = parseMesi(v.frequenzaText);
          const importo = parseImporto(v.importoText);
          const bolletta = v.custom ? undefined : VOCI_CASA_TIPICHE.find((t) => t.nome === v.nome && CHIAVI_BOLLETTE.has(t.chiave));
          // "Stima" finché la cifra è quella tipica e nessuna bolletta vera l'ha sostituita.
          const sembraStima = bolletta !== undefined && v.origine === 'suggerita' && importo !== null;
          return (
            <div key={v.key} className={carta}>
              <div className="flex items-center justify-between gap-2">
                {v.custom ? (
                  <input
                    type="text"
                    aria-label="Nome della voce"
                    value={v.nome}
                    onChange={(e) => setVoce(v.key, { nome: e.target.value, categoriaNome: e.target.value })}
                    className={`${inputClass} flex-1`}
                  />
                ) : (
                  <span className="text-[15px] font-semibold">{v.nome}</span>
                )}
                <div className="flex items-center gap-2">
                  {v.info ? (
                    <button
                      type="button"
                      aria-label={`Che cos'è ${v.nome}`}
                      aria-expanded={infoAperta === v.key}
                      onClick={() => setInfoAperta(infoAperta === v.key ? null : v.key)}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[15px] font-semibold text-brand-dark"
                    >
                      i
                    </button>
                  ) : null}
                  <button
                    type="button"
                    aria-label={`Togli ${v.nome || 'voce'}`}
                    onClick={() => setVoci((vs) => vs.filter((x) => x.key !== v.key))}
                    className="inline-flex min-h-11 items-center px-2 text-[15px] font-semibold text-ink-2"
                  >
                    Togli
                  </button>
                </div>
              </div>
              {infoAperta === v.key && v.info ? <p className="text-[15px] text-ink-2">{v.info}</p> : null}
              <div className="flex flex-wrap items-center gap-2 text-[15px]">
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label={`Importo ${v.nome || 'voce'}`}
                  value={v.importoText}
                  onChange={(e) => setVoce(v.key, { importoText: e.target.value, origine: 'utente' })}
                  className={`${inputClass} w-28`}
                />
                <span>€ ogni</span>
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label={`Ogni quanti mesi ${v.nome || 'voce'}`}
                  value={v.frequenzaText}
                  onChange={(e) => setVoce(v.key, { frequenzaText: e.target.value })}
                  className={`${inputClass} w-16`}
                />
                <span>{freq === 1 ? 'mese' : 'mesi'}</span>
                {sembraStima ? (
                  <span className="rounded-full bg-brand-tint px-2 py-0.5 text-[13px] font-semibold text-brand-dark">stima</span>
                ) : null}
                {freq !== null && freq > 1 && importo !== null ? (
                  <span className="num text-ink-2">{`= ${formatNumero(importo / freq)} al mese`}</span>
                ) : null}
              </div>
              {bolletta && v.origine !== 'reale' ? (
                <div className="flex flex-col items-start gap-1">
                  <p className="text-[15px] text-ink-2">
                    Cifra tipica per una casa, non la vostra bolletta: con la prima vera ve la correggiamo.
                  </p>
                  {!sembraStima ? (
                  <button
                    type="button"
                    onClick={() =>
                      setVoce(v.key, {
                        importoText: testoNumero(bolletta.stimaRicorrenza ?? 0),
                        frequenzaText: String(bolletta.frequenzaMesi),
                        origine: 'suggerita',
                      })
                    }
                    className="inline-flex min-h-11 items-center text-[15px] font-semibold text-brand-dark"
                  >
                    Non lo so ancora
                  </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() =>
          setVoci((vs) => [
            ...vs,
            {
              key: nuovaChiave(),
              nome: '',
              categoriaNome: '',
              categoriaId: null,
              importoText: '',
              frequenzaText: '1',
              custom: true,
              origine: 'utente',
              goalId: null,
              stimaIgnorataConN: null,
              info: '',
            },
          ])
        }
        className={`${bottoneSecondario} self-start`}
      >
        Aggiungi una voce
      </button>
      <p className="num font-serif text-lg font-semibold">{`Totale al mese: ${euro(sottotot)}`}</p>
      <p className="text-[15px] text-ink-2">Le cifre sono stime: si cambiano.</p>
    </>
  );
}

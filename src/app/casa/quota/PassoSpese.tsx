import { formatNumero } from '@/lib/format';
import { parseImporto } from '@/lib/calculations/casa/parseImporto';
import type { BozzaQuota } from './usaBozzaQuota';
import { nuovaChiave, parseMesi } from './quotaWizardState';
import { bottoneSecondario, carta, euro, inputClass } from './quotaWizardUi';

export function PassoSpese({ b }: { b: BozzaQuota }) {
  const { voci, setVoci, setVoce, infoAperta, setInfoAperta, sottotot } = b;
  return (
    <>
      <div className="flex flex-col gap-3">
        {voci.map((v) => {
          const freq = parseMesi(v.frequenzaText);
          const importo = parseImporto(v.importoText);
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
                  <span className="text-sm font-bold">{v.nome}</span>
                )}
                <div className="flex items-center gap-2">
                  {v.info ? (
                    <button
                      type="button"
                      aria-label={`Che cos'è ${v.nome}`}
                      aria-expanded={infoAperta === v.key}
                      onClick={() => setInfoAperta(infoAperta === v.key ? null : v.key)}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-black/10 text-xs font-bold text-brand-dark"
                    >
                      i
                    </button>
                  ) : null}
                  <button
                    type="button"
                    aria-label={`Togli ${v.nome || 'voce'}`}
                    onClick={() => setVoci((vs) => vs.filter((x) => x.key !== v.key))}
                    className="text-xs font-semibold text-muted"
                  >
                    Togli
                  </button>
                </div>
              </div>
              {infoAperta === v.key && v.info ? <p className="text-sm text-muted">{v.info}</p> : null}
              <div className="flex flex-wrap items-center gap-2 text-sm">
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
                {freq !== null && freq > 1 && importo !== null ? (
                  <span className="text-muted">{`= ${formatNumero(importo / freq)} al mese`}</span>
                ) : null}
              </div>
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
      <p className="text-base font-bold">{`Totale al mese: ${euro(sottotot)}`}</p>
      <p className="text-sm text-muted">Le cifre sono stime: si cambiano.</p>
    </>
  );
}

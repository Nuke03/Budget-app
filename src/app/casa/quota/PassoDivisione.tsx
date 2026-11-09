import type { BozzaQuota } from './usaBozzaQuota';
import { testoAvviso } from './quotaWizardState';
import { carta, euro, inputClass } from './quotaWizardUi';

export function PassoDivisione({ b }: { b: BozzaQuota }) {
  const { totale, eraPersonalizzata, piuPeriodi, periodoTipo, setPeriodoTipo, persone, nomePersona, percText, setPercText, percentualiValide, versioni, colonne, regola, setRegola, colonnaScelta } = b;
  return (
    <>
      <p className="text-base font-bold">{`Totale da versare ogni mese: ${euro(totale)}`}</p>
      {eraPersonalizzata ? (
        <p className="text-sm text-muted">
          Il piano di ora era diviso con percentuali scelte. Qui scegli come dividere da adesso.
        </p>
      ) : null}

      {piuPeriodi ? (
        <fieldset className={carta} data-testid="per-questo-periodo">
          <legend className="px-1 text-sm font-bold">Per questo periodo</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="periodo"
              checked={periodoTipo === 'tutto_a_chi_abita'}
              onChange={() => setPeriodoTipo('tutto_a_chi_abita')}
            />
            Tutto a chi abita già in casa (100%)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="periodo"
              checked={periodoTipo === 'normale'}
              onChange={() => setPeriodoTipo('normale')}
            />
            La regola normale
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="periodo"
              checked={periodoTipo === 'percentuali'}
              onChange={() => setPeriodoTipo('percentuali')}
            />
            Percentuali a scelta
          </label>
          {periodoTipo === 'percentuali' ? (
            <div className="flex flex-wrap gap-3">
              {persone.map((p) => (
                <label key={p.slot} className="flex items-center gap-2 text-sm">
                  <span>{nomePersona(p)}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    aria-label={`Percentuale di ${nomePersona(p)}`}
                    value={percText[p.slot] ?? ''}
                    onChange={(e) => setPercText((t) => ({ ...t, [p.slot]: e.target.value }))}
                    className={`${inputClass} w-20`}
                  />
                  <span>%</span>
                </label>
              ))}
            </div>
          ) : null}
          {periodoTipo === 'percentuali' && !percentualiValide ? (
            <p className="text-sm text-muted">{testoAvviso({ tipo: 'percentuali_non_100' })}</p>
          ) : null}
          {versioni ? (
            <ul className="flex flex-col gap-1 text-sm">
              {versioni[0].quote.map((q) => (
                <li key={q.slot}>{`${q.displayName}: versa ${euro(q.quotaMensile)}, resta ${euro(q.redditoNettoMensile - q.quotaMensile)}`}</li>
              ))}
            </ul>
          ) : null}
        </fieldset>
      ) : null}

      <div role="radiogroup" aria-label="Come dividere" className="flex flex-col gap-3">
        {colonne.map(({ regola: r, risultato }) => {
          const titoloId = `titolo-${r.chiave}`;
          const scelto = regola === r.chiave;
          return (
            <div
              key={r.chiave}
              data-testid={`colonna-${r.chiave}`}
              className={`${carta} ${scelto ? 'ring-2 ring-brand' : ''}`}
            >
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="regola"
                  aria-labelledby={titoloId}
                  checked={scelto}
                  disabled={!risultato.regolaDisponibile}
                  onChange={() => setRegola(r.chiave)}
                />
                <span id={titoloId} className="text-sm font-bold">
                  {r.titolo}
                </span>
              </label>
              {risultato.regolaDisponibile ? (
                <>
                  <ul aria-label="Quote" className="flex flex-col gap-0.5 text-sm">
                    {risultato.persone.map((q) => (
                      <li key={q.slot} className="flex justify-between gap-3">
                        <span>{q.nome}</span>
                        <span className="font-bold">{euro(q.quota)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs font-semibold text-muted">Resta</p>
                  <ul aria-label="Cosa resta" className="flex flex-col gap-0.5 text-sm">
                    {risultato.persone.map((q) => (
                      <li key={q.slot} className="flex justify-between gap-3">
                        <span>{q.nome}</span>
                        <span>{q.resta === null ? '—' : euro(q.resta)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs font-semibold text-muted">Peso sul reddito</p>
                  <ul aria-label="Peso sul reddito" className="flex flex-col gap-0.5 text-sm">
                    {risultato.persone.map((q) => (
                      <li key={q.slot} className="flex justify-between gap-3">
                        <span>{q.nome}</span>
                        <span>{q.peso === null ? '—' : `${Math.round(q.peso * 100)}%`}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                risultato.avvisi.map((a, i) => (
                  <p key={i} className="text-sm text-muted">
                    {testoAvviso(a)}
                  </p>
                ))
              )}
              <p className="text-xs text-muted">{r.frase}</p>
            </div>
          );
        })}
      </div>
      {colonnaScelta.risultato.regolaDisponibile
        ? colonnaScelta.risultato.avvisi.map((a, i) => (
            <p key={i} className="text-sm text-muted">
              {testoAvviso(a)}
            </p>
          ))
        : null}
    </>
  );
}

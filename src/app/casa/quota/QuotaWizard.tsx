'use client';

import { useBozzaQuota, type QuotaWizardProps } from './usaBozzaQuota';
import { PASSI } from './quotaWizardState';
import { bottonePrimario, bottoneSecondario } from './quotaWizardUi';
import { PassoRedditi } from './PassoRedditi';
import { PassoSpese } from './PassoSpese';
import { PassoCuscinetto } from './PassoCuscinetto';
import { PassoDivisione } from './PassoDivisione';
import { PassoQuando } from './PassoQuando';

export function QuotaWizard(props: QuotaWizardProps) {
  const b = useBozzaQuota(props);
  const { passo, setPasso, puoProseguire, versioni, inCorso, conferma } = b;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1">
        <p className="num text-[13px] text-ink-2">{passo} di 5</p>
        <h2 className="font-serif text-lg font-semibold">{PASSI[passo - 1]}</h2>
      </div>

      {passo === 1 ? <PassoRedditi b={b} /> : null}
      {passo === 2 ? <PassoSpese b={b} /> : null}
      {passo === 3 ? <PassoCuscinetto b={b} /> : null}
      {passo === 4 ? <PassoDivisione b={b} /> : null}
      {passo === 5 ? <PassoQuando b={b} /> : null}

      <div className="flex justify-between gap-3">
        {passo > 1 ? (
          <button type="button" onClick={() => setPasso(passo - 1)} className={bottoneSecondario}>
            Indietro
          </button>
        ) : (
          <span />
        )}
        {passo < 5 ? (
          <button type="button" disabled={!puoProseguire} onClick={() => setPasso(passo + 1)} className={bottonePrimario}>
            Avanti
          </button>
        ) : (
          <button type="button" disabled={versioni === null || inCorso} onClick={conferma} className={bottonePrimario}>
            Confermiamo
          </button>
        )}
      </div>
    </div>
  );
}

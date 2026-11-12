import type { BozzaQuota } from './usaBozzaQuota';
import { carta, euro, inputClass } from './quotaWizardUi';

export function PassoCuscinetto({ b }: { b: BozzaQuota }) {
  const { mesiCuscinetto, setMesiCuscinetto, cuscinettoObiettivo, cuscinettoTestoEffettivo, setCuscinettoText, piene } = b;
  return (
    <section className={carta}>
      <p className="text-[15px]">
        Il cuscinetto sono soldi della casa per gli imprevisti: una caldaia, una bolletta più alta del solito.
      </p>
      <div className="flex flex-col gap-2 text-[15px]">
        <span className="font-semibold">Obiettivo</span>
        {([1, 2] as const).map((m) => (
          <label key={m} className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="cuscinetto-mesi"
              checked={mesiCuscinetto === m}
              onChange={() => setMesiCuscinetto(m)}
            />
            {m === 1 ? '1 mese di spese' : '2 mesi di spese'}
          </label>
        ))}
        <p className="num text-ink-2">{`= ${euro(cuscinettoObiettivo)}`}</p>
      </div>
      <label className="flex flex-col gap-1 text-[15px]">
        Ogni mese
        <input
          type="text"
          inputMode="decimal"
          value={cuscinettoTestoEffettivo}
          onChange={(e) => setCuscinettoText(e.target.value)}
          className={inputClass}
        />
      </label>
      {piene !== null ? (
        <p className="text-[15px] text-ink-2">{`Sarà pieno tra circa ${piene} ${piene === 1 ? 'mese' : 'mesi'}.`}</p>
      ) : null}
    </section>
  );
}

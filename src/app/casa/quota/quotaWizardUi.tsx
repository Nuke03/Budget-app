import { formatNumero } from '@/lib/format';
import { opzioniMesi } from './quotaWizardState';

export const inputClass =
  'rounded-[var(--radius-md)] border border-black/5 bg-surface-muted px-4 py-3 text-base outline-none focus-visible:border-brand read-only:opacity-60';
export const carta = 'flex flex-col gap-3 rounded-[var(--radius-lg)] bg-surface p-5 shadow-[var(--shadow-card)]';
export const bottoneSecondario = 'rounded-[var(--radius-md)] border border-black/10 px-4 py-2.5 text-sm font-semibold';
export const bottonePrimario =
  'rounded-[var(--radius-md)] bg-brand px-4 py-3 text-sm font-semibold text-brand-foreground disabled:opacity-40';
export const euro = (n: number) => `${formatNumero(n)} €`;

export function MesiSelect({
  id,
  valore,
  da,
  onChange,
}: {
  id: string;
  valore: string;
  da: string;
  onChange: (v: string) => void;
}) {
  return (
    <select id={id} value={valore} onChange={(e) => onChange(e.target.value)} className={inputClass}>
      {opzioniMesi(da, [valore]).map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

import { formatNumero } from '@/lib/format';
import { CLASSE_CAMPO, CLASSE_PRIMARIO, CLASSE_SCHEDA, CLASSE_SECONDARIO } from '../CampiMovimento';
import { opzioniMesi } from './quotaWizardState';

export const inputClass = `${CLASSE_CAMPO} read-only:opacity-60`;
export const carta = CLASSE_SCHEDA;
export const bottoneSecondario = CLASSE_SECONDARIO;
export const bottonePrimario = CLASSE_PRIMARIO;
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

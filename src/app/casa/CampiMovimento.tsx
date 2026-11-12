import type { ReactNode } from 'react';

// Le classi condivise delle pagine di Casa: carta a filo sottile, pulsanti da 48 e 44 px, link da 44 px.
export const CLASSE_SCHEDA = 'flex flex-col gap-3 rounded-[var(--radius-md)] border border-rule bg-surface p-4';
export const CLASSE_PRIMARIO =
  'flex min-h-12 items-center justify-center rounded-[var(--radius-md)] bg-brand px-4 text-center text-base font-semibold text-brand-foreground disabled:opacity-40';
export const CLASSE_SECONDARIO =
  'flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-brand-tint px-4 text-center text-[15px] font-semibold text-foreground disabled:opacity-40';
// Pulsante discreto su fondo di pagina: tiene bene anche il testo di avviso.
export const CLASSE_NEUTRO =
  'flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-rule bg-surface px-4 text-center text-[15px] font-semibold text-foreground disabled:opacity-40';
export const CLASSE_LINK = 'inline-flex min-h-11 items-center text-[15px] font-semibold text-brand-dark';

export const CLASSE_CAMPO =
  'min-h-12 rounded-[var(--radius-md)] border border-rule bg-surface px-3 py-2 text-[15px] text-foreground outline-none focus-visible:border-brand';

export function Campo({ etichetta, children }: { etichetta: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] text-ink-2">
      {etichetta}
      {children}
    </label>
  );
}

export function CampoImporto({ valore, onChange }: { valore: string; onChange: (v: string) => void }) {
  return (
    <Campo etichetta="Importo">
      <input
        inputMode="decimal"
        placeholder="0"
        value={valore}
        onChange={(e) => onChange(e.target.value)}
        className={CLASSE_CAMPO}
      />
    </Campo>
  );
}

export function SelezioneConto({
  etichetta,
  conti,
  valore,
  onChange,
}: {
  etichetta: string;
  conti: { id: string; nome: string }[];
  valore: string;
  onChange: (v: string) => void;
}) {
  return (
    <Campo etichetta={etichetta}>
      <select value={valore} onChange={(e) => onChange(e.target.value)} className={CLASSE_CAMPO}>
        {conti.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>
    </Campo>
  );
}

export function Spunta({
  etichetta,
  checked,
  onChange,
}: {
  etichetta: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-[15px]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {etichetta}
    </label>
  );
}

export function Registra({ disabilitato, etichetta = 'Registra' }: { disabilitato: boolean; etichetta?: string }) {
  return (
    <button
      type="submit"
      disabled={disabilitato}
      className={CLASSE_PRIMARIO}
    >
      {etichetta}
    </button>
  );
}

export function Annulla({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" onClick={onClose} className="inline-flex min-h-11 items-center justify-center text-[15px] font-semibold text-ink-2">
      Annulla
    </button>
  );
}

export function ErroreMovimento({ testo }: { testo: string | null }) {
  return testo ? (
    <p role="alert" className="text-[15px] font-medium text-danger">
      {testo}
    </p>
  ) : null;
}

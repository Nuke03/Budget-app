import type { ReactNode } from 'react';

export const CLASSE_CAMPO =
  'rounded-[var(--radius-md)] border border-black/5 bg-surface-muted px-4 py-3 text-base text-foreground outline-none focus-visible:border-brand';

export function Campo({ etichetta, children }: { etichetta: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
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
    <label className="flex items-center gap-2 text-sm">
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
      className="rounded-[var(--radius-md)] bg-brand py-3 text-base font-semibold text-brand-foreground disabled:opacity-40"
    >
      {etichetta}
    </button>
  );
}

export function Annulla({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" onClick={onClose} className="text-sm font-semibold text-muted">
      Annulla
    </button>
  );
}

export function ErroreMovimento({ testo }: { testo: string | null }) {
  return testo ? (
    <p role="alert" className="text-sm font-medium text-danger">
      {testo}
    </p>
  ) : null;
}

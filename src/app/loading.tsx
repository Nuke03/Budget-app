// Si vede subito al cambio di pagina, mentre il server legge i dati: niente schermo fermo.
// Copre tutte le pagine che non hanno un caricamento proprio.
export default function Caricamento() {
  return (
    <main aria-busy="true" className="mx-auto flex max-w-md flex-col gap-4 p-5 pt-8">
      <p className="sr-only" role="status">
        Carico i dati…
      </p>
      <div className="h-8 w-40 animate-pulse rounded-[var(--radius-sm)] bg-surface-muted" />
      <div className="h-40 animate-pulse rounded-[var(--radius-lg)] bg-surface-muted" />
      <div className="h-20 animate-pulse rounded-[var(--radius-md)] bg-surface-muted" />
      <div className="h-20 animate-pulse rounded-[var(--radius-md)] bg-surface-muted" />
    </main>
  );
}

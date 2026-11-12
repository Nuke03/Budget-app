import type { ReactNode } from 'react';

// Fascia di copertina del libretto: titolo a sinistra, un'etichetta facoltativa a destra.
// Il padding superiore segue la zona sicura, così il titolo non finisce sotto la barra di stato.
export function CoverHeader({ titolo, lato }: { titolo: string; lato?: ReactNode }) {
  return (
    <header className="bg-cover pt-[env(safe-area-inset-top)] text-cover-foreground">
      <div className="mx-auto flex max-w-md items-baseline justify-between px-5 pb-4 pt-10">
        <h1 className="font-serif text-[22px] font-semibold tracking-[0.02em]">{titolo}</h1>
        {lato ? <p className="text-[13px]">{lato}</p> : null}
      </div>
    </header>
  );
}

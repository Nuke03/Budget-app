import { iconaDi } from '@/lib/categoryIcons';

// Il segno della categoria: con un'icona scelta, l'icona da 16px nel colore della categoria;
// altrimenti il pallino. Senza colore resta lo spazio, così le righe restano allineate.
export function PallinoCategoria({ colore, icona }: { colore: string | null; icona?: string | null }) {
  const Icona = iconaDi(icona);
  if (Icona) {
    return (
      <span
        aria-hidden="true"
        data-colore={colore ?? undefined}
        data-icona={icona ?? undefined}
        style={colore ? { color: colore } : undefined}
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-ink-2"
      >
        <Icona size={16} aria-hidden="true" />
      </span>
    );
  }
  return (
    <span aria-hidden="true" className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
      <span
        data-colore={colore ?? undefined}
        style={colore ? { backgroundColor: colore } : undefined}
        className="inline-block h-2.5 w-2.5 rounded-full"
      />
    </span>
  );
}

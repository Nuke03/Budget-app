// Pallino del colore della categoria. Senza colore resta lo spazio, così le righe restano allineate.
export function PallinoCategoria({ colore }: { colore: string | null }) {
  return (
    <span
      aria-hidden="true"
      data-colore={colore ?? undefined}
      style={colore ? { backgroundColor: colore } : undefined}
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
    />
  );
}

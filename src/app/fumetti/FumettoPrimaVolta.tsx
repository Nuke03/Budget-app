'use client';

import { useState } from 'react';
import { Fumetto } from './Fumetto';
import { eVisto, segnaVisto, giroInQuestaApertura, type FumettoId } from '@/lib/fumetti/visti';
import { useUtenteId, useQualcosaAperto } from '@/lib/fumetti/ambiente';

// Il fumetto della prima volta su una pagina: una volta per utente, mai insieme al giro o a un foglio aperto.
export function FumettoPrimaVolta({
  id,
  ancora,
  testo,
}: {
  id: Exclude<FumettoId, 'giro'>;
  ancora: string;
  testo: string;
}) {
  const utente = useUtenteId();
  const aperto = useQualcosaAperto();
  const [chiuso, setChiuso] = useState(false);

  const mostra = !!utente && !chiuso && !aperto && !eVisto(utente, id) && !giroInQuestaApertura();

  // La regione resta sempre nella pagina: un nodo inserito già con aria-live può non essere letto.
  const regione = (
    <p aria-live="polite" className="sr-only">
      {mostra ? testo : ''}
    </p>
  );
  if (!mostra || !utente) return regione;

  const chiudi = () => {
    segnaVisto(utente, id);
    setChiuso(true);
  };

  return (
    <>
      {regione}
      <Fumetto ancora={ancora} testo={testo} modale={false} onChiudi={chiudi} />
    </>
  );
}

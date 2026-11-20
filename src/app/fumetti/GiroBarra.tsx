'use client';

import { useEffect, useState } from 'react';
import { Fumetto } from './Fumetto';
import { qualcosaAperto, useQualcosaAperto, useUtenteId } from '@/lib/fumetti/ambiente';
import { eVisto, segnaGiroInQuestaApertura, segnaVisto } from '@/lib/fumetti/visti';

export function PASSI_GIRO(haCasa: boolean): { ancora: string; testo: string }[] {
  return [
    { ancora: 'disponibile', testo: 'Questo è quanto puoi spendere adesso. I soldi dei cassetti sono già tolti.' },
    { ancora: 'nav-storico', testo: 'In Storico trovi tutti i movimenti, giorno per giorno, e dove vanno i soldi.' },
    { ancora: 'nav-piu', testo: 'Con il + registri una spesa in pochi secondi. Dentro trovi anche le altre cose che puoi fare.' },
    {
      ancora: 'nav-casa',
      testo: haCasa
        ? 'Casa è lo spazio che condividete: spese comuni, quota del mese e se siete in pari.'
        : 'Qui puoi creare una casa da condividere con chi vive con te.',
    },
    { ancora: 'nav-altro', testo: 'In Altro ci sono i cassetti, i conti, le lezioni di Impara e le impostazioni.' },
  ];
}

// Il giro di benvenuto: cinque bolle in fila sulla Home, una volta sola per utente.
export function GiroBarra({ haCasa }: { haCasa: boolean }) {
  const userId = useUtenteId();
  const aperto = useQualcosaAperto();
  const [partito, setPartito] = useState(false);
  const [chiuso, setChiuso] = useState(false);
  const [indice, setIndice] = useState(0);

  // Parte la prima volta che l'utente è noto, il giro non è visto e non c'è un foglio aperto.
  // Una volta partito non si ferma se si apre un foglio.
  useEffect(() => {
    if (partito || chiuso || !userId || aperto || qualcosaAperto()) return;
    if (eVisto(userId, 'giro')) return;
    segnaGiroInQuestaApertura();
    setPartito(true);
  }, [partito, chiuso, userId, aperto]);

  if (!partito || chiuso || !userId) return null;

  const passi = PASSI_GIRO(haCasa);
  const passo = passi[indice];
  const ultimo = indice === passi.length - 1;

  function finisci() {
    if (userId) segnaVisto(userId, 'giro');
    setChiuso(true);
  }

  return (
    <Fumetto
      ancora={passo.ancora}
      testo={passo.testo}
      modale
      passo={{ n: indice + 1, di: passi.length }}
      etichettaAvanti={ultimo ? 'Fatto' : 'Avanti'}
      onAvanti={ultimo ? finisci : () => setIndice((i) => i + 1)}
      onSalta={finisci}
    />
  );
}

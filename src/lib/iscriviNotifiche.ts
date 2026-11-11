import { createClient } from '@/lib/supabase/client';
import { rispondiNotifiche, salvaIscrizione } from '@/lib/data/notifiche';

export type EsitoNotifiche = 'attive' | 'negate' | 'non_supportate';
export type AmbienteNotifiche = 'installata' | 'ios_da_installare' | 'browser' | 'non_supportate';

// La chiave pubblica arriva in base64url: il browser la vuole in byte.
export function chiaveInBytes(chiave: string): Uint8Array<ArrayBuffer> {
  const base64 = (chiave + '='.repeat((4 - (chiave.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const testo = atob(base64);
  const byte = new Uint8Array(new ArrayBuffer(testo.length));
  for (let i = 0; i < testo.length; i++) byte[i] = testo.charCodeAt(i);
  return byte;
}

function supportate(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof PushManager !== 'undefined' &&
    typeof Notification !== 'undefined'
  );
}

// Dove gira la pagina. Su iPhone le notifiche funzionano solo con l'app aggiunta alla schermata Home.
// Da chiamare dopo il montaggio: sul server non c'è il browser.
export function ambienteNotifiche(): AmbienteNotifiche {
  if (typeof window === 'undefined') return 'non_supportate';
  const installata =
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (installata) return 'installata';
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) return 'ios_da_installare';
  return supportate() ? 'browser' : 'non_supportate';
}

// Da chiamare dentro il gestore di un tocco: il permesso si chiede solo se l'utente ha toccato.
// La richiesta è il primo passo, prima di qualsiasi attesa, altrimenti iPhone la rifiuta.
export async function iscriviNotifiche(chiavePubblica: string): Promise<EsitoNotifiche> {
  if (!supportate()) return 'non_supportate';
  const supabase = createClient();
  const permesso = await Notification.requestPermission();
  if (permesso !== 'granted') {
    await rispondiNotifiche(supabase, false);
    return 'negate';
  }
  await navigator.serviceWorker.register('/sw.js');
  const registrazione = await navigator.serviceWorker.ready;
  const iscrizione = await registrazione.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: chiaveInBytes(chiavePubblica),
  });
  await salvaIscrizione(supabase, iscrizione.toJSON());
  await rispondiNotifiche(supabase, true);
  return 'attive';
}

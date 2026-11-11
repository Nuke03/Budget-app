'use server';

import * as webpush from 'web-push';
import { createClient } from '@/lib/supabase/server';
import { utenteOLogin } from '@/lib/utenteOLogin';
import { endpointAmmesso } from '@/lib/pushEndpoint';

export interface EsitoProva {
  ok: boolean;
  messaggio: string;
}

// Spike usa e getta: serve solo a vedere se la notifica arriva sul telefono.
export async function mandaProva(iscrizione: webpush.PushSubscription): Promise<EsitoProva> {
  const supabase = await createClient();
  await utenteOLogin(supabase);

  const pubblica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privata = process.env.VAPID_PRIVATE_KEY;
  const soggetto = process.env.VAPID_SUBJECT;
  if (!pubblica || !privata || !soggetto) {
    return { ok: false, messaggio: 'Mancano le chiavi delle notifiche su Vercel.' };
  }

  if (!endpointAmmesso(iscrizione?.endpoint ?? '')) {
    return { ok: false, messaggio: 'Indirizzo di notifica non riconosciuto: non è un servizio push noto.' };
  }

  try {
    webpush.setVapidDetails(soggetto, pubblica, privata);
    const risposta = await webpush.sendNotification(
      iscrizione,
      JSON.stringify({ titolo: 'Prova', testo: 'Se leggi questo, le notifiche funzionano.', url: '/' })
    );
    return { ok: true, messaggio: `Inviata al servizio push (codice ${risposta.statusCode}).` };
  } catch (e) {
    const err = e as { statusCode?: number; body?: string; message?: string };
    return {
      ok: false,
      messaggio: `Errore ${err.statusCode ?? '?'}: ${err.body || err.message || 'sconosciuto'}`,
    };
  }
}

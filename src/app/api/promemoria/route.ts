import { createClient } from '@supabase/supabase-js';
import * as webpush from 'web-push';
import { isAuthorizedCron } from '@/lib/data/keepAlive';
import { leggiStatiPersone, type PersonaDaAvvisare } from '@/lib/data/statoNotifiche';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';
import { decidiNotifica, type Notifica } from '@/lib/calculations/supporto/notifiche';
import { endpointAmmesso } from '@/lib/pushEndpoint';

// Cron giornaliero. Usa la chiave `service_role`, che salta la RLS: per questo il client admin si
// crea qui dentro, la chiave non esce da questo modulo e non ha mai il prefisso NEXT_PUBLIC_.
// A differenza di /api/keep-alive, senza CRON_SECRET la route resta chiusa.

const ORE_DI_VITA_NOTIFICA = 12 * 60 * 60;
const TIMEOUT_INVIO_MS = 10_000;

const statoHttp = (e: unknown): number | null =>
  typeof e === 'object' && e !== null && 'statusCode' in e && typeof e.statusCode === 'number'
    ? e.statusCode
    : null;

// Il campo `ultima_*` del tipo di notifica mandata, più il giorno dell'ultima notifica in assoluto.
function aggiornamentoDopoInvio(p: PersonaDaAvvisare, n: Notifica, oggi: string): Record<string, string> {
  const base = { ultima_notifica_il: oggi };
  if (n.tipo === 'spese') return { ...base, ultima_spese_il: oggi };
  if (n.tipo === 'checkin') return { ...base, ultima_checkin_il: oggi };
  return { ...base, ultimo_versamento_mese: p.stato.versamento!.mese };
}

export async function GET(request: Request) {
  const segreto = process.env.CRON_SECRET;
  if (!segreto || !isAuthorizedCron(request.headers.get('authorization'), segreto)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chiaveServizio = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const { VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (!url || !chiaveServizio || !VAPID_SUBJECT || !NEXT_PUBLIC_VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error('promemoria: configurazione incompleta');
    return Response.json({ errore: 'configurazione incompleta' }, { status: 500 });
  }

  const admin = createClient(url, chiaveServizio, { auth: { persistSession: false } });
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  } catch (e) {
    console.error('promemoria: chiavi VAPID non valide', e instanceof Error ? e.message : e);
    return Response.json({ errore: 'configurazione non valida' }, { status: 500 });
  }

  const oggi = oggiRomaISO(new Date());
  let persone: PersonaDaAvvisare[];
  try {
    persone = await leggiStatiPersone(admin, oggi);
  } catch (e) {
    console.error('promemoria: lettura fallita', e instanceof Error ? e.message : e);
    return Response.json({ errore: 'lettura non riuscita' }, { status: 503 });
  }

  let inviate = 0;
  let rimosse = 0;
  for (const persona of persone) {
    try {
      const notifica = decidiNotifica(persona.stato, oggi);
      if (!notifica) continue;
      const payload = JSON.stringify({ titolo: notifica.titolo, testo: notifica.testo, url: notifica.url });

      let riuscite = 0;
      for (const iscrizione of persona.iscrizioni) {
        if (!endpointAmmesso(iscrizione.endpoint)) {
          console.error('promemoria: endpoint non ammesso, saltato', iscrizione.id);
          continue;
        }
        try {
          await webpush.sendNotification(
            { endpoint: iscrizione.endpoint, keys: { p256dh: iscrizione.p256dh, auth: iscrizione.auth } },
            payload,
            { TTL: ORE_DI_VITA_NOTIFICA, timeout: TIMEOUT_INVIO_MS },
          );
          riuscite++;
        } catch (e) {
          const stato = statoHttp(e);
          if (stato === 404 || stato === 410) {
            // Il dispositivo non è più iscritto: la riga non serve più.
            const { error } = await admin.from('push_iscrizioni').delete().eq('id', iscrizione.id);
            if (error) console.error('promemoria: iscrizione non rimossa', iscrizione.id, error.message);
            else rimosse++;
          } else {
            console.error('promemoria: invio fallito', iscrizione.id, stato ?? (e instanceof Error ? e.message : e));
          }
        }
      }

      if (riuscite > 0) {
        inviate += riuscite;
        const { error } = await admin
          .from('promemoria_utente')
          .update(aggiornamentoDopoInvio(persona, notifica, oggi))
          .eq('user_id', persona.stato.userId);
        if (error) console.error('promemoria: stato non aggiornato', error.message);
      }
    } catch (e) {
      console.error('promemoria: persona saltata', e instanceof Error ? e.message : e);
    }
  }

  return Response.json({ inviate, rimosse });
}

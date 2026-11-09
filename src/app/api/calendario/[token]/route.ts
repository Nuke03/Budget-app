import { createClient } from '@supabase/supabase-js';
import { costruisciIcs, parseFeed } from '@/lib/calculations/casa/calendario';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';

const TOKEN_RE = /^[A-Za-z0-9_-]{32,}$/;

const nonTrovato = () => new Response('Non trovato', { status: 404, headers: { 'Cache-Control': 'no-store' } });

// Feed ICS privato: nessuna sessione, legge solo tramite get_calendar_feed(token) con la chiave anon.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token: grezzo } = await params;
  const token = grezzo.endsWith('.ics') ? grezzo.slice(0, -4) : grezzo;
  if (!TOKEN_RE.test(token)) return nonTrovato();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
  const { data, error } = await supabase.rpc('get_calendar_feed', { p_token: token });
  if (error) {
    return new Response('Servizio non disponibile', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  const feed = parseFeed(data);
  if (!feed) return nonTrovato();

  return new Response(costruisciIcs(feed, oggiRomaISO()), {
    status: 200,
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { conUtente } from '@/lib/utenteOLogin';
import { leggiPromemoriaUtente } from '@/lib/data/notifiche';
import { chiaviVapid } from '@/lib/chiaviVapid';
import { getMyHousehold } from '@/lib/data/households';
import { loadCasaStato } from '@/lib/loadCasaStato';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CoverHeader } from '../CoverHeader';
import { Notifiche } from './Notifiche';
import { RiattivaAvvisi } from './RiattivaAvvisi';
import { RivediGiro } from './RivediGiro';
import { RicominciaDaZero } from './RicominciaDaZero';
import { GraduationCap, Archive, Wallet, Tags, Receipt, Bell, Hourglass, HandCoins, ChevronRight } from 'lucide-react';

const voci = [
  { href: '/impara', label: 'Impara', icon: GraduationCap },
  { href: '/agevolazioni', label: 'Agevolazioni e scadenze', icon: HandCoins },
  { href: '/goals', label: 'Cassetti', icon: Archive },
  { href: '/impara/attesa', label: "Lista d'attesa", icon: Hourglass },
  { href: '/accounts', label: 'Conti', icon: Wallet },
  { href: '/categories', label: 'Categorie', icon: Tags },
  { href: '/piva', label: 'P.IVA', icon: Receipt },
  { href: '/altro#notifiche', label: 'Notifiche', icon: Bell },
];

// Credito e debito aperti dell'utente verso la casa, per dirlo prima del reset. Se non si legge,
// il reset non cambia: non tocca la casa.
async function casaAperta(
  supabase: SupabaseClient,
  userId: string | null
): Promise<{ credito: number; debito: number } | null> {
  if (!userId) return null;
  try {
    const corrente = await getMyHousehold(supabase, userId);
    if (!corrente) return null;
    const stato = await loadCasaStato(supabase, corrente);
    return { credito: stato.crediti[stato.me.userId] ?? 0, debito: stato.debitoDaRestituire };
  } catch {
    return null;
  }
}

export default async function AltroPage() {
  const supabase = await createClient();
  const { dati } = await conUtente(supabase, async (userId) => {
    const [promemoria, casa] = await Promise.all([
      leggiPromemoriaUtente(supabase).catch(() => ({ notificheAttive: null, nessunaSpesaFinoAl: null })),
      casaAperta(supabase, userId),
    ]);
    return { ...promemoria, casa };
  });
  return (
    <>
      <CoverHeader titolo="Altro" />
      <main className="mx-auto max-w-xl px-4 pb-28 pt-5">
      <ul className="overflow-hidden rounded-[var(--radius-lg)] border border-rule bg-page">
        {voci.map((v) => {
          const Icon = v.icon;
          return (
            <li key={v.href} className="border-b border-rule last:border-b-0">
              <Link href={v.href} className="flex min-h-[44px] items-center gap-3 px-4 py-3 text-base text-foreground">
                <Icon size={20} className="shrink-0 text-brand" />
                <span className="flex-1">{v.label}</span>
                <ChevronRight size={18} className="shrink-0 text-ink-2" />
              </Link>
            </li>
          );
        })}
      </ul>
      <Notifiche chiavePubblica={chiaviVapid()?.pubblica ?? null} notificheAttive={dati.notificheAttive} />
      <RiattivaAvvisi />
      <RivediGiro />
      <RicominciaDaZero casa={dati.casa} />
      </main>
    </>
  );
}

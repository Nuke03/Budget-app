import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { conUtente } from '@/lib/utenteOLogin';
import { leggiPromemoriaUtente } from '@/lib/data/notifiche';
import { chiaviVapid } from '@/lib/chiaviVapid';
import { Notifiche } from './Notifiche';
import { Target, Wallet, Tags, Receipt, Bell, ChevronRight } from 'lucide-react';

const voci = [
  { href: '/goals', label: 'Obiettivi', icon: Target },
  { href: '/accounts', label: 'Conti', icon: Wallet },
  { href: '/categories', label: 'Categorie', icon: Tags },
  { href: '/piva', label: 'P.IVA', icon: Receipt },
  { href: '/altro#notifiche', label: 'Notifiche', icon: Bell },
];

export default async function AltroPage() {
  const supabase = await createClient();
  const { dati } = await conUtente(supabase, () => leggiPromemoriaUtente(supabase));
  return (
    <main className="mx-auto max-w-xl px-4 pb-28 pt-8">
      <h1 className="font-serif text-2xl font-semibold text-foreground">Altro</h1>
      <ul className="mt-6 overflow-hidden rounded-[var(--radius-lg)] border border-rule bg-page shadow-[var(--shadow-card)]">
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
    </main>
  );
}

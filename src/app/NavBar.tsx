'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Fragment } from 'react';
import { Home, BarChart3, Building2, MoreHorizontal, Plus } from 'lucide-react';
import { EVENTO_AGGIUNGI, type DettaglioAggiungi } from '@/lib/eventoAggiungi';

// "Altro" resta attiva anche sulle pagine raggiungibili dalla sua lista.
const PERCORSI_ALTRO = ['/altro', '/goals', '/accounts', '/categories', '/piva'];

const schede = [
  { href: '/', label: 'Home', icon: Home, attiva: (p: string) => p === '/' },
  { href: '/history', label: 'Storico', icon: BarChart3, attiva: (p: string) => p === '/history' },
  { href: '/casa', label: 'Casa', icon: Building2, attiva: (p: string) => p.startsWith('/casa') },
  {
    href: '/altro',
    label: 'Altro',
    icon: MoreHorizontal,
    attiva: (p: string) => PERCORSI_ALTRO.some((r) => p === r || p.startsWith(`${r}/`)),
  },
];

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();

  // Se la pagina ha un foglio di aggiunta lo apre, altrimenti porta alla Home che lo apre.
  function aggiungi() {
    const dettaglio: DettaglioAggiungi = { gestito: false };
    window.dispatchEvent(new CustomEvent(EVENTO_AGGIUNGI, { detail: dettaglio }));
    if (!dettaglio.gestito) router.push('/?aggiungi=1');
  }

  if (pathname === '/login' || pathname === '/reset-password' || pathname === '/forgot-password') {
    return null;
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-surface pb-[env(safe-area-inset-bottom)]"
      aria-label="Navigazione principale"
    >
      <div className="mx-auto flex max-w-xl">
        {schede.map((s, i) => {
          const isActive = s.attiva(pathname);
          const Icon = s.icon;
          return (
            <Fragment key={s.href}>
              {i === 2 ? (
                <div className="flex flex-1 items-start justify-center">
                  <button
                    type="button"
                    onClick={aggiungi}
                    aria-label="Aggiungi transazione"
                    className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full border-4 border-surface bg-brand text-brand-foreground"
                  >
                    <Plus size={26} strokeWidth={2.5} />
                  </button>
                </div>
              ) : null}
            <Link
              href={s.href}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs transition-colors duration-150 ${
                isActive ? 'font-bold text-brand' : 'font-medium text-ink-2'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
              {s.label}
            </Link>
            </Fragment>
          );
        })}
      </div>
    </nav>
  );
}

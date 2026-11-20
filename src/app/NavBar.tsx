'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment, useState } from 'react';
import { Home, BarChart3, Building2, MoreHorizontal, Plus } from 'lucide-react';
import { MenuAzioni } from './menu/MenuAzioni';
import { useCasaDaFare } from './CasaSegnale';

// "Altro" resta attiva anche sulle pagine raggiungibili dalla sua lista.
const PERCORSI_ALTRO = ['/altro', '/goals', '/accounts', '/categories', '/piva'];

const schede = [
  { href: '/', label: 'Home', icon: Home, attiva: (p: string) => p === '/' },
  { href: '/history', label: 'Storico', fumetto: 'nav-storico', icon: BarChart3, attiva: (p: string) => p === '/history' },
  { href: '/casa', label: 'Casa', fumetto: 'nav-casa', icon: Building2, attiva: (p: string) => p.startsWith('/casa') },
  {
    href: '/altro',
    label: 'Altro',
    fumetto: 'nav-altro',
    icon: MoreHorizontal,
    attiva: (p: string) => PERCORSI_ALTRO.some((r) => p === r || p.startsWith(`${r}/`)),
  },
];

export function NavBar() {
  const pathname = usePathname();
  const casaDaFare = useCasaDaFare();
  const [menuAperto, setMenuAperto] = useState(false);

  if (pathname === '/login' || pathname === '/reset-password' || pathname === '/forgot-password') {
    return null;
  }

  return (
    <>
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-surface pb-[env(safe-area-inset-bottom)]"
      aria-label="Navigazione principale"
    >
      <div className="mx-auto flex max-w-xl">
        {schede.map((s, i) => {
          const isActive = s.attiva(pathname);
          const Icon = s.icon;
          const puntino = s.href === '/casa' && casaDaFare;
          return (
            <Fragment key={s.href}>
              {i === 2 ? (
                <div className="flex flex-1 items-start justify-center">
                  <button
                    type="button"
                    onClick={() => setMenuAperto(true)}
                    aria-label="Cosa vuoi fare?"
                    data-fumetto="nav-piu"
                    className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full border-4 border-surface bg-brand text-brand-foreground"
                  >
                    <Plus size={26} strokeWidth={2.5} />
                  </button>
                </div>
              ) : null}
            <Link
              href={s.href}
              data-fumetto={s.fumetto}
              aria-current={isActive ? 'page' : undefined}
              aria-label={puntino ? `${s.label}, c'è una cosa da fare` : undefined}
              className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs transition-colors duration-150 ${
                isActive ? 'font-bold text-brand' : 'font-medium text-ink-2'
              }`}
            >
              <span className="relative">
                <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
                {puntino ? (
                  <span
                    data-testid="puntino-casa"
                    aria-hidden="true"
                    className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-brand"
                  />
                ) : null}
              </span>
              {s.label}
            </Link>
            </Fragment>
          );
        })}
      </div>
    </nav>
    {/* Fuori dalla nav: il foglio e l'avviso di annullamento (z-50) si sovrappongono nell'ordine giusto */}
    <MenuAzioni aperto={menuAperto} onClose={() => setMenuAperto(false)} inCasa={pathname === '/casa'} />
    </>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BarChart3, Building2, MoreHorizontal } from 'lucide-react';

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

  if (pathname === '/login' || pathname === '/reset-password' || pathname === '/forgot-password') {
    return null;
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-surface pb-[env(safe-area-inset-bottom)]"
      aria-label="Navigazione principale"
    >
      <div className="mx-auto flex max-w-xl">
        {schede.map((s) => {
          const isActive = s.attiva(pathname);
          const Icon = s.icon;
          return (
            <Link
              key={s.href}
              href={s.href}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs transition-colors duration-150 ${
                isActive ? 'font-bold text-brand' : 'font-medium text-ink-2'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
              {s.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

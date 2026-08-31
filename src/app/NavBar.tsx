'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Target, BarChart3, Wallet, Tag } from 'lucide-react';

const links = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/goals', label: 'Obiettivi', icon: Target },
  { href: '/history', label: 'Storico', icon: BarChart3 },
  { href: '/accounts', label: 'Conti', icon: Wallet },
  { href: '/categories', label: 'Categorie', icon: Tag },
];

export function NavBar() {
  const pathname = usePathname();

  if (pathname === '/login' || pathname === '/reset-password') return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      aria-label="Navigazione principale"
    >
      <div className="flex items-center gap-1 rounded-[var(--radius-lg)] border border-black/5 bg-surface/95 p-1.5 shadow-[var(--shadow-card)] backdrop-blur-sm">
        {links.map((l) => {
          const isActive = pathname === l.href;
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex flex-col items-center gap-0.5 rounded-[var(--radius-md)] px-3.5 py-2 text-[11px] font-medium transition-colors duration-150 ${
                isActive ? 'bg-brand-tint text-brand-dark' : 'text-muted hover:text-foreground'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

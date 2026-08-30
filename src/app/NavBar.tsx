'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Home' },
  { href: '/goals', label: 'Obiettivi' },
  { href: '/history', label: 'Storico' },
  { href: '/accounts', label: 'Conti' },
  { href: '/categories', label: 'Categorie' },
];

export function NavBar() {
  const pathname = usePathname();

  if (pathname === '/login' || pathname === '/reset-password') return null;

  return (
    <nav className="sticky bottom-0 flex justify-around border-t bg-white p-2 text-xs">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={pathname === l.href ? 'font-bold' : 'text-slate-500'}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

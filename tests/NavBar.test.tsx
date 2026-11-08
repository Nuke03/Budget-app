import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NavBar } from '@/app/NavBar';

let pathname = '/';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

describe('NavBar', () => {
  it('ha sei voci con Casa e senza Categorie', () => {
    pathname = '/';
    render(<NavBar />);
    expect(screen.getAllByRole('link')).toHaveLength(6);
    expect(screen.getByRole('link', { name: 'Casa' })).toHaveAttribute('href', '/casa');
    expect(screen.queryByRole('link', { name: 'Categorie' })).not.toBeInTheDocument();
  });

  it('Casa è attiva su /casa e su /casa/quota', () => {
    for (const p of ['/casa', '/casa/quota']) {
      pathname = p;
      const { unmount } = render(<NavBar />);
      expect(screen.getByRole('link', { name: 'Casa' })).toHaveAttribute('aria-current', 'page');
      unmount();
    }
  });

  it('le altre voci restano attive solo sul percorso esatto', () => {
    pathname = '/goals';
    render(<NavBar />);
    expect(screen.getByRole('link', { name: 'Obiettivi' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Casa' })).not.toHaveAttribute('aria-current');
  });

  it('le altre voci non sono attive su un sotto-percorso', () => {
    pathname = '/goals/nuovo';
    render(<NavBar />);
    expect(screen.getByRole('link', { name: 'Obiettivi' })).not.toHaveAttribute('aria-current');
  });
});

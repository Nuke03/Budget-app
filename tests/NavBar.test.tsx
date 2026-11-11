import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NavBar } from '@/app/NavBar';

let pathname = '/';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

describe('NavBar', () => {
  it('ha quattro schede: Home, Storico, Casa, Altro', () => {
    pathname = '/';
    render(<NavBar />);
    const link = screen.getAllByRole('link');
    expect(link).toHaveLength(4);
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Storico' })).toHaveAttribute('href', '/history');
    expect(screen.getByRole('link', { name: 'Casa' })).toHaveAttribute('href', '/casa');
    expect(screen.getByRole('link', { name: 'Altro' })).toHaveAttribute('href', '/altro');
  });

  it('Casa è attiva su /casa e su /casa/quota', () => {
    for (const p of ['/casa', '/casa/quota']) {
      pathname = p;
      const { unmount } = render(<NavBar />);
      expect(screen.getByRole('link', { name: 'Casa' })).toHaveAttribute('aria-current', 'page');
      unmount();
    }
  });

  it('Altro è attiva su /altro, /goals, /accounts, /categories e /piva', () => {
    for (const p of ['/altro', '/goals', '/accounts', '/categories', '/piva']) {
      pathname = p;
      const { unmount } = render(<NavBar />);
      expect(screen.getByRole('link', { name: 'Altro' })).toHaveAttribute('aria-current', 'page');
      expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
      unmount();
    }
  });

  it('Home è attiva solo sul percorso esatto', () => {
    pathname = '/goals';
    const { unmount } = render(<NavBar />);
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
    unmount();

    pathname = '/';
    render(<NavBar />);
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
  });
});

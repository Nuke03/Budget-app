import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NavBar } from '@/app/NavBar';

let pathname = '/';
const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ usePathname: () => pathname, useRouter: () => ({ push }) }));
vi.mock('@/app/menu/actions', () => ({ leggiVociMenu: () => new Promise(() => {}) }));

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

  it('le schede e il + portano gli attributi data-fumetto', () => {
    pathname = '/';
    render(<NavBar />);
    expect(screen.getByRole('link', { name: 'Storico' })).toHaveAttribute('data-fumetto', 'nav-storico');
    expect(screen.getByRole('link', { name: 'Casa' })).toHaveAttribute('data-fumetto', 'nav-casa');
    expect(screen.getByRole('link', { name: 'Altro' })).toHaveAttribute('data-fumetto', 'nav-altro');
    expect(screen.getByRole('button', { name: 'Cosa vuoi fare?' })).toHaveAttribute('data-fumetto', 'nav-piu');
  });

  it('il + ha nome "Cosa vuoi fare?" e apre il menu', () => {
    pathname = '/';
    render(<NavBar />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cosa vuoi fare?' }));
    expect(screen.getByRole('dialog', { name: 'Cosa vuoi fare?' })).toBeInTheDocument();
  });

  it('dal menu, "Registra una spesa" su un altra pagina porta alla Home col foglio aperto', () => {
    pathname = '/altro';
    push.mockClear();
    render(<NavBar />);
    fireEvent.click(screen.getByRole('button', { name: 'Cosa vuoi fare?' }));
    fireEvent.click(screen.getByRole('button', { name: 'Registra una spesa' }));
    expect(push).toHaveBeenCalledWith('/?aggiungi=1');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('dal menu, "Registra una spesa" gestita dalla pagina non fa push', () => {
    pathname = '/';
    push.mockClear();
    render(<NavBar />);
    const ascolta = (e: Event) => {
      (e as CustomEvent).detail.gestito = true;
    };
    window.addEventListener('libretto:aggiungi', ascolta);
    fireEvent.click(screen.getByRole('button', { name: 'Cosa vuoi fare?' }));
    fireEvent.click(screen.getByRole('button', { name: 'Registra una spesa' }));
    window.removeEventListener('libretto:aggiungi', ascolta);
    expect(push).not.toHaveBeenCalled();
  });

  it('su /casa il menu offre la spesa di casa', () => {
    pathname = '/casa';
    render(<NavBar />);
    fireEvent.click(screen.getByRole('button', { name: 'Cosa vuoi fare?' }));
    expect(screen.getByRole('button', { name: 'Registra una spesa di casa' })).toBeInTheDocument();
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

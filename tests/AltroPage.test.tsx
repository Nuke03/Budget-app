import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }), getSession: async () => ({ data: { session: null } }) },
  }),
}));
vi.mock('@/lib/data/notifiche', () => ({
  leggiPromemoriaUtente: async () => ({ notificheAttive: true, nessunaSpesaFinoAl: null }),
}));
vi.mock('@/app/altro/Notifiche', () => ({
  Notifiche: ({ notificheAttive }: { notificheAttive: boolean | null }) => (
    <section id="notifiche">stato:{String(notificheAttive)}</section>
  ),
}));

import AltroPage from '@/app/altro/page';
import { serveConferma, nonAvvisarePiu } from '@/lib/conferme';

describe('pagina Altro', () => {
  it('ha sei link con gli href previsti', async () => {
    render(await AltroPage());
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(6);
    expect(screen.getByRole('link', { name: /Impara/ })).toHaveAttribute('href', '/impara');
    expect(screen.getByRole('link', { name: /Obiettivi/ })).toHaveAttribute('href', '/goals');
    expect(screen.getByRole('link', { name: /Conti/ })).toHaveAttribute('href', '/accounts');
    expect(screen.getByRole('link', { name: /Categorie/ })).toHaveAttribute('href', '/categories');
    expect(screen.getByRole('link', { name: /P\.IVA/ })).toHaveAttribute('href', '/piva');
    expect(screen.getByRole('link', { name: /Notifiche/ })).toHaveAttribute('href', '/altro#notifiche');
  });

  it('ha la voce Impara prima di Obiettivi', async () => {
    render(await AltroPage());
    const nomi = screen.getAllByRole('link').map((l) => l.textContent);
    expect(nomi[0]).toBe('Impara');
    expect(nomi[1]).toBe('Obiettivi');
  });

  it('Riattiva gli avvisi rimette le conferme', async () => {
    nonAvvisarePiu('movimento_casa');
    expect(serveConferma('movimento_casa')).toBe(false);
    render(await AltroPage());
    expect(screen.getByRole('heading', { name: 'Conferme' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Riattiva gli avvisi' }));
    expect(serveConferma('movimento_casa')).toBe(true);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('porta la sezione notifiche con lo stato dell utente', async () => {
    const { container } = render(await AltroPage());
    expect(container.querySelector('#notifiche')).toHaveTextContent('stato:true');
  });
  it('se la lettura dei promemoria fallisce la pagina si apre lo stesso', async () => {
    vi.resetModules();
    vi.doMock('@/lib/data/notifiche', () => ({
      leggiPromemoriaUtente: async () => {
        throw new Error('db');
      },
    }));
    const { default: Pagina } = await import('@/app/altro/page');
    const { container } = render(await Pagina());
    expect(container.querySelector('#notifiche')).toHaveTextContent('stato:null');
  });
  it('senza sessione porta al login', async () => {
    vi.resetModules();
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null }, error: null }), getSession: async () => ({ data: { session: null } }) } }),
    }));
    const { default: Pagina } = await import('@/app/altro/page');
    await expect(Pagina()).rejects.toThrow('REDIRECT:/login');
  });
});
